#!/usr/bin/env python3
"""
Serve a local sequence model prediction platform.

Open http://127.0.0.1:8877 and upload one stock CSV. The server loads the
trained TCN and Transformer models, predicts from the latest lookback window,
and reports the exact date range used for prediction.
"""

from __future__ import annotations

import argparse
import json
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Any
from urllib.parse import unquote

import numpy as np
import pandas as pd
import torch

SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from train_sequence_price_model import FEATURES, HORIZONS, read_market, read_stock
from train_torch_sequence_model import TCNModel, TransformerModel, inverse_predictions


DEFAULT_MODEL_ROOT = ROOT / "results" / "model outputs"
DEFAULT_INDEX_FILE = Path("/Users/lilongjiang/Desktop/量化交易/trading-data.20260522/index data/sh000001.csv")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Serve local sequence prediction platform.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8877)
    parser.add_argument("--model-root", type=Path, default=DEFAULT_MODEL_ROOT)
    parser.add_argument("--tcn-dir", default="torch_tcn_v1")
    parser.add_argument("--transformer-dir", default="torch_transformer_v1")
    parser.add_argument("--index-file", type=Path, default=DEFAULT_INDEX_FILE)
    return parser.parse_args()


class LoadedModel:
    def __init__(self, name: str, model_dir: Path):
        self.name = name
        self.model_dir = model_dir
        artifact = json.loads((model_dir / "model_artifact.json").read_text(encoding="utf-8"))
        self.artifact = artifact
        self.lookback = int(artifact["lookback"])
        config = artifact["model_config"]
        model_type = artifact["model"]
        if model_type == "tcn":
            model = TCNModel(len(FEATURES), int(config["hidden"]), int(config["outputs"]), float(config["dropout"]))
        elif model_type == "transformer":
            model = TransformerModel(
                len(FEATURES),
                int(config["hidden"]),
                int(config["outputs"]),
                int(config["layers"]),
                int(config["heads"]),
                float(config["dropout"]),
                self.lookback,
            )
        else:
            raise RuntimeError(f"Unsupported model type: {model_type}")
        state = torch.load(model_dir / "model.pt", map_location="cpu")
        model.load_state_dict(state)
        model.eval()
        self.model = model
        self.mean = np.asarray(artifact["x_stats"]["mean"], dtype="float32")
        self.std = np.asarray(artifact["x_stats"]["std"], dtype="float32")
        self.std[self.std == 0] = 1.0
        self.metrics = json.loads((model_dir / "metrics.json").read_text(encoding="utf-8"))

    def predict(self, sequence: np.ndarray) -> dict[str, Any]:
        x = np.clip((sequence - self.mean) / self.std, -6.0, 6.0).astype("float32")
        x = torch.from_numpy(x.reshape(1, self.lookback, len(FEATURES)))
        with torch.no_grad():
            raw = self.model(x).cpu().numpy()
        pred = inverse_predictions(raw)[0]
        out: dict[str, Any] = {
            "name": self.name,
            "model_dir": str(self.model_dir),
            "test_metrics": self.metrics["test"]["per_horizon"],
        }
        for index, horizon in enumerate(HORIZONS):
            ret_col = index * 2
            up_col = ret_col + 1
            out[f"pred_return_{horizon}d"] = float(pred[ret_col])
            out[f"prob_up_{horizon}d"] = float(pred[up_col])
        return out


def prepare_latest_sequence(csv_text: str, index_file: Path, lookback: int) -> tuple[dict[str, Any], np.ndarray]:
    market = read_market(index_file)
    with NamedTemporaryFile("w", suffix=".csv", encoding="utf-8", delete=False) as f:
        f.write(csv_text)
        temp_path = Path(f.name)
    try:
        df = read_stock(temp_path, market, winsor=0.18)
    finally:
        temp_path.unlink(missing_ok=True)
    if df.empty:
        raise RuntimeError("CSV 无法读取，或缺少 code/date/open/high/low/close/volume/money/turnover/adjust_price_f 字段。")
    clean = df.dropna(subset=FEATURES).copy()
    if len(clean) < lookback:
        raise RuntimeError(f"有效历史不足：需要至少 {lookback} 天含完整特征的数据，当前只有 {len(clean)} 天。")
    window = clean.iloc[-lookback:].copy()
    values = window[FEATURES].to_numpy(dtype="float32")
    meta = {
        "code": str(window["code"].iloc[-1]),
        "asof_date": str(window["date"].iloc[-1].date()),
        "lookback": lookback,
        "window_start": str(window["date"].iloc[0].date()),
        "window_end": str(window["date"].iloc[-1].date()),
        "rows_in_uploaded_file": int(len(df)),
        "valid_feature_rows": int(len(clean)),
    }
    return meta, values


def rating_from_prob(prob: float) -> str:
    if prob >= 0.58:
        return "偏强"
    if prob >= 0.52:
        return "略强"
    if prob <= 0.42:
        return "偏弱"
    if prob <= 0.48:
        return "略弱"
    return "中性"


def make_handler(models: list[LoadedModel], index_file: Path):
    class Handler(BaseHTTPRequestHandler):
        def do_GET(self) -> None:
            path = unquote(self.path.split("?", 1)[0])
            if path in {"/", "/index.html"}:
                self.send_file(ROOT / "platform" / "index.html", "text/html; charset=utf-8")
                return
            if path == "/app.js":
                self.send_file(ROOT / "platform" / "app.js", "application/javascript; charset=utf-8")
                return
            if path == "/styles.css":
                self.send_file(ROOT / "platform" / "styles.css", "text/css; charset=utf-8")
                return
            self.send_error(404)

        def do_POST(self) -> None:
            if self.path != "/predict":
                self.send_error(404)
                return
            try:
                length = int(self.headers.get("Content-Length", "0"))
                payload = json.loads(self.rfile.read(length).decode("utf-8"))
                csv_text = payload.get("csv", "")
                if not csv_text.strip():
                    raise RuntimeError("没有收到 CSV 内容。")
                lookback = max(model.lookback for model in models)
                meta, sequence = prepare_latest_sequence(csv_text, index_file, lookback)
                predictions = []
                for model in models:
                    seq = sequence[-model.lookback :, :]
                    pred = model.predict(seq)
                    pred["rating_5d"] = rating_from_prob(pred["prob_up_5d"])
                    predictions.append(pred)
                self.send_json({"meta": meta, "predictions": predictions})
            except Exception as exc:
                self.send_json({"error": str(exc)}, status=400)

        def send_file(self, path: Path, content_type: str) -> None:
            data = path.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def send_json(self, payload: dict[str, Any], status: int = 200) -> None:
            data = json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def log_message(self, format: str, *args: Any) -> None:
            print(f"{self.address_string()} - {format % args}")

    return Handler


def main() -> None:
    args = parse_args()
    models = [
        LoadedModel("TCN", args.model_root / args.tcn_dir),
        LoadedModel("Transformer", args.model_root / args.transformer_dir),
    ]
    server = ThreadingHTTPServer((args.host, args.port), make_handler(models, args.index_file))
    print(f"Sequence prediction platform: http://{args.host}:{args.port}")
    print(f"Loaded models: {', '.join(model.name for model in models)}")
    server.serve_forever()


if __name__ == "__main__":
    main()
