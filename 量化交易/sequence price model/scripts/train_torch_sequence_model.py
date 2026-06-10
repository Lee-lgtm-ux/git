#!/usr/bin/env python3
"""
Train PyTorch sequence models for short-horizon stock price prediction.

Supported models:
- tcn: small temporal convolutional network, fast on CPU.
- transformer: compact Transformer encoder.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
import torch
from torch import nn
from torch.utils.data import DataLoader, TensorDataset

from train_sequence_price_model import DEFAULT_DATA_ROOT, FEATURES, HORIZONS, build_dataset


class TCNModel(nn.Module):
    def __init__(self, n_features: int, hidden: int, outputs: int, dropout: float):
        super().__init__()
        self.net = nn.Sequential(
            nn.Conv1d(n_features, hidden, kernel_size=5, padding=2),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Conv1d(hidden, hidden, kernel_size=5, padding=4, dilation=2),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Conv1d(hidden, hidden, kernel_size=3, padding=4, dilation=4),
            nn.GELU(),
            nn.AdaptiveAvgPool1d(1),
        )
        self.head = nn.Sequential(nn.Flatten(), nn.LayerNorm(hidden), nn.Linear(hidden, outputs))

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x: batch, lookback, features
        x = x.transpose(1, 2)
        return self.head(self.net(x))


class TransformerModel(nn.Module):
    def __init__(self, n_features: int, hidden: int, outputs: int, layers: int, heads: int, dropout: float, lookback: int):
        super().__init__()
        self.input = nn.Linear(n_features, hidden)
        self.pos = nn.Parameter(torch.zeros(1, lookback, hidden))
        encoder_layer = nn.TransformerEncoderLayer(
            d_model=hidden,
            nhead=heads,
            dim_feedforward=hidden * 3,
            dropout=dropout,
            activation="gelu",
            batch_first=True,
            norm_first=True,
        )
        self.encoder = nn.TransformerEncoder(encoder_layer, num_layers=layers)
        self.head = nn.Sequential(nn.LayerNorm(hidden), nn.Linear(hidden, outputs))

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = self.input(x) + self.pos[:, : x.shape[1], :]
        x = self.encoder(x)
        return self.head(x[:, -1, :])


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train PyTorch sequence price model.")
    parser.add_argument("--data-root", type=Path, default=DEFAULT_DATA_ROOT)
    parser.add_argument("--stock-dir", type=Path, default=None)
    parser.add_argument("--index-file", type=Path, default=None)
    parser.add_argument("--output-dir", type=Path, default=Path("results/model outputs/torch_tcn_quick"))
    parser.add_argument("--lookback", type=int, default=30)
    parser.add_argument("--test-start", default="2024-01-01")
    parser.add_argument("--max-files", type=int, default=0)
    parser.add_argument("--samples-per-stock", type=int, default=0)
    parser.add_argument("--train-sample", type=int, default=120_000)
    parser.add_argument("--winsor", type=float, default=0.18)
    parser.add_argument("--active-days", type=int, default=10)
    parser.add_argument("--random-state", type=int, default=7)
    parser.add_argument("--model", choices=["tcn", "transformer"], default="tcn")
    parser.add_argument("--epochs", type=int, default=10)
    parser.add_argument("--batch-size", type=int, default=512)
    parser.add_argument("--hidden", type=int, default=64)
    parser.add_argument("--layers", type=int, default=2)
    parser.add_argument("--heads", type=int, default=4)
    parser.add_argument("--dropout", type=float, default=0.15)
    parser.add_argument("--lr", type=float, default=0.001)
    parser.add_argument("--weight-decay", type=float, default=0.0001)
    return parser.parse_args()


def reshape_sequences(x_flat: np.ndarray, lookback: int) -> np.ndarray:
    return x_flat.reshape(len(x_flat), lookback, len(FEATURES)).astype("float32")


def standardize(train: np.ndarray, *others: np.ndarray) -> tuple[np.ndarray, list[np.ndarray], dict[str, Any]]:
    mean = train.reshape(-1, train.shape[-1]).mean(axis=0)
    std = train.reshape(-1, train.shape[-1]).std(axis=0)
    std[std == 0] = 1.0
    train_z = np.clip((train - mean) / std, -6.0, 6.0)
    other_z = [np.clip((arr - mean) / std, -6.0, 6.0) for arr in others]
    return train_z.astype("float32"), [arr.astype("float32") for arr in other_z], {"mean": mean.tolist(), "std": std.tolist()}


def target_transform(y: np.ndarray) -> np.ndarray:
    out = y.copy().astype("float32")
    for col in (0, 2, 4):
        out[:, col] = out[:, col] * 10.0
    return out


def inverse_predictions(pred: np.ndarray) -> np.ndarray:
    out = pred.copy()
    for ret_col, up_col in ((0, 1), (2, 3), (4, 5)):
        out[:, ret_col] = out[:, ret_col] / 10.0
        out[:, up_col] = 1.0 / (1.0 + np.exp(-np.clip(out[:, up_col], -20, 20)))
    return out


def loss_fn(pred: torch.Tensor, target: torch.Tensor) -> torch.Tensor:
    losses = []
    for ret_col, up_col in ((0, 1), (2, 3), (4, 5)):
        losses.append(nn.functional.smooth_l1_loss(pred[:, ret_col], target[:, ret_col]))
        losses.append(0.7 * nn.functional.binary_cross_entropy_with_logits(pred[:, up_col], target[:, up_col]))
    return sum(losses)


def rank_corr(a: np.ndarray, b: np.ndarray) -> float | None:
    corr = pd.DataFrame({"a": a, "b": b}).rank().corr().iloc[0, 1]
    return None if pd.isna(corr) else float(corr)


def auc_metric(y_true: np.ndarray, y_score: np.ndarray) -> float | None:
    y = y_true.astype(int)
    pos = y_score[y == 1]
    neg = y_score[y == 0]
    if len(pos) == 0 or len(neg) == 0:
        return None
    ranks = pd.Series(y_score).rank(method="average").to_numpy()
    pos_rank_sum = ranks[y == 1].sum()
    return float((pos_rank_sum - len(pos) * (len(pos) + 1) / 2) / (len(pos) * len(neg)))


def score(y: np.ndarray, pred: np.ndarray) -> dict[str, Any]:
    metrics: dict[str, Any] = {"rows": int(len(y)), "per_horizon": {}}
    for h_index, horizon in enumerate(HORIZONS):
        ret_col = h_index * 2
        up_col = ret_col + 1
        actual_return = y[:, ret_col]
        actual_up = y[:, up_col]
        pred_return = pred[:, ret_col]
        prob_up = pred[:, up_col]
        metrics["per_horizon"][f"{horizon}d"] = {
            "direction_accuracy": float(((prob_up >= 0.5).astype(int) == actual_up.astype(int)).mean()),
            "return_mae": float(np.abs(pred_return - actual_return).mean()),
            "rank_ic": rank_corr(pred_return, actual_return),
            "auc": auc_metric(actual_up, prob_up),
            "mean_pred_return": float(pred_return.mean()),
            "mean_actual_return": float(actual_return.mean()),
        }
    return metrics


def predict_np(model: nn.Module, x: np.ndarray, batch_size: int, device: torch.device) -> np.ndarray:
    model.eval()
    preds = []
    with torch.no_grad():
        for start in range(0, len(x), batch_size):
            xb = torch.from_numpy(x[start : start + batch_size]).to(device)
            preds.append(model(xb).cpu().numpy())
    return inverse_predictions(np.vstack(preds))


def add_predictions(meta: pd.DataFrame, y: np.ndarray, pred: np.ndarray) -> pd.DataFrame:
    out = meta.copy()
    for h_index, horizon in enumerate(HORIZONS):
        ret_col = h_index * 2
        up_col = ret_col + 1
        out[f"actual_return_{horizon}d"] = y[:, ret_col]
        out[f"actual_up_{horizon}d"] = y[:, up_col]
        out[f"pred_return_{horizon}d"] = pred[:, ret_col]
        out[f"prob_up_{horizon}d"] = pred[:, up_col]
    return out


def latest_scores(pred_df: pd.DataFrame, active_days: int) -> pd.DataFrame:
    idx = pred_df.groupby("code")["date"].idxmax()
    latest = pred_df.loc[idx].copy()
    max_date = pred_df["date"].max()
    if active_days > 0:
        latest = latest[latest["date"] >= max_date - pd.Timedelta(days=active_days)]
    latest["sequence_score"] = latest["prob_up_5d"].rank(pct=True) * 65 + latest["pred_return_5d"].rank(pct=True) * 35
    latest["rank"] = latest["sequence_score"].rank(ascending=False, method="first").astype(int)
    latest["rating"] = pd.cut(
        latest["sequence_score"],
        bins=[-0.01, 20, 40, 60, 80, 100],
        labels=["弱", "偏弱", "中性", "偏强", "强"],
    ).astype(str)
    return latest.sort_values("sequence_score", ascending=False)


def main() -> None:
    args = parse_args()
    torch.manual_seed(args.random_state)
    np.random.seed(args.random_state)
    args.output_dir.mkdir(parents=True, exist_ok=True)
    meta, x_flat, y = build_dataset(args)
    x = reshape_sequences(x_flat, args.lookback)
    test_start = pd.Timestamp(args.test_start)
    train_mask = meta["date"] < test_start
    test_mask = meta["date"] >= test_start
    if not train_mask.any() or not test_mask.any():
        raise RuntimeError("Train/test split failed.")
    train_idx = np.where(train_mask.to_numpy())[0]
    rng = np.random.default_rng(args.random_state)
    if args.train_sample and len(train_idx) > args.train_sample:
        train_idx = rng.choice(train_idx, size=args.train_sample, replace=False)
    test_idx = np.where(test_mask.to_numpy())[0]
    all_idx = np.arange(len(x))

    x_train, [x_test, x_all], x_stats = standardize(x[train_idx], x[test_idx], x[all_idx])
    y_train = target_transform(y[train_idx])
    device = torch.device("cpu")
    if args.model == "tcn":
        model = TCNModel(len(FEATURES), args.hidden, y.shape[1], args.dropout)
    else:
        model = TransformerModel(len(FEATURES), args.hidden, y.shape[1], args.layers, args.heads, args.dropout, args.lookback)
    model.to(device)

    loader = DataLoader(
        TensorDataset(torch.from_numpy(x_train), torch.from_numpy(y_train)),
        batch_size=args.batch_size,
        shuffle=True,
    )
    optimizer = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=args.weight_decay)
    history = []
    for epoch in range(1, args.epochs + 1):
        model.train()
        losses = []
        for xb, yb in loader:
            xb = xb.to(device)
            yb = yb.to(device)
            optimizer.zero_grad(set_to_none=True)
            pred = model(xb)
            loss = loss_fn(pred, yb)
            loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()
            losses.append(float(loss.detach().cpu()))
        mean_loss = float(np.mean(losses))
        history.append({"epoch": epoch, "loss": mean_loss})
        print(f"epoch {epoch}/{args.epochs} loss={mean_loss:.5f}")

    train_pred = predict_np(model, x_train, args.batch_size, device)
    test_pred = predict_np(model, x_test, args.batch_size, device)
    all_pred = predict_np(model, x_all, args.batch_size, device)
    metrics = {
        "model": args.model,
        "lookback": args.lookback,
        "features": FEATURES,
        "epochs": args.epochs,
        "train_rows": int(len(train_idx)),
        "test_rows": int(len(test_idx)),
        "train_start": str(meta.iloc[train_idx]["date"].min().date()),
        "train_end": str(meta.iloc[train_idx]["date"].max().date()),
        "test_start": str(meta.iloc[test_idx]["date"].min().date()),
        "test_end": str(meta.iloc[test_idx]["date"].max().date()),
        "history": history,
        "train": score(y[train_idx], train_pred),
        "test": score(y[test_idx], test_pred),
    }
    test_df = add_predictions(meta.iloc[test_idx].reset_index(drop=True), y[test_idx], test_pred)
    all_df = add_predictions(meta.reset_index(drop=True), y, all_pred)
    latest = latest_scores(all_df, args.active_days)
    test_df.to_csv(args.output_dir / "test_predictions.csv", index=False)
    latest.to_csv(args.output_dir / "latest_sequence_scores.csv", index=False)
    with open(args.output_dir / "metrics.json", "w", encoding="utf-8") as f:
        json.dump(metrics, f, ensure_ascii=False, indent=2)
    with open(args.output_dir / "model_artifact.json", "w", encoding="utf-8") as f:
        json.dump(
            {
                "model": args.model,
                "lookback": args.lookback,
                "features": FEATURES,
                "horizons": list(HORIZONS),
                "x_stats": x_stats,
                "model_config": {
                    "hidden": args.hidden,
                    "layers": args.layers,
                    "heads": args.heads,
                    "dropout": args.dropout,
                    "outputs": int(y.shape[1]),
                },
                "training_config": {
                    "epochs": args.epochs,
                    "batch_size": args.batch_size,
                    "max_files": args.max_files,
                    "samples_per_stock": args.samples_per_stock,
                    "train_sample": args.train_sample,
                    "test_start": args.test_start,
                },
            },
            f,
            ensure_ascii=False,
            indent=2,
        )
    torch.save(model.state_dict(), args.output_dir / "model.pt")
    print(f"Wrote torch sequence model outputs to: {args.output_dir}")


if __name__ == "__main__":
    main()
