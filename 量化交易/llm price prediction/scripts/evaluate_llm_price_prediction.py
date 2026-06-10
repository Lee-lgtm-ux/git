#!/usr/bin/env python3
"""
Evaluate direct LLM stock price prediction from compact daily-price prompts.

Modes:
- export-prompts: write JSONL prompts with hidden future labels.
- baseline: write a simple momentum baseline and metrics.
- predict: call an OpenAI-compatible chat/completions endpoint.
- evaluate: score LLM prediction JSONL against prompt labels.
"""

from __future__ import annotations

import argparse
import json
import math
import os
import re
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd


DEFAULT_STOCK_DIR = Path("/Users/lilongjiang/Desktop/量化交易/trading-data.20260522/stock data")
HORIZONS = (1, 3, 5)
REQUIRED_COLS = {
    "code",
    "date",
    "open",
    "high",
    "low",
    "close",
    "volume",
    "money",
    "turnover",
    "adjust_price_f",
}


def load_env_file() -> None:
    candidates = [
        Path.cwd() / ".env",
        Path.cwd().parent / ".env",
        Path(__file__).resolve().parents[1] / ".env",
        Path(__file__).resolve().parents[2] / ".env",
    ]
    for path in candidates:
        if not path.exists():
            continue
        with path.open("r", encoding="utf-8") as f:
            for line in f:
                stripped = line.strip()
                if not stripped or stripped.startswith("#") or "=" not in stripped:
                    continue
                key, value = stripped.split("=", 1)
                key = key.strip()
                value = value.strip().strip('"').strip("'")
                os.environ.setdefault(key, value)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="LLM direct price prediction experiment.")
    parser.add_argument("--mode", choices=["export-prompts", "export-batch-prompt", "baseline", "predict", "evaluate"], required=True)
    parser.add_argument("--stock-dir", type=Path, default=DEFAULT_STOCK_DIR)
    parser.add_argument("--stock-file", type=Path, default=None)
    parser.add_argument("--max-files", type=int, default=20)
    parser.add_argument("--samples-per-stock", type=int, default=3)
    parser.add_argument("--lookback", type=int, default=30)
    parser.add_argument("--min-history", type=int, default=90)
    parser.add_argument("--test-start", default="2024-01-01")
    parser.add_argument("--prompt-file", type=Path, default=Path("results/prompts.jsonl"))
    parser.add_argument("--prediction-file", type=Path, default=Path("results/llm_predictions.jsonl"))
    parser.add_argument("--output-file", type=Path, default=Path("results/prompts.jsonl"))
    parser.add_argument("--metrics-file", type=Path, default=Path("results/metrics.json"))
    parser.add_argument("--sleep", type=float, default=0.0, help="Seconds between LLM API calls.")
    parser.add_argument("--limit", type=int, default=0, help="Limit prompts for predict/evaluate; 0 means all.")
    parser.add_argument("--offset", type=int, default=0, help="Skip this many prompt/prediction rows before applying --limit.")
    return parser.parse_args()


def stock_files(args: argparse.Namespace) -> list[Path]:
    if args.stock_file:
        return [args.stock_file]
    files = sorted(args.stock_dir.glob("*.csv"))
    return files[: args.max_files] if args.max_files else files


def read_stock(path: Path) -> pd.DataFrame:
    try:
        df = pd.read_csv(path, usecols=lambda col: col in REQUIRED_COLS)
    except Exception:
        return pd.DataFrame()
    if missing := [col for col in REQUIRED_COLS if col not in df.columns]:
        return pd.DataFrame()
    df["date"] = pd.to_datetime(df["date"], errors="coerce")
    for col in REQUIRED_COLS - {"code", "date"}:
        df[col] = pd.to_numeric(df[col], errors="coerce")
    df = df.dropna(subset=["code", "date", "adjust_price_f"]).sort_values("date").reset_index(drop=True)
    price = df["adjust_price_f"]
    df["ret_1d"] = price.pct_change()
    df["ret_5d"] = price.pct_change(5)
    df["ret_20d"] = price.pct_change(20)
    df["range_pct"] = (df["high"] - df["low"]) / df["close"].replace(0, np.nan)
    df["money_chg_5d"] = df["money"].replace(0, np.nan) / df["money"].replace(0, np.nan).shift(5) - 1.0
    df["vol_20d"] = df["ret_1d"].rolling(20, min_periods=10).std() * np.sqrt(252)
    for horizon in HORIZONS:
        df[f"future_return_{horizon}d"] = price.shift(-horizon) / price - 1.0
        df[f"future_up_{horizon}d"] = (df[f"future_return_{horizon}d"] > 0).astype(int)
    return df


def sample_indices(df: pd.DataFrame, args: argparse.Namespace) -> list[int]:
    test_start = pd.Timestamp(args.test_start)
    valid = df.index[
        (df.index >= max(args.min_history, args.lookback))
        & (df.index < len(df) - max(HORIZONS))
        & (df["date"] >= test_start)
    ].to_numpy()
    if len(valid) == 0:
        return []
    count = min(args.samples_per_stock, len(valid))
    positions = np.linspace(0, len(valid) - 1, count).round().astype(int)
    return valid[positions].tolist()


def compact_window(window: pd.DataFrame) -> str:
    lines = ["date,close_idx,ret_1d_pct,ret_5d_pct,range_pct,turnover,money_chg_5d_pct,vol_20d_pct"]
    base = window["adjust_price_f"].iloc[0]
    for _, row in window.iterrows():
        close_idx = row["adjust_price_f"] / base * 100.0 if base else np.nan
        lines.append(
            ",".join(
                [
                    str(row["date"].date()),
                    fmt(close_idx),
                    fmt(row["ret_1d"] * 100),
                    fmt(row["ret_5d"] * 100),
                    fmt(row["range_pct"] * 100),
                    fmt(row["turnover"]),
                    fmt(row["money_chg_5d"] * 100),
                    fmt(row["vol_20d"] * 100),
                ]
            )
        )
    return "\n".join(lines)


def fmt(value: Any) -> str:
    number = float(value) if pd.notna(value) else math.nan
    return "" if not math.isfinite(number) else f"{number:.4f}"


def make_prompt(df: pd.DataFrame, index: int, lookback: int) -> dict[str, Any]:
    row = df.loc[index]
    window = df.iloc[index - lookback + 1 : index + 1].copy()
    labels = {
        f"future_return_{h}d": float(row[f"future_return_{h}d"])
        for h in HORIZONS
    }
    labels.update({f"future_up_{h}d": int(row[f"future_up_{h}d"]) for h in HORIZONS})
    prompt = f"""You are evaluating whether recent daily stock price action contains a short-term signal.

Task:
Predict the next 1, 3, and 5 trading-day direction and return for this stock.

Rules:
- Use only the historical table below.
- Do not give trading advice.
- Return only valid JSON.
- Probabilities must be between 0 and 1.
- Returns must be decimal returns, e.g. 0.01 means +1%.

Stock: {row["code"]}
As-of date: {row["date"].date()}
History window: last {lookback} trading days.

Historical features:
{compact_window(window)}

Return exactly this JSON shape:
{{
  "prob_up_1d": 0.50,
  "prob_up_3d": 0.50,
  "prob_up_5d": 0.50,
  "pred_return_1d": 0.0,
  "pred_return_3d": 0.0,
  "pred_return_5d": 0.0,
  "confidence": 0.0,
  "reason": "brief reason"
}}"""
    sample_id = f'{row["code"]}_{row["date"].date()}'
    return {
        "sample_id": sample_id,
        "code": row["code"],
        "asof_date": str(row["date"].date()),
        "prompt": prompt,
        "labels": labels,
    }


def build_samples(args: argparse.Namespace) -> list[dict[str, Any]]:
    samples = []
    for path in stock_files(args):
        df = read_stock(path)
        if len(df) < args.min_history + max(HORIZONS):
            continue
        for index in sample_indices(df, args):
            samples.append(make_prompt(df, index, args.lookback))
    return samples


def write_jsonl(path: Path, rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")


def slice_rows(rows: list[dict[str, Any]], offset: int = 0, limit: int = 0) -> list[dict[str, Any]]:
    sliced = rows[offset:] if offset else rows
    return sliced[:limit] if limit else sliced


def read_jsonl(path: Path, limit: int = 0, offset: int = 0) -> list[dict[str, Any]]:
    text = path.read_text(encoding="utf-8")
    stripped = text.lstrip()
    if stripped.startswith("[") or stripped.startswith("{"):
        try:
            data = json.loads(text)
            if isinstance(data, list):
                return slice_rows(data, offset, limit)
            if isinstance(data, dict) and "predictions" in data:
                rows = data["predictions"]
            else:
                rows = [data]
            return slice_rows(rows, offset, limit)
        except json.JSONDecodeError:
            pass
    rows = []
    for line in text.splitlines():
        if line.strip():
            rows.append(json.loads(line))
    return slice_rows(rows, offset, limit)


def baseline_prediction(sample: dict[str, Any]) -> dict[str, Any]:
    prompt = sample["prompt"]
    history = prompt.split("Historical features:\n", 1)[1].split("\n\nReturn exactly", 1)[0]
    rows = [line.split(",") for line in history.splitlines()[1:] if line.strip()]
    ret_5 = [float(row[3]) / 100 for row in rows if row[3]]
    recent = ret_5[-5:] if len(ret_5) >= 5 else ret_5
    momentum = float(np.nanmean(recent)) if recent else 0.0
    clipped = float(np.clip(momentum, -0.05, 0.05))
    prob = float(np.clip(0.5 + clipped * 2.0, 0.35, 0.65))
    return {
        "sample_id": sample["sample_id"],
        "prediction": {
            "prob_up_1d": prob,
            "prob_up_3d": prob,
            "prob_up_5d": prob,
            "pred_return_1d": clipped / 5,
            "pred_return_3d": clipped * 0.6,
            "pred_return_5d": clipped,
            "confidence": abs(prob - 0.5) * 2,
            "reason": "simple recent 5-day momentum baseline",
        },
    }


def extract_json(text: str) -> dict[str, Any]:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, flags=re.S)
        if not match:
            raise
        return json.loads(match.group(0))


def call_openai_compatible(prompt: str) -> dict[str, Any]:
    base_url = os.environ.get("LLM_BASE_URL", "https://api.openai.com/v1").rstrip("/")
    api_key = os.environ.get("LLM_API_KEY") or os.environ.get("OPENAI_API_KEY", "")
    model = os.environ.get("LLM_MODEL") or os.environ.get("OPENAI_MODEL") or "gpt-5-nano"
    if not api_key:
        raise RuntimeError("Set OPENAI_API_KEY or LLM_API_KEY before --mode predict.")
    payload = {
        "model": model,
        "temperature": 0,
        "messages": [
            {"role": "system", "content": "Return only valid JSON. Do not provide investment advice."},
            {"role": "user", "content": prompt},
        ],
    }
    request = urllib.request.Request(
        f"{base_url}/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            data = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"LLM API HTTP {exc.code}: {body}") from exc
    content = data["choices"][0]["message"]["content"]
    return extract_json(content)


def score_predictions(samples: list[dict[str, Any]], predictions: list[dict[str, Any]]) -> dict[str, Any]:
    by_id = {item["sample_id"]: item for item in samples}
    rows = []
    parse_failures = 0
    for item in predictions:
        sample = by_id.get(item.get("sample_id"))
        if not sample:
            continue
        pred = item.get("prediction", item)
        try:
            row = {"sample_id": sample["sample_id"], "code": sample["code"], "asof_date": sample["asof_date"]}
            for horizon in HORIZONS:
                row[f"actual_return_{horizon}d"] = sample["labels"][f"future_return_{horizon}d"]
                row[f"actual_up_{horizon}d"] = sample["labels"][f"future_up_{horizon}d"]
                row[f"pred_return_{horizon}d"] = float(pred[f"pred_return_{horizon}d"])
                row[f"prob_up_{horizon}d"] = float(pred[f"prob_up_{horizon}d"])
            rows.append(row)
        except Exception:
            parse_failures += 1
    df = pd.DataFrame(rows)
    metrics: dict[str, Any] = {
        "samples": len(samples),
        "predictions": len(predictions),
        "matched_valid_predictions": int(len(df)),
        "parse_failures": parse_failures,
        "per_horizon": {},
    }
    if df.empty:
        return metrics
    for horizon in HORIZONS:
        actual_return = df[f"actual_return_{horizon}d"]
        pred_return = df[f"pred_return_{horizon}d"]
        actual_up = df[f"actual_up_{horizon}d"]
        prob_up = df[f"prob_up_{horizon}d"]
        metrics["per_horizon"][f"{horizon}d"] = {
            "direction_accuracy": float(((prob_up >= 0.5).astype(int) == actual_up).mean()),
            "return_mae": float((pred_return - actual_return).abs().mean()),
            "rank_ic": rank_corr(pred_return, actual_return),
            "auc": auc_metric(actual_up, prob_up),
            "mean_pred_return": float(pred_return.mean()),
            "mean_actual_return": float(actual_return.mean()),
        }
    return metrics


def rank_corr(a: pd.Series, b: pd.Series) -> float | None:
    corr = pd.concat([a.rank(), b.rank()], axis=1).corr().iloc[0, 1]
    return None if pd.isna(corr) else float(corr)


def auc_metric(y_true: pd.Series, y_score: pd.Series) -> float | None:
    y = np.asarray(y_true).astype(int)
    score = np.asarray(y_score)
    pos = score[y == 1]
    neg = score[y == 0]
    if len(pos) == 0 or len(neg) == 0:
        return None
    ranks = pd.Series(score).rank(method="average").to_numpy()
    pos_rank_sum = ranks[y == 1].sum()
    return float((pos_rank_sum - len(pos) * (len(pos) + 1) / 2) / (len(pos) * len(neg)))


def write_metrics(path: Path, metrics: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(metrics, f, ensure_ascii=False, indent=2)


def write_batch_prompt(samples: list[dict[str, Any]], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    blocks = []
    for sample in samples:
        prompt = sample["prompt"]
        content = prompt.split("Historical features:\n", 1)[1].split("\n\nReturn exactly", 1)[0]
        blocks.append(
            f"""Sample ID: {sample["sample_id"]}
Stock: {sample["code"]}
As-of date: {sample["asof_date"]}
Historical features:
{content}"""
        )
    text = f"""你现在要做一个可评测实验：直接根据股票最近 30 个交易日的日线特征，预测未来 1/3/5 个交易日的涨跌概率和收益。

重要规则：
- 只使用每个样本给出的历史表格。
- 不要给买卖建议。
- 不要输出解释性段落。
- 只返回一个 JSON 数组。
- 数组里每个对象必须包含 sample_id 和 prediction。
- prob_up_* 是 0 到 1 的上涨概率。
- pred_return_* 是小数收益率，例如 0.01 表示 +1%。
- confidence 是 0 到 1。
- 不要简单追涨杀跌。遇到短期极端上涨、极端下跌、超高波动时，要考虑均值回归和反转风险。
- 如果走势信号不清楚，概率应该靠近 0.50，confidence 应该偏低。
- prediction 的方向和 pred_return 的正负要尽量一致。

返回格式必须严格像这样：
[
  {{
    "sample_id": "example_2024-01-02",
    "prediction": {{
      "prob_up_1d": 0.50,
      "prob_up_3d": 0.50,
      "prob_up_5d": 0.50,
      "pred_return_1d": 0.0,
      "pred_return_3d": 0.0,
      "pred_return_5d": 0.0,
      "confidence": 0.0,
      "reason": "简短理由"
    }}
  }}
]

下面是要预测的样本：

{"\n\n---\n\n".join(blocks)}
"""
    path.write_text(text, encoding="utf-8")


def main() -> None:
    load_env_file()
    args = parse_args()
    if args.mode == "export-prompts":
        samples = build_samples(args)
        write_jsonl(args.output_file, samples)
        print(f"Wrote {len(samples):,} prompt samples to {args.output_file}")
        return
    if args.mode == "export-batch-prompt":
        samples = read_jsonl(args.prompt_file, args.limit, args.offset)
        write_batch_prompt(samples, args.output_file)
        print(f"Wrote batch prompt with {len(samples):,} samples to {args.output_file}")
        return
    if args.mode == "baseline":
        samples = build_samples(args)
        predictions = [baseline_prediction(sample) for sample in samples]
        write_jsonl(args.output_file, predictions)
        metrics = score_predictions(samples, predictions)
        write_metrics(args.metrics_file, metrics)
        print(f"Wrote baseline predictions to {args.output_file}")
        print(f"Wrote metrics to {args.metrics_file}")
        return
    if args.mode == "predict":
        samples = read_jsonl(args.prompt_file, args.limit, args.offset)
        predictions = []
        for index, sample in enumerate(samples, start=1):
            prediction = call_openai_compatible(sample["prompt"])
            predictions.append({"sample_id": sample["sample_id"], "prediction": prediction})
            print(f"Predicted {index:,}/{len(samples):,}: {sample['sample_id']}")
            if args.sleep > 0:
                time.sleep(args.sleep)
        write_jsonl(args.output_file, predictions)
        print(f"Wrote LLM predictions to {args.output_file}")
        return
    if args.mode == "evaluate":
        samples = read_jsonl(args.prompt_file, args.limit, args.offset)
        predictions = read_jsonl(args.prediction_file, args.limit, args.offset)
        metrics = score_predictions(samples, predictions)
        write_metrics(args.metrics_file, metrics)
        print(f"Wrote metrics to {args.metrics_file}")


if __name__ == "__main__":
    main()
