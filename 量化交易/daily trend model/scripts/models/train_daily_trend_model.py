#!/usr/bin/env python3
"""
Train a short-horizon daily stock price trend model.

The model predicts future 1/3/5 trading-day returns and up probabilities from
daily price/volume features. It intentionally outputs trend scores only, not
trading instructions.
"""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

import numpy as np
import pandas as pd

try:
    from sklearn.ensemble import HistGradientBoostingClassifier, HistGradientBoostingRegressor
    from sklearn.linear_model import Ridge
    from sklearn.metrics import accuracy_score, mean_squared_error, r2_score, roc_auc_score
except ModuleNotFoundError:
    HistGradientBoostingClassifier = None
    HistGradientBoostingRegressor = None
    Ridge = None

try:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
except ModuleNotFoundError:
    plt = None


DEFAULT_DATA_ROOT = Path("/Users/lilongjiang/Desktop/量化交易/trading-data.20260522")
DEFAULT_OUTPUT_DIR = Path("results/model outputs/daily_trend_hgb_v1")
HORIZONS = (1, 3, 5)
FEATURES = [
    "ret_1d",
    "ret_2d",
    "ret_3d",
    "ret_5d",
    "ret_10d",
    "ret_20d",
    "intraday_range",
    "close_position",
    "gap_open",
    "vol_5d",
    "vol_20d",
    "vol_ratio_5_20",
    "ma_gap_5d",
    "ma_gap_10d",
    "ma_gap_20d",
    "ma_gap_60d",
    "money_chg_5d",
    "volume_chg_5d",
    "turnover",
    "turnover_5d_mean",
    "turnover_20d_mean",
    "turnover_chg_5_20",
    "log_money",
    "log_market_value",
    "market_ret_1d",
    "market_ret_5d",
    "market_ret_20d",
    "rel_ret_5d",
    "rel_ret_20d",
]


class NumpyRidge:
    def __init__(self, alpha: float = 5.0, probability: bool = False):
        self.alpha = alpha
        self.probability = probability
        self.coef_: np.ndarray | None = None

    def fit(self, x: np.ndarray, y: np.ndarray) -> "NumpyRidge":
        design = np.column_stack([np.ones(len(x)), x])
        penalty = np.eye(design.shape[1]) * self.alpha
        penalty[0, 0] = 0.0
        self.coef_ = np.linalg.solve(design.T @ design + penalty, design.T @ y)
        return self

    def predict(self, x: np.ndarray) -> np.ndarray:
        if self.coef_ is None:
            raise RuntimeError("Model has not been fitted.")
        design = np.column_stack([np.ones(len(x)), x])
        pred = design @ self.coef_
        if self.probability:
            return 1.0 / (1.0 + np.exp(-pred))
        return pred

    def predict_proba(self, x: np.ndarray) -> np.ndarray:
        pred = self.predict(x).clip(0.001, 0.999)
        return np.column_stack([1.0 - pred, pred])


def rmse(y_true: pd.Series, y_pred: pd.Series) -> float:
    return float(np.sqrt(np.mean((np.asarray(y_true) - np.asarray(y_pred)) ** 2)))


def r2_metric(y_true: pd.Series, y_pred: pd.Series) -> float:
    y = np.asarray(y_true)
    pred = np.asarray(y_pred)
    denom = np.sum((y - y.mean()) ** 2)
    return float(1.0 - np.sum((y - pred) ** 2) / denom) if denom else 0.0


def accuracy_metric(y_true: pd.Series, y_pred: pd.Series) -> float:
    return float((np.asarray(y_true).astype(int) == np.asarray(y_pred).astype(int)).mean())


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


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train daily price trend model.")
    parser.add_argument("--data-root", type=Path, default=DEFAULT_DATA_ROOT)
    parser.add_argument("--stock-dir", type=Path, default=None)
    parser.add_argument("--index-file", type=Path, default=None)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--test-start", default="2024-01-01")
    parser.add_argument("--model", choices=["ridge", "hgb"], default="hgb")
    parser.add_argument("--train-sample", type=int, default=1_200_000, help="0 means all rows.")
    parser.add_argument("--max-files", type=int, default=0, help="For quick tests; 0 means all stocks.")
    parser.add_argument("--active-days", type=int, default=10)
    parser.add_argument("--winsor", type=float, default=0.12)
    parser.add_argument("--zcap", type=float, default=5.0)
    parser.add_argument("--random-state", type=int, default=7)
    parser.add_argument("--hgb-max-iter", type=int, default=180)
    parser.add_argument("--hgb-learning-rate", type=float, default=0.045)
    parser.add_argument("--hgb-l2", type=float, default=0.08)
    return parser.parse_args()


def data_paths(args: argparse.Namespace) -> tuple[Path, Path]:
    stock_dir = args.stock_dir or args.data_root / "stock data"
    index_file = args.index_file or args.data_root / "index data" / "sh000001.csv"
    return stock_dir, index_file


def read_market_index(index_file: Path) -> pd.DataFrame:
    df = pd.read_csv(index_file, usecols=lambda col: col in {"date", "close"})
    df["date"] = pd.to_datetime(df["date"], errors="coerce")
    df["market_close"] = pd.to_numeric(df["close"], errors="coerce")
    df = df.dropna(subset=["date", "market_close"]).sort_values("date")
    df["market_ret_1d"] = df["market_close"].pct_change()
    df["market_ret_5d"] = df["market_close"].pct_change(5)
    df["market_ret_20d"] = df["market_close"].pct_change(20)
    return df[["date", "market_ret_1d", "market_ret_5d", "market_ret_20d"]]


def add_price_features(df: pd.DataFrame, market: pd.DataFrame) -> pd.DataFrame:
    out = df.sort_values("date").copy()
    price = out["adjust_price_f"]
    raw_close = out["close"].replace(0, np.nan)
    prev_close = raw_close.shift(1)
    returns = price.pct_change()

    for days in (1, 2, 3, 5, 10, 20):
        out[f"ret_{days}d"] = price.pct_change(days)
    out["intraday_range"] = (out["high"] - out["low"]) / raw_close
    out["close_position"] = (out["close"] - out["low"]) / (out["high"] - out["low"]).replace(0, np.nan)
    out["gap_open"] = out["open"] / prev_close - 1.0

    out["vol_5d"] = returns.rolling(5, min_periods=4).std() * np.sqrt(252)
    out["vol_20d"] = returns.rolling(20, min_periods=10).std() * np.sqrt(252)
    out["vol_ratio_5_20"] = out["vol_5d"] / out["vol_20d"] - 1.0
    for days in (5, 10, 20, 60):
        ma = price.rolling(days, min_periods=max(4, days // 2)).mean()
        out[f"ma_gap_{days}d"] = price / ma - 1.0

    money = out["money"].replace(0, np.nan)
    volume = out["volume"].replace(0, np.nan)
    out["money_chg_5d"] = money / money.shift(5) - 1.0
    out["volume_chg_5d"] = volume / volume.shift(5) - 1.0
    out["turnover_5d_mean"] = out["turnover"].rolling(5, min_periods=4).mean()
    out["turnover_20d_mean"] = out["turnover"].rolling(20, min_periods=10).mean()
    out["turnover_chg_5_20"] = out["turnover_5d_mean"] / out["turnover_20d_mean"] - 1.0
    out["log_money"] = np.where(out["money"] > 0, np.log1p(out["money"]), np.nan)
    out["log_market_value"] = np.where(out["market_value"] > 0, np.log1p(out["market_value"]), np.nan)

    out = out.merge(market, on="date", how="left")
    out["rel_ret_5d"] = out["ret_5d"] - out["market_ret_5d"]
    out["rel_ret_20d"] = out["ret_20d"] - out["market_ret_20d"]
    for horizon in HORIZONS:
        out[f"future_return_{horizon}d"] = price.shift(-horizon) / price - 1.0
        out[f"future_up_{horizon}d"] = (out[f"future_return_{horizon}d"] > 0).astype(float)
    return out


def read_stock_file(path: Path, market: pd.DataFrame, winsor: float) -> pd.DataFrame:
    required = {
        "code",
        "date",
        "open",
        "high",
        "low",
        "close",
        "volume",
        "money",
        "turnover",
        "market_value",
        "adjust_price_f",
        "PE_TTM",
        "PB",
    }
    try:
        df = pd.read_csv(path, usecols=lambda col: col in required)
    except Exception:
        return pd.DataFrame()
    if missing := [col for col in required if col not in df.columns]:
        return pd.DataFrame()

    df["date"] = pd.to_datetime(df["date"], errors="coerce")
    for col in required - {"code", "date"}:
        df[col] = pd.to_numeric(df[col], errors="coerce")
    df = df.dropna(subset=["code", "date", "adjust_price_f"]).sort_values("date")
    if len(df) < 90:
        return pd.DataFrame()

    out = add_price_features(df, market)
    for horizon in HORIZONS:
        if winsor > 0:
            out[f"future_return_{horizon}d"] = out[f"future_return_{horizon}d"].clip(-winsor, winsor)
    keep = ["code", "date", *FEATURES, *target_columns()]
    return out[keep].replace([np.inf, -np.inf], np.nan).dropna(subset=["code", "date", *FEATURES])


def target_columns() -> list[str]:
    cols = []
    for horizon in HORIZONS:
        cols.extend([f"future_return_{horizon}d", f"future_up_{horizon}d"])
    return cols


def load_panel(stock_dir: Path, market: pd.DataFrame, args: argparse.Namespace) -> pd.DataFrame:
    files = sorted(stock_dir.glob("*.csv"))
    if args.max_files:
        files = files[: args.max_files]
    frames = []
    for index, path in enumerate(files, start=1):
        frame = read_stock_file(path, market, args.winsor)
        if not frame.empty:
            frames.append(frame)
        if index % 500 == 0:
            print(f"Read {index:,}/{len(files):,} stock files; usable: {len(frames):,}")
    if not frames:
        raise RuntimeError("No usable stock CSV files found.")
    return pd.concat(frames, ignore_index=True)


def cross_sectional_zscore(df: pd.DataFrame, zcap: float) -> tuple[pd.DataFrame, list[str]]:
    out = df.copy()
    grouped = out.groupby("date", sort=False)
    z_features = []
    for feature in FEATURES:
        global_mean = out[feature].mean()
        global_std = out[feature].std()
        mean = grouped[feature].transform("mean")
        std = grouped[feature].transform("std").replace(0, np.nan)
        z_col = f"z_{feature}"
        out[z_col] = (out[feature] - mean) / std
        if global_std and not np.isnan(global_std):
            fallback = (out[feature] - global_mean) / global_std
            out[z_col] = out[z_col].fillna(fallback)
        if zcap > 0:
            out[z_col] = out[z_col].clip(-zcap, zcap)
        z_features.append(z_col)
    return out.dropna(subset=z_features), z_features


def fit_regressor(train: pd.DataFrame, z_features: list[str], target: str, args: argparse.Namespace):
    fit = train
    if args.train_sample and len(train) > args.train_sample:
        fit = train.sample(args.train_sample, random_state=args.random_state)
    if args.model == "ridge" or HistGradientBoostingRegressor is None:
        model = Ridge(alpha=5.0) if Ridge is not None else NumpyRidge(alpha=5.0)
    else:
        model = HistGradientBoostingRegressor(
            max_iter=args.hgb_max_iter,
            learning_rate=args.hgb_learning_rate,
            l2_regularization=args.hgb_l2,
            max_leaf_nodes=31,
            min_samples_leaf=80,
            early_stopping=True,
            validation_fraction=0.12,
            n_iter_no_change=18,
            random_state=args.random_state,
        )
    model.fit(fit[z_features].to_numpy(), fit[target].to_numpy())
    return model


def fit_classifier(train: pd.DataFrame, z_features: list[str], target: str, args: argparse.Namespace):
    fit = train.dropna(subset=[target])
    if args.train_sample and len(fit) > args.train_sample:
        fit = fit.sample(args.train_sample, random_state=args.random_state)
    if HistGradientBoostingClassifier is None:
        model = NumpyRidge(alpha=5.0, probability=True)
        model.fit(fit[z_features].to_numpy(), fit[target].astype(float).to_numpy())
        return model
    model = HistGradientBoostingClassifier(
        max_iter=max(80, args.hgb_max_iter // 2),
        learning_rate=args.hgb_learning_rate,
        l2_regularization=args.hgb_l2,
        max_leaf_nodes=31,
        min_samples_leaf=100,
        early_stopping=True,
        validation_fraction=0.12,
        n_iter_no_change=15,
        random_state=args.random_state,
    )
    model.fit(fit[z_features].to_numpy(), fit[target].astype(int).to_numpy())
    return model


def rank_ic_by_date(df: pd.DataFrame, pred_col: str, target_col: str) -> pd.DataFrame:
    rows = []
    for date, part in df.groupby("date"):
        if len(part) < 20:
            continue
        corr = part[[pred_col, target_col]].corr(method="spearman").iloc[0, 1]
        rows.append({"date": date, "rank_ic": corr, "n": len(part)})
    return pd.DataFrame(rows).dropna()


def group_returns(df: pd.DataFrame, pred_col: str, target_col: str, groups: int = 5) -> pd.DataFrame:
    rows = []
    for date, part in df.groupby("date"):
        if len(part) < groups * 10:
            continue
        ranked = part.copy()
        ranked["group"] = pd.qcut(ranked[pred_col].rank(method="first"), groups, labels=False) + 1
        for group, gpart in ranked.groupby("group"):
            rows.append({"date": date, "group": int(group), "mean_return": gpart[target_col].mean(), "n": len(gpart)})
    return pd.DataFrame(rows)


def add_predictions(df: pd.DataFrame, z_features: list[str], regressors: dict[int, object], classifiers: dict[int, object]) -> pd.DataFrame:
    out = df.copy()
    x = out[z_features].to_numpy()
    for horizon in HORIZONS:
        out[f"pred_return_{horizon}d"] = regressors[horizon].predict(x)
        if horizon in classifiers:
            out[f"prob_up_{horizon}d"] = classifiers[horizon].predict_proba(x)[:, 1]
        else:
            out[f"prob_up_{horizon}d"] = np.nan
    out["trend_raw"] = (
        out["prob_up_1d"] * 0.25
        + out["prob_up_3d"] * 0.35
        + out["prob_up_5d"] * 0.40
        + out["pred_return_5d"].rank(pct=True) * 0.15
    )
    return out


def latest_scores(predicted: pd.DataFrame, active_days: int) -> pd.DataFrame:
    latest_idx = predicted.groupby("code")["date"].idxmax()
    latest = predicted.loc[latest_idx].copy()
    max_date = predicted["date"].max()
    if active_days > 0:
        latest = latest[latest["date"] >= max_date - pd.Timedelta(days=active_days)]
    latest["trend_score"] = latest["trend_raw"].rank(pct=True) * 100
    latest["rank"] = latest["trend_score"].rank(ascending=False, method="first").astype(int)
    latest["rating"] = pd.cut(
        latest["trend_score"],
        bins=[-0.01, 20, 40, 60, 80, 100],
        labels=["弱", "偏弱", "中性", "偏强", "强"],
    ).astype(str)
    latest["confidence"] = (latest[["prob_up_1d", "prob_up_3d", "prob_up_5d"]].sub(0.5).abs().mean(axis=1) * 2).clip(0, 1)
    cols = [
        "code",
        "date",
        "rank",
        "trend_score",
        "rating",
        "confidence",
        "prob_up_1d",
        "prob_up_3d",
        "prob_up_5d",
        "pred_return_1d",
        "pred_return_3d",
        "pred_return_5d",
        "ret_5d",
        "ret_20d",
        "rel_ret_5d",
        "rel_ret_20d",
        "turnover",
        "log_money",
        "PE_TTM",
        "PB",
    ]
    cols = [col for col in cols if col in latest.columns]
    return latest[cols].sort_values(["trend_score", "pred_return_5d"], ascending=False)


def write_plots(output_dir: Path, ic: pd.DataFrame, groups: pd.DataFrame) -> None:
    if plt is None:
        return
    if not ic.empty:
        plt.figure(figsize=(10, 4))
        plt.plot(ic["date"], ic["rank_ic"], linewidth=1)
        plt.axhline(0, color="black", linewidth=0.8)
        plt.xlabel("Date")
        plt.ylabel("Rank IC")
        plt.title("Daily Rank IC, 5-day return target")
        plt.tight_layout()
        plt.savefig(output_dir / "rank_ic_timeseries.png", dpi=160)
        plt.close()

    if not groups.empty:
        summary = groups.groupby("group")["mean_return"].mean()
        plt.figure(figsize=(7, 4))
        plt.bar(summary.index.astype(str), summary.values)
        plt.xlabel("Prediction Quantile Group")
        plt.ylabel("Mean 5-day future return")
        plt.title("Average Return by Trend Group")
        plt.tight_layout()
        plt.savefig(output_dir / "group_returns.png", dpi=160)
        plt.close()


def main() -> None:
    args = parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    stock_dir, index_file = data_paths(args)
    market = read_market_index(index_file)
    raw = load_panel(stock_dir, market, args)
    print(f"Rows before z-score: {len(raw):,}")

    data, z_features = cross_sectional_zscore(raw, args.zcap)
    model_data = data.dropna(subset=[f"future_return_{h}d" for h in HORIZONS]).copy()
    test_start = pd.Timestamp(args.test_start)
    train = model_data[model_data["date"] < test_start].copy()
    test = model_data[model_data["date"] >= test_start].copy()
    if train.empty or test.empty:
        date_min = model_data["date"].min()
        date_max = model_data["date"].max()
        raise RuntimeError(
            "Train or test set is empty. "
            f"Available model dates: {date_min.date()} to {date_max.date()}. "
            f"Train rows: {len(train):,}; test rows: {len(test):,}. "
            "Adjust --test-start or use a broader stock sample."
        )

    regressors = {}
    classifiers = {}
    metrics = {
        "model": args.model,
        "features": FEATURES,
        "horizons": list(HORIZONS),
        "train_rows": int(len(train)),
        "test_rows": int(len(test)),
        "train_start": str(train["date"].min().date()),
        "train_end": str(train["date"].max().date()),
        "test_start": str(test["date"].min().date()),
        "test_end": str(test["date"].max().date()),
        "latest_data_date": str(data["date"].max().date()),
        "per_horizon": {},
    }

    for horizon in HORIZONS:
        return_col = f"future_return_{horizon}d"
        up_col = f"future_up_{horizon}d"
        regressors[horizon] = fit_regressor(train.dropna(subset=[return_col]), z_features, return_col, args)
        classifiers[horizon] = fit_classifier(train.dropna(subset=[up_col]), z_features, up_col, args)

    train_pred = add_predictions(train, z_features, regressors, classifiers)
    test_pred = add_predictions(test, z_features, regressors, classifiers)
    all_pred = add_predictions(data, z_features, regressors, classifiers)

    for horizon in HORIZONS:
        return_col = f"future_return_{horizon}d"
        pred_col = f"pred_return_{horizon}d"
        up_col = f"future_up_{horizon}d"
        prob_col = f"prob_up_{horizon}d"
        valid = test_pred.dropna(subset=[return_col, pred_col, up_col, prob_col])
        auc = auc_metric(valid[up_col], valid[prob_col])
        metrics["per_horizon"][f"{horizon}d"] = {
            "test_r2": r2_metric(valid[return_col], valid[pred_col]),
            "test_rmse": rmse(valid[return_col], valid[pred_col]),
            "direction_accuracy": accuracy_metric(valid[up_col], valid[prob_col] >= 0.5),
            "up_auc": auc,
        }

    ic = rank_ic_by_date(test_pred, "pred_return_5d", "future_return_5d")
    groups = group_returns(test_pred, "pred_return_5d", "future_return_5d")
    metrics["test_rank_ic_5d_mean"] = None if ic.empty else float(ic["rank_ic"].mean())
    metrics["test_rank_ic_5d_positive_rate"] = None if ic.empty else float((ic["rank_ic"] > 0).mean())
    if not groups.empty:
        group_summary = groups.groupby("group")["mean_return"].mean()
        metrics["group_5_minus_1_return_5d"] = float(group_summary.iloc[-1] - group_summary.iloc[0])

    latest = latest_scores(all_pred, args.active_days)
    latest.to_csv(args.output_dir / "latest_daily_trend_scores.csv", index=False)
    test_pred[
        [
            "code",
            "date",
            "future_return_1d",
            "future_return_3d",
            "future_return_5d",
            "prob_up_1d",
            "prob_up_3d",
            "prob_up_5d",
            "pred_return_1d",
            "pred_return_3d",
            "pred_return_5d",
        ]
    ].to_csv(args.output_dir / "test_predictions.csv", index=False)
    ic.to_csv(args.output_dir / "daily_ic.csv", index=False)
    groups.to_csv(args.output_dir / "group_returns.csv", index=False)
    with open(args.output_dir / "metrics.json", "w", encoding="utf-8") as f:
        json.dump(metrics, f, ensure_ascii=False, indent=2)
    with open(args.output_dir / "model_artifact.json", "w", encoding="utf-8") as f:
        json.dump(
            {
                "model": args.model,
                "features": FEATURES,
                "horizons": list(HORIZONS),
                "target": "future 1/3/5 trading-day return and up probability",
                "note": "Trend scores only; no buy/sell/position advice.",
            },
            f,
            ensure_ascii=False,
            indent=2,
        )
    write_plots(args.output_dir, ic, groups)
    print(f"Wrote daily trend outputs to: {args.output_dir}")


if __name__ == "__main__":
    main()
