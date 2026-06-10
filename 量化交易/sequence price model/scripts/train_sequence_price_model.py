#!/usr/bin/env python3
"""
Train a numpy-only daily price sequence model.

The model consumes a rolling lookback window of daily price/volume features and
predicts future 1/3/5-day returns and up probabilities. It is intended as a
sequence baseline before adding PyTorch Transformer/TCN/Mamba variants.
"""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd


DEFAULT_DATA_ROOT = Path("/Users/lilongjiang/Desktop/量化交易/trading-data.20260522")
HORIZONS = (1, 3, 5)
FEATURES = [
    "ret_1d",
    "ret_2d",
    "ret_3d",
    "ret_5d",
    "range_pct",
    "close_position",
    "gap_open",
    "turnover",
    "turnover_chg_5d",
    "money_chg_5d",
    "log_money",
    "vol_5d",
    "vol_20d",
    "ma_gap_5d",
    "ma_gap_20d",
    "market_ret_1d",
    "market_ret_5d",
    "rel_ret_5d",
]
REQUIRED_STOCK_COLS = {
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


class MultiOutputRidge:
    def __init__(self, alpha: float = 25.0):
        self.alpha = alpha
        self.coef_: np.ndarray | None = None

    def fit(self, x: np.ndarray, y: np.ndarray) -> "MultiOutputRidge":
        design = np.column_stack([np.ones(len(x)), x])
        penalty = np.eye(design.shape[1]) * self.alpha
        penalty[0, 0] = 0.0
        self.coef_ = np.linalg.solve(design.T @ design + penalty, design.T @ y)
        return self

    def predict(self, x: np.ndarray) -> np.ndarray:
        if self.coef_ is None:
            raise RuntimeError("Model is not fitted.")
        design = np.column_stack([np.ones(len(x)), x])
        return design @ self.coef_


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train daily sequence price model.")
    parser.add_argument("--data-root", type=Path, default=DEFAULT_DATA_ROOT)
    parser.add_argument("--stock-dir", type=Path, default=None)
    parser.add_argument("--index-file", type=Path, default=None)
    parser.add_argument("--output-dir", type=Path, default=Path("results/model outputs/sequence_ridge_v1"))
    parser.add_argument("--lookback", type=int, default=30)
    parser.add_argument("--test-start", default="2024-01-01")
    parser.add_argument("--max-files", type=int, default=0)
    parser.add_argument(
        "--file-sample-mode",
        choices=["sorted", "stratified"],
        default="stratified",
        help="stratified samples stock files across bj/sh/sz prefixes; sorted keeps old filename order.",
    )
    parser.add_argument("--samples-per-stock", type=int, default=0, help="0 means use all eligible windows.")
    parser.add_argument("--train-sample", type=int, default=300_000, help="0 means all training windows.")
    parser.add_argument("--alpha", type=float, default=25.0)
    parser.add_argument("--winsor", type=float, default=0.18)
    parser.add_argument("--active-days", type=int, default=10)
    parser.add_argument("--random-state", type=int, default=7)
    return parser.parse_args()


def read_market(index_file: Path) -> pd.DataFrame:
    df = pd.read_csv(index_file, usecols=lambda col: col in {"date", "close"})
    df["date"] = pd.to_datetime(df["date"], errors="coerce")
    df["market_close"] = pd.to_numeric(df["close"], errors="coerce")
    df = df.dropna(subset=["date", "market_close"]).sort_values("date")
    df["market_ret_1d"] = df["market_close"].pct_change()
    df["market_ret_5d"] = df["market_close"].pct_change(5)
    return df[["date", "market_ret_1d", "market_ret_5d"]]


def read_stock(path: Path, market: pd.DataFrame, winsor: float) -> pd.DataFrame:
    try:
        df = pd.read_csv(path, usecols=lambda col: col in REQUIRED_STOCK_COLS)
    except Exception:
        return pd.DataFrame()
    if any(col not in df.columns for col in REQUIRED_STOCK_COLS):
        return pd.DataFrame()
    df["date"] = pd.to_datetime(df["date"], errors="coerce")
    for col in REQUIRED_STOCK_COLS - {"code", "date"}:
        df[col] = pd.to_numeric(df[col], errors="coerce")
    df = df.dropna(subset=["code", "date", "adjust_price_f"]).sort_values("date").reset_index(drop=True)
    if len(df) < 100:
        return pd.DataFrame()

    price = df["adjust_price_f"]
    raw_close = df["close"].replace(0, np.nan)
    returns = price.pct_change()
    for days in (1, 2, 3, 5):
        df[f"ret_{days}d"] = price.pct_change(days)
    df["range_pct"] = (df["high"] - df["low"]) / raw_close
    df["close_position"] = (df["close"] - df["low"]) / (df["high"] - df["low"]).replace(0, np.nan)
    df["gap_open"] = df["open"] / raw_close.shift(1) - 1.0
    df["turnover_chg_5d"] = df["turnover"] / df["turnover"].shift(5).replace(0, np.nan) - 1.0
    df["money_chg_5d"] = df["money"] / df["money"].shift(5).replace(0, np.nan) - 1.0
    df["log_money"] = np.where(df["money"] > 0, np.log1p(df["money"]), np.nan)
    df["vol_5d"] = returns.rolling(5, min_periods=4).std() * np.sqrt(252)
    df["vol_20d"] = returns.rolling(20, min_periods=10).std() * np.sqrt(252)
    for days in (5, 20):
        ma = price.rolling(days, min_periods=max(4, days // 2)).mean()
        df[f"ma_gap_{days}d"] = price / ma - 1.0
    df = df.merge(market, on="date", how="left")
    df["rel_ret_5d"] = df["ret_5d"] - df["market_ret_5d"]
    for horizon in HORIZONS:
        df[f"future_return_{horizon}d"] = (price.shift(-horizon) / price - 1.0).clip(-winsor, winsor)
        df[f"future_up_{horizon}d"] = (df[f"future_return_{horizon}d"] > 0).astype(float)
    return df.replace([np.inf, -np.inf], np.nan)


def window_to_vector(window: pd.DataFrame) -> np.ndarray:
    values = window[FEATURES].to_numpy(dtype=float)
    med = np.nanmedian(values, axis=0)
    med = np.nan_to_num(med, nan=0.0, posinf=0.0, neginf=0.0)
    values = np.where(np.isnan(values), med, values)
    values = np.nan_to_num(values, nan=0.0, posinf=0.0, neginf=0.0)
    mean = values.mean(axis=0)
    std = values.std(axis=0)
    std[std == 0] = 1.0
    values = np.clip((values - mean) / std, -6.0, 6.0)
    return values.reshape(-1)


def build_dataset(args: argparse.Namespace) -> tuple[pd.DataFrame, np.ndarray, np.ndarray]:
    stock_dir = args.stock_dir or args.data_root / "stock data"
    index_file = args.index_file or args.data_root / "index data" / "sh000001.csv"
    market = read_market(index_file)
    files = select_stock_files(stock_dir, args.max_files, args.file_sample_mode, args.random_state)

    rng = np.random.default_rng(args.random_state)
    meta_rows: list[dict[str, Any]] = []
    x_rows: list[np.ndarray] = []
    y_rows: list[list[float]] = []
    for file_index, path in enumerate(files, start=1):
        df = read_stock(path, market, args.winsor)
        if df.empty:
            continue
        eligible = df.index[
            (df.index >= args.lookback - 1)
            & (df.index < len(df) - max(HORIZONS))
            & df[FEATURES].notna().sum(axis=1).ge(len(FEATURES) - 2)
        ].to_numpy()
        if args.samples_per_stock and len(eligible) > args.samples_per_stock:
            eligible = np.sort(rng.choice(eligible, size=args.samples_per_stock, replace=False))
        for idx in eligible:
            window = df.iloc[idx - args.lookback + 1 : idx + 1]
            if window[FEATURES].notna().sum().sum() < args.lookback * (len(FEATURES) - 4):
                continue
            row = df.loc[idx]
            target = []
            valid = True
            for horizon in HORIZONS:
                ret = row[f"future_return_{horizon}d"]
                up = row[f"future_up_{horizon}d"]
                if pd.isna(ret) or pd.isna(up):
                    valid = False
                    break
                target.extend([float(ret), float(up)])
            if not valid:
                continue
            x_rows.append(window_to_vector(window))
            y_rows.append(target)
            meta_rows.append({"code": row["code"], "date": row["date"]})
        if file_index % 500 == 0:
            print(f"Processed {file_index:,}/{len(files):,} files; windows: {len(x_rows):,}")
    if not x_rows:
        raise RuntimeError("No usable sequence windows found.")
    meta = pd.DataFrame(meta_rows)
    return meta, np.vstack(x_rows), np.asarray(y_rows, dtype=float)


def select_stock_files(stock_dir: Path, max_files: int, mode: str, random_state: int) -> list[Path]:
    files = sorted(stock_dir.glob("*.csv"))
    if not max_files:
        return files
    if mode == "sorted":
        return files[:max_files]

    rng = np.random.default_rng(random_state)
    groups: dict[str, list[Path]] = {}
    for path in files:
        groups.setdefault(path.stem[:2], []).append(path)
    prefixes = sorted(groups)
    base = max_files // len(prefixes)
    remainder = max_files % len(prefixes)
    selected: list[Path] = []
    leftovers: list[Path] = []
    for index, prefix in enumerate(prefixes):
        group = groups[prefix]
        take = min(len(group), base + (1 if index < remainder else 0))
        chosen_idx = set(rng.choice(len(group), size=take, replace=False).tolist()) if take else set()
        selected.extend(group[i] for i in sorted(chosen_idx))
        leftovers.extend(path for i, path in enumerate(group) if i not in chosen_idx)
    if len(selected) < max_files and leftovers:
        take = min(max_files - len(selected), len(leftovers))
        extra_idx = rng.choice(len(leftovers), size=take, replace=False)
        selected.extend(leftovers[i] for i in sorted(extra_idx))
    return sorted(selected)


def fit_standardized_ridge(x_train: np.ndarray, y_train: np.ndarray, alpha: float) -> tuple[MultiOutputRidge, dict[str, list[float]]]:
    mean = x_train.mean(axis=0)
    std = x_train.std(axis=0)
    std[std == 0] = 1.0
    xz = np.clip((x_train - mean) / std, -6.0, 6.0)
    model = MultiOutputRidge(alpha=alpha).fit(xz, y_train)
    return model, {"mean": mean.tolist(), "std": std.tolist()}


def predict(model: MultiOutputRidge, stats: dict[str, list[float]], x: np.ndarray) -> np.ndarray:
    mean = np.asarray(stats["mean"])
    std = np.asarray(stats["std"])
    xz = np.clip((x - mean) / std, -6.0, 6.0)
    pred = model.predict(xz)
    for index in (1, 3, 5):
        pred[:, index] = sigmoid(pred[:, index])
    return pred


def sigmoid(x: np.ndarray) -> np.ndarray:
    return 1.0 / (1.0 + np.exp(-np.clip(x, -20, 20)))


def rank_corr(a: np.ndarray, b: np.ndarray) -> float | None:
    if len(a) < 3:
        return None
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


def score(meta: pd.DataFrame, y: np.ndarray, pred: np.ndarray) -> dict[str, Any]:
    metrics: dict[str, Any] = {"rows": int(len(meta)), "per_horizon": {}}
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
    latest["sequence_score"] = (
        latest["prob_up_5d"].rank(pct=True) * 65
        + latest["pred_return_5d"].rank(pct=True) * 35
    )
    latest["rank"] = latest["sequence_score"].rank(ascending=False, method="first").astype(int)
    latest["rating"] = pd.cut(
        latest["sequence_score"],
        bins=[-0.01, 20, 40, 60, 80, 100],
        labels=["弱", "偏弱", "中性", "偏强", "强"],
    ).astype(str)
    return latest.sort_values("sequence_score", ascending=False)


def main() -> None:
    args = parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    meta, x, y = build_dataset(args)
    test_start = pd.Timestamp(args.test_start)
    train_mask = meta["date"] < test_start
    test_mask = meta["date"] >= test_start
    if not train_mask.any() or not test_mask.any():
        raise RuntimeError(
            f"Train/test split failed. Date range: {meta['date'].min().date()} to {meta['date'].max().date()}."
        )
    train_idx = np.where(train_mask.to_numpy())[0]
    rng = np.random.default_rng(args.random_state)
    if args.train_sample and len(train_idx) > args.train_sample:
        train_idx = rng.choice(train_idx, size=args.train_sample, replace=False)
    test_idx = np.where(test_mask.to_numpy())[0]

    model, stats = fit_standardized_ridge(x[train_idx], y[train_idx], args.alpha)
    train_pred = predict(model, stats, x[train_idx])
    test_pred = predict(model, stats, x[test_idx])
    all_pred = predict(model, stats, x)

    train_metrics = score(meta.iloc[train_idx], y[train_idx], train_pred)
    test_metrics = score(meta.iloc[test_idx], y[test_idx], test_pred)
    metrics = {
        "model": "sequence_ridge",
        "lookback": args.lookback,
        "features": FEATURES,
        "train_rows": int(len(train_idx)),
        "test_rows": int(len(test_idx)),
        "train_start": str(meta.iloc[train_idx]["date"].min().date()),
        "train_end": str(meta.iloc[train_idx]["date"].max().date()),
        "test_start": str(meta.iloc[test_idx]["date"].min().date()),
        "test_end": str(meta.iloc[test_idx]["date"].max().date()),
        "train": train_metrics,
        "test": test_metrics,
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
                "model": "sequence_ridge",
                "lookback": args.lookback,
                "features": FEATURES,
                "horizons": list(HORIZONS),
                "target_layout": ["return_1d", "up_1d", "return_3d", "up_3d", "return_5d", "up_5d"],
            },
            f,
            ensure_ascii=False,
            indent=2,
        )
    print(f"Wrote sequence model outputs to: {args.output_dir}")


if __name__ == "__main__":
    main()
