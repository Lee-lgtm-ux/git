#!/usr/bin/env python3
"""
Train a cross-sectional A-share return model from per-stock CSV files.

The model uses factor values on date t to predict future N-day returns.
Outputs are written to ./model_outputs by default.
"""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression, Ridge
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.metrics import mean_squared_error, r2_score


DEFAULT_DATA_DIR = Path("/Users/lilongjiang/Desktop/量化交易/trading-data.20260522/stock data")
DEFAULT_FEATURES = ["turnover", "PE_TTM", "PS_TTM", "PC_TTM", "PB", "log_market_value", "log_money"]
GROWTH_FEATURES = [
    "turnover",
    "log_money",
    "PE_TTM",
    "PS_TTM",
    "PC_TTM",
    "PB",
    "mom_60d",
    "mom_120d",
    "mom_250d",
    "vol_60d",
    "drawdown_250d",
    "ma_gap_250d",
    "turnover_60d_mean",
    "turnover_change_20_120",
    "log_money_60d_mean",
    "pe_change_250d",
    "ps_change_250d",
    "pb_change_250d",
]
RECOVERY_FEATURES = [
    "turnover",
    "log_money",
    "PE_TTM",
    "PS_TTM",
    "PC_TTM",
    "PB",
    "mom_20d",
    "mom_60d",
    "mom_120d",
    "vol_60d",
    "vol_ratio_60_250",
    "drawdown_250d",
    "drawdown_750d",
    "low_rebound_60d",
    "ma_gap_60d",
    "ma_gap_120d",
    "turnover_60d_mean",
    "log_money_60d_mean",
    "pe_to_median_750d",
    "ps_to_median_750d",
    "pb_to_median_750d",
    "pe_position_750d",
    "ps_position_750d",
    "pb_position_750d",
]
RECOVERY_LIGHT_FEATURES = [
    "turnover",
    "log_money",
    "PE_TTM",
    "PS_TTM",
    "PC_TTM",
    "PB",
    "mom_20d",
    "mom_60d",
    "mom_120d",
    "vol_60d",
    "vol_ratio_60_250",
    "drawdown_250d",
    "low_rebound_60d",
    "ma_gap_60d",
    "ma_gap_120d",
    "turnover_60d_mean",
    "log_money_60d_mean",
    "pe_change_250d",
    "ps_change_250d",
    "pb_change_250d",
]
QUALITY_GROWTH_FEATURES = [
    "turnover",
    "log_money",
    "PE_TTM",
    "PS_TTM",
    "PB",
    "mom_60d",
    "mom_120d",
    "mom_250d",
    "vol_60d",
    "drawdown_250d",
    "ma_gap_250d",
    "turnover_60d_mean",
    "log_money_60d_mean",
    "pe_change_250d",
    "pb_change_250d",
    "quality_value_index_weighted_avg_roe",
    "quality_value_index_full_diluted_roe",
    "quality_value_sale_gross_margin",
    "quality_value_sale_net_interest_ratio",
    "quality_value_assets_debt_ratio",
    "quality_value_index_per_operating_cash_flow_net",
    "quality_value_calculate_operating_income_total_yoy_growth_ratio",
    "quality_value_calculate_parent_holder_net_profit_yoy_growth_ratio",
    "quality_value_deduct_net_profit_yoy_growth_ratio",
    "quality_single_yoy_operating_income_total",
    "quality_single_yoy_parent_holder_net_profit",
    "quality_yoy_sale_gross_margin",
    "quality_yoy_assets_debt_ratio",
]
FEATURE_PRESETS = {
    "value": DEFAULT_FEATURES,
    "growth": GROWTH_FEATURES,
    "recovery": RECOVERY_FEATURES,
    "recovery_light": RECOVERY_LIGHT_FEATURES,
    "quality_growth": QUALITY_GROWTH_FEATURES,
}
ENGINEERED_FEATURE_SOURCES = {
    "log_market_value": "market_value",
    "log_traded_market_value": "traded_market_value",
    "log_money": "money",
    "log_volume": "volume",
}
ROLLING_FEATURE_SOURCES = {
    "mom_20d": "adjust_price_f",
    "mom_60d": "adjust_price_f",
    "mom_120d": "adjust_price_f",
    "mom_250d": "adjust_price_f",
    "vol_20d": "adjust_price_f",
    "vol_60d": "adjust_price_f",
    "vol_120d": "adjust_price_f",
    "vol_ratio_60_250": "adjust_price_f",
    "drawdown_250d": "adjust_price_f",
    "drawdown_750d": "adjust_price_f",
    "low_rebound_60d": "adjust_price_f",
    "ma_gap_60d": "adjust_price_f",
    "ma_gap_120d": "adjust_price_f",
    "ma_gap_250d": "adjust_price_f",
    "turnover_20d_mean": "turnover",
    "turnover_60d_mean": "turnover",
    "turnover_change_20_120": "turnover",
    "log_money_20d_mean": "money",
    "log_money_60d_mean": "money",
    "pe_change_250d": "PE_TTM",
    "ps_change_250d": "PS_TTM",
    "pb_change_250d": "PB",
    "pe_to_median_750d": "PE_TTM",
    "ps_to_median_750d": "PS_TTM",
    "pb_to_median_750d": "PB",
    "pe_position_750d": "PE_TTM",
    "ps_position_750d": "PS_TTM",
    "pb_position_750d": "PB",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train an all-market stock return model.")
    parser.add_argument("--data-dir", type=Path, default=DEFAULT_DATA_DIR)
    parser.add_argument("--data-file", type=Path, default=None, help="Optional panel CSV, e.g. quality_dataset/daily_quality_asof.csv.")
    parser.add_argument("--output-dir", type=Path, default=Path("model_outputs"))
    parser.add_argument("--horizon", type=int, default=20, help="Future return horizon in trading days.")
    parser.add_argument("--test-start", default="2024-01-01", help="Dates >= this value are test set.")
    parser.add_argument("--winsor", type=float, default=0.30, help="Clip target returns to +/- this value.")
    parser.add_argument("--zcap", type=float, default=5.0, help="Clip cross-sectional factor z-scores to +/- this value.")
    parser.add_argument("--active-days", type=int, default=10, help="Only latest predictions within this many calendar days of the latest data date.")
    parser.add_argument("--long-term-score", action="store_true", help="Write percentile scores and linear contribution explanations.")
    parser.add_argument("--model", choices=["linear", "ridge", "hgb"], default="hgb")
    parser.add_argument("--ridge-alpha", type=float, default=1.0)
    parser.add_argument("--hgb-max-iter", type=int, default=220)
    parser.add_argument("--hgb-learning-rate", type=float, default=0.04)
    parser.add_argument("--hgb-l2", type=float, default=0.1)
    parser.add_argument("--train-sample", type=int, default=1_500_000, help="Training rows for nonlinear models; 0 means all.")
    parser.add_argument("--random-state", type=int, default=7)
    parser.add_argument("--feature-preset", choices=sorted(FEATURE_PRESETS), default="", help="Use a built-in feature list unless --features is set.")
    parser.add_argument("--features", nargs="+", default=None)
    parser.add_argument("--max-files", type=int, default=0, help="For quick tests; 0 means all files.")
    args = parser.parse_args()
    if args.features is None:
        args.features = FEATURE_PRESETS[args.feature_preset or "value"]
    return args


def read_stock_file(path: Path, features: list[str], horizon: int, winsor: float) -> pd.DataFrame:
    raw_features = [
        feature
        for feature in features
        if feature not in ENGINEERED_FEATURE_SOURCES and feature not in ROLLING_FEATURE_SOURCES
    ]
    engineered_sources = [ENGINEERED_FEATURE_SOURCES[feature] for feature in features if feature in ENGINEERED_FEATURE_SOURCES]
    rolling_sources = [ROLLING_FEATURE_SOURCES[feature] for feature in features if feature in ROLLING_FEATURE_SOURCES]
    required = list(dict.fromkeys(["code", "date", "adjust_price_f", *raw_features, *engineered_sources, *rolling_sources]))
    try:
        df = pd.read_csv(path, usecols=lambda col: col in required)
    except Exception:
        return pd.DataFrame()

    missing = [col for col in required if col not in df.columns]
    if missing:
        return pd.DataFrame()

    df["date"] = pd.to_datetime(df["date"], errors="coerce")
    df = df.sort_values("date")
    for col in list(dict.fromkeys(["adjust_price_f", *raw_features, *engineered_sources, *rolling_sources])):
        df[col] = pd.to_numeric(df[col], errors="coerce")
    for feature in features:
        source = ENGINEERED_FEATURE_SOURCES.get(feature)
        if source:
            df[feature] = np.where(df[source] > 0, np.log1p(df[source]), np.nan)
    add_rolling_features(df, features)

    df["future_return"] = df["adjust_price_f"].shift(-horizon) / df["adjust_price_f"] - 1.0
    if winsor > 0:
        df["future_return"] = df["future_return"].clip(-winsor, winsor)

    keep = ["code", "date", *features, "future_return"]
    df = df[keep].replace([np.inf, -np.inf], np.nan).dropna(subset=["code", "date", *features])
    return df


def read_panel_file(path: Path, features: list[str], horizon: int, winsor: float) -> pd.DataFrame:
    raw_features = [
        feature
        for feature in features
        if feature not in ENGINEERED_FEATURE_SOURCES and feature not in ROLLING_FEATURE_SOURCES
    ]
    engineered_sources = [ENGINEERED_FEATURE_SOURCES[feature] for feature in features if feature in ENGINEERED_FEATURE_SOURCES]
    rolling_sources = [ROLLING_FEATURE_SOURCES[feature] for feature in features if feature in ROLLING_FEATURE_SOURCES]
    required = list(dict.fromkeys(["code", "date", "adjust_price_f", *raw_features, *engineered_sources, *rolling_sources]))

    df = pd.read_csv(path, usecols=lambda col: col in required)
    missing = [col for col in required if col not in df.columns]
    if missing:
        raise RuntimeError(f"Panel file is missing required columns: {missing}")

    df["date"] = pd.to_datetime(df["date"], errors="coerce")
    df = df.dropna(subset=["code", "date"]).sort_values(["code", "date"])
    numeric_cols = list(dict.fromkeys(["adjust_price_f", *raw_features, *engineered_sources, *rolling_sources]))
    for col in numeric_cols:
        df[col] = pd.to_numeric(df[col], errors="coerce")
    for feature in features:
        source = ENGINEERED_FEATURE_SOURCES.get(feature)
        if source:
            df[feature] = np.where(df[source] > 0, np.log1p(df[source]), np.nan)

    frames = []
    for index, (_, part) in enumerate(df.groupby("code", sort=False), start=1):
        stock = part.copy()
        add_rolling_features(stock, features)
        stock["future_return"] = stock["adjust_price_f"].shift(-horizon) / stock["adjust_price_f"] - 1.0
        frames.append(stock)
        if index % 500 == 0:
            print(f"Prepared panel rolling features for {index:,} codes")
    out = pd.concat(frames, ignore_index=True)
    if winsor > 0:
        out["future_return"] = out["future_return"].clip(-winsor, winsor)
    keep = ["code", "date", *features, "future_return"]
    out = out[keep].replace([np.inf, -np.inf], np.nan).dropna(subset=["code", "date", *features])
    return out


def add_rolling_features(df: pd.DataFrame, features: list[str]) -> None:
    price = df["adjust_price_f"]
    returns = price.pct_change()
    for days in (20, 60, 120, 250):
        name = f"mom_{days}d"
        if name in features:
            df[name] = price.pct_change(days)
        name = f"vol_{days}d"
        if name in features:
            df[name] = returns.rolling(days, min_periods=max(10, days // 2)).std() * np.sqrt(252)
        name = f"ma_gap_{days}d"
        if name in features:
            ma = price.rolling(days, min_periods=max(20, days // 2)).mean()
            df[name] = price / ma - 1.0

    if "vol_ratio_60_250" in features:
        vol_60 = returns.rolling(60, min_periods=30).std()
        vol_250 = returns.rolling(250, min_periods=120).std()
        df["vol_ratio_60_250"] = vol_60 / vol_250 - 1.0

    if "drawdown_250d" in features:
        rolling_high = price.rolling(250, min_periods=60).max()
        df["drawdown_250d"] = 1.0 - price / rolling_high
    if "drawdown_750d" in features:
        rolling_high = price.rolling(750, min_periods=250).max()
        df["drawdown_750d"] = 1.0 - price / rolling_high
    if "low_rebound_60d" in features:
        rolling_low = price.rolling(60, min_periods=20).min()
        df["low_rebound_60d"] = price / rolling_low - 1.0

    if "turnover_20d_mean" in features:
        df["turnover_20d_mean"] = df["turnover"].rolling(20, min_periods=10).mean()
    if "turnover_60d_mean" in features:
        df["turnover_60d_mean"] = df["turnover"].rolling(60, min_periods=20).mean()
    if "turnover_change_20_120" in features:
        short = df["turnover"].rolling(20, min_periods=10).mean()
        long = df["turnover"].rolling(120, min_periods=40).mean()
        df["turnover_change_20_120"] = short / long - 1.0

    if "log_money_20d_mean" in features:
        df["log_money_20d_mean"] = np.where(
            df["money"].rolling(20, min_periods=10).mean() > 0,
            np.log1p(df["money"].rolling(20, min_periods=10).mean()),
            np.nan,
        )
    if "log_money_60d_mean" in features:
        df["log_money_60d_mean"] = np.where(
            df["money"].rolling(60, min_periods=20).mean() > 0,
            np.log1p(df["money"].rolling(60, min_periods=20).mean()),
            np.nan,
        )

    valuation_specs = {
        "pe_change_250d": "PE_TTM",
        "ps_change_250d": "PS_TTM",
        "pb_change_250d": "PB",
    }
    for feature, source in valuation_specs.items():
        if feature not in features:
            continue
        previous = df[source].shift(250)
        current = df[source]
        valid = (current > 0) & (previous > 0)
        df[feature] = np.where(valid, current / previous - 1.0, np.nan)

    valuation_window_specs = {
        "pe_to_median_750d": "PE_TTM",
        "ps_to_median_750d": "PS_TTM",
        "pb_to_median_750d": "PB",
    }
    for feature, source in valuation_window_specs.items():
        if feature not in features:
            continue
        current = df[source]
        median = current.where(current > 0).rolling(750, min_periods=250).median()
        df[feature] = np.where((current > 0) & (median > 0), current / median - 1.0, np.nan)

    valuation_position_specs = {
        "pe_position_750d": "PE_TTM",
        "ps_position_750d": "PS_TTM",
        "pb_position_750d": "PB",
    }
    for feature, source in valuation_position_specs.items():
        if feature not in features:
            continue
        current = df[source]
        clean = current.where(current > 0)
        low = clean.rolling(750, min_periods=250).min()
        high = clean.rolling(750, min_periods=250).max()
        df[feature] = np.where((current > 0) & (high > low), (current - low) / (high - low), np.nan)


def load_market_data(data_dir: Path, features: list[str], horizon: int, winsor: float, max_files: int) -> pd.DataFrame:
    files = sorted(data_dir.glob("*.csv"))
    if max_files:
        files = files[:max_files]

    frames = []
    for index, path in enumerate(files, start=1):
        frame = read_stock_file(path, features, horizon, winsor)
        if not frame.empty:
            frames.append(frame)
        if index % 500 == 0:
            print(f"Read {index:,}/{len(files):,} files; usable frames: {len(frames):,}")

    if not frames:
        raise RuntimeError("No usable CSV files found. Check feature names and data directory.")
    return pd.concat(frames, ignore_index=True)


def load_training_data(args: argparse.Namespace) -> pd.DataFrame:
    if args.data_file:
        print(f"Loading panel data from: {args.data_file}")
        return read_panel_file(args.data_file, args.features, args.horizon, args.winsor)
    print(f"Loading data from: {args.data_dir}")
    return load_market_data(args.data_dir, args.features, args.horizon, args.winsor, args.max_files)


def cross_sectional_zscore(df: pd.DataFrame, features: list[str], zcap: float) -> pd.DataFrame:
    out = df.copy()
    grouped = out.groupby("date", sort=False)
    for feature in features:
        mean = grouped[feature].transform("mean")
        std = grouped[feature].transform("std").replace(0, np.nan)
        out[f"z_{feature}"] = (out[feature] - mean) / std
        if zcap > 0:
            out[f"z_{feature}"] = out[f"z_{feature}"].clip(-zcap, zcap)
    z_features = [f"z_{feature}" for feature in features]
    return out.dropna(subset=z_features)


def train_model(train: pd.DataFrame, features: list[str], model_name: str, ridge_alpha: float):
    x_train = train[features].to_numpy()
    y_train = train["future_return"].to_numpy()
    if model_name == "ridge":
        model = Ridge(alpha=ridge_alpha)
    elif model_name == "hgb":
        raise RuntimeError("Use train_selected_model for hgb.")
    else:
        model = LinearRegression()
    model.fit(x_train, y_train)
    return model


def train_selected_model(train: pd.DataFrame, features: list[str], args: argparse.Namespace):
    if args.model in {"linear", "ridge"}:
        return train_model(train, features, args.model, args.ridge_alpha)

    fit_data = train
    if args.train_sample and len(train) > args.train_sample:
        fit_data = train.sample(args.train_sample, random_state=args.random_state)
    model = HistGradientBoostingRegressor(
        max_iter=args.hgb_max_iter,
        learning_rate=args.hgb_learning_rate,
        l2_regularization=args.hgb_l2,
        max_leaf_nodes=31,
        min_samples_leaf=80,
        random_state=args.random_state,
        early_stopping=True,
        validation_fraction=0.12,
        n_iter_no_change=20,
    )
    model.fit(fit_data[features].to_numpy(), fit_data["future_return"].to_numpy())
    return model


def rank_ic_by_date(df: pd.DataFrame, pred_col: str = "prediction") -> pd.DataFrame:
    rows = []
    for date, part in df.groupby("date"):
        if len(part) < 10:
            continue
        pearson = part[[pred_col, "future_return"]].corr(method="pearson").iloc[0, 1]
        spearman = part[[pred_col, "future_return"]].corr(method="spearman").iloc[0, 1]
        rows.append({"date": date, "pearson_ic": pearson, "rank_ic": spearman, "n": len(part)})
    return pd.DataFrame(rows).dropna()


def group_returns(df: pd.DataFrame, groups: int = 5) -> pd.DataFrame:
    rows = []
    for date, part in df.groupby("date"):
        if len(part) < groups * 5:
            continue
        ranked = part.copy()
        ranked["group"] = pd.qcut(ranked["prediction"].rank(method="first"), groups, labels=False) + 1
        for group, gpart in ranked.groupby("group"):
            rows.append({"date": date, "group": int(group), "mean_return": gpart["future_return"].mean(), "n": len(gpart)})
    return pd.DataFrame(rows)


def latest_prediction_frame(transformed: pd.DataFrame, features: list[str], model, active_days: int) -> pd.DataFrame:
    z_features = [f"z_{feature}" for feature in features]
    latest_dates = transformed.groupby("code")["date"].idxmax()
    latest = transformed.loc[latest_dates, ["code", "date", *features, *z_features]].copy()
    max_date = transformed["date"].max()
    if active_days > 0:
        latest = latest[latest["date"] >= max_date - pd.Timedelta(days=active_days)]
    latest["predicted_return"] = model.predict(latest[z_features].to_numpy())
    latest["score"] = latest["predicted_return"].rank(pct=True) * 100
    latest["rank"] = latest["predicted_return"].rank(ascending=False, method="first").astype(int)
    latest["total_names"] = len(latest)
    latest["rating"] = pd.cut(
        latest["score"],
        bins=[-0.01, 20, 40, 60, 80, 100],
        labels=["弱", "偏弱", "中性", "偏强", "强"],
    ).astype(str)
    return latest.sort_values("predicted_return", ascending=False)


def add_linear_contributions(latest: pd.DataFrame, features: list[str], model) -> pd.DataFrame:
    if not hasattr(model, "coef_"):
        return latest
    out = latest.copy()
    z_features = [f"z_{feature}" for feature in features]
    for feature, z_feature, coef in zip(features, z_features, model.coef_):
        out[f"contrib_{feature}"] = out[z_feature] * coef
    contribution_cols = [f"contrib_{feature}" for feature in features]
    labels = []
    for _, row in out.iterrows():
        ranked = sorted(
            [(feature, row[f"contrib_{feature}"]) for feature in features],
            key=lambda item: abs(item[1]),
            reverse=True,
        )
        top = ranked[:3]
        labels.append("; ".join(f"{feature}:{value:+.2%}" for feature, value in top))
    out["top_contributions"] = labels
    return out


def write_plots(output_dir: Path, test: pd.DataFrame, ic: pd.DataFrame, groups: pd.DataFrame) -> None:
    plt.figure(figsize=(8, 6))
    sample = test.sample(min(len(test), 50000), random_state=7) if len(test) else test
    plt.scatter(sample["prediction"], sample["future_return"], s=4, alpha=0.18)
    lo = min(sample["prediction"].min(), sample["future_return"].min())
    hi = max(sample["prediction"].max(), sample["future_return"].max())
    plt.plot([lo, hi], [lo, hi], color="#c65b4c", linewidth=1)
    plt.xlabel("Predicted future return")
    plt.ylabel("Actual future return")
    plt.title("Prediction vs Actual")
    plt.tight_layout()
    plt.savefig(output_dir / "prediction_vs_actual.png", dpi=160)
    plt.close()

    if not ic.empty:
        plt.figure(figsize=(10, 4))
        plt.plot(ic["date"], ic["rank_ic"], linewidth=1)
        plt.axhline(0, color="black", linewidth=0.8)
        plt.xlabel("Date")
        plt.ylabel("Rank IC")
        plt.title("Daily Rank IC")
        plt.tight_layout()
        plt.savefig(output_dir / "rank_ic_timeseries.png", dpi=160)
        plt.close()

    if not groups.empty:
        summary = groups.groupby("group")["mean_return"].mean()
        plt.figure(figsize=(7, 4))
        plt.bar(summary.index.astype(str), summary.values)
        plt.xlabel("Prediction Quantile Group")
        plt.ylabel("Mean future return")
        plt.title("Average Return by Prediction Group")
        plt.tight_layout()
        plt.savefig(output_dir / "group_returns.png", dpi=160)
        plt.close()


def main() -> None:
    args = parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)

    raw = load_training_data(args)
    print(f"Usable rows before z-score: {len(raw):,}")

    data = cross_sectional_zscore(raw, args.features, args.zcap)
    z_features = [f"z_{feature}" for feature in args.features]
    model_data = data.dropna(subset=["future_return"]).copy()
    test_start = pd.Timestamp(args.test_start)
    train = model_data[model_data["date"] < test_start].copy()
    test = model_data[model_data["date"] >= test_start].copy()
    if train.empty or test.empty:
        raise RuntimeError("Train or test set is empty. Adjust --test-start.")

    model = train_selected_model(train, z_features, args)
    train["prediction"] = model.predict(train[z_features].to_numpy())
    test["prediction"] = model.predict(test[z_features].to_numpy())

    train_r2 = r2_score(train["future_return"], train["prediction"])
    test_r2 = r2_score(test["future_return"], test["prediction"])
    train_rmse = math.sqrt(mean_squared_error(train["future_return"], train["prediction"]))
    test_rmse = math.sqrt(mean_squared_error(test["future_return"], test["prediction"]))

    ic = rank_ic_by_date(test)
    groups = group_returns(test)
    latest = latest_prediction_frame(data, args.features, model, args.active_days)
    latest = add_linear_contributions(latest, args.features, model)

    if hasattr(model, "coef_"):
        coef = pd.DataFrame(
            {
                "feature": ["intercept", *args.features],
                "coefficient": [model.intercept_, *model.coef_],
            }
        )
    else:
        coef = pd.DataFrame({"feature": args.features, "coefficient": [np.nan] * len(args.features)})
    metrics = {
        "model": args.model,
        "horizon": args.horizon,
        "winsor": args.winsor,
        "zcap": args.zcap,
        "active_days": args.active_days,
        "features": args.features,
        "train_sample": None if not args.train_sample else args.train_sample,
        "train_rows": int(len(train)),
        "test_rows": int(len(test)),
        "train_start": str(train["date"].min().date()),
        "train_end": str(train["date"].max().date()),
        "test_start": str(test["date"].min().date()),
        "test_end": str(test["date"].max().date()),
        "train_r2": train_r2,
        "test_r2": test_r2,
        "train_rmse": train_rmse,
        "test_rmse": test_rmse,
        "test_rank_ic_mean": None if ic.empty else float(ic["rank_ic"].mean()),
        "test_rank_ic_std": None if ic.empty else float(ic["rank_ic"].std()),
        "test_rank_ic_ir": None if ic.empty or ic["rank_ic"].std() == 0 else float(ic["rank_ic"].mean() / ic["rank_ic"].std()),
        "test_rank_ic_positive_rate": None if ic.empty else float((ic["rank_ic"] > 0).mean()),
    }

    coef.to_csv(args.output_dir / "coefficients.csv", index=False)
    latest.to_csv(args.output_dir / "latest_predictions.csv", index=False)
    if args.long_term_score:
        latest.to_csv(args.output_dir / "long_term_scores.csv", index=False)
        valuation_cols = [col for col in ["PE_TTM", "PS_TTM", "PC_TTM", "PB"] if col in latest.columns]
        clean = latest.copy()
        for col in valuation_cols:
            clean = clean[clean[col] > 0]
        clean.to_csv(args.output_dir / "long_term_scores_clean.csv", index=False)
    test[["code", "date", "future_return", "prediction"]].to_csv(args.output_dir / "test_predictions.csv", index=False)
    ic.to_csv(args.output_dir / "daily_ic.csv", index=False)
    groups.to_csv(args.output_dir / "group_returns.csv", index=False)
    with open(args.output_dir / "metrics.json", "w", encoding="utf-8") as f:
        json.dump(metrics, f, ensure_ascii=False, indent=2)
    write_plots(args.output_dir, test, ic, groups)

    print(json.dumps(metrics, ensure_ascii=False, indent=2))
    print(f"Outputs written to: {args.output_dir.resolve()}")


if __name__ == "__main__":
    main()
