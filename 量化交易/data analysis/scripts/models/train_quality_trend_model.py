#!/usr/bin/env python3
"""
Train a standalone financial-quality trend model.

This model intentionally uses only quarterly financial quality factors. It does
not use daily prices, volume, valuation multiples, turnover, or technical
signals. The target is future financial quality, not stock return.
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
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_squared_error, r2_score


DEFAULT_DATA_FILE = Path("quality_dataset/quarterly_quality_factors.csv")
DEFAULT_OUTPUT_DIR = Path("model_outputs_quality_trend_hgb_v1")

QUALITY_SCORE_SPECS = {
    "quality_value_index_weighted_avg_roe": 1,
    "quality_value_index_full_diluted_roe": 1,
    "quality_value_sale_gross_margin": 1,
    "quality_value_sale_net_interest_ratio": 1,
    "quality_value_index_per_operating_cash_flow_net": 1,
    "quality_value_calculate_operating_income_total_yoy_growth_ratio": 1,
    "quality_value_calculate_parent_holder_net_profit_yoy_growth_ratio": 1,
    "quality_value_deduct_net_profit_yoy_growth_ratio": 1,
    "quality_single_yoy_operating_income_total": 1,
    "quality_single_yoy_parent_holder_net_profit": 1,
    "quality_value_assets_debt_ratio": -1,
}

BASE_FEATURES = [
    "quality_value_index_weighted_avg_roe",
    "quality_value_index_full_diluted_roe",
    "quality_value_sale_gross_margin",
    "quality_value_sale_net_interest_ratio",
    "quality_value_index_per_operating_cash_flow_net",
    "quality_value_assets_debt_ratio",
    "quality_value_current_ratio",
    "quality_value_quick_ratio",
    "quality_value_inventory_turnover_ratio",
    "quality_value_receive_accounts_turnover_days",
    "quality_value_calculate_operating_income_total_yoy_growth_ratio",
    "quality_value_calculate_parent_holder_net_profit_yoy_growth_ratio",
    "quality_value_deduct_net_profit_yoy_growth_ratio",
    "quality_single_yoy_operating_income_total",
    "quality_single_yoy_parent_holder_net_profit",
    "quality_yoy_sale_gross_margin",
    "quality_yoy_assets_debt_ratio",
    "quality_mom_sale_gross_margin",
    "quality_mom_index_weighted_avg_roe",
    "quality_mom_index_per_operating_cash_flow_net",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train financial quality trend model.")
    parser.add_argument("--data-file", type=Path, default=DEFAULT_DATA_FILE)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--future-quarters", type=int, default=4)
    parser.add_argument("--target", choices=["future_score", "future_change"], default="future_score")
    parser.add_argument("--test-start", default="2023-01-01")
    parser.add_argument("--model", choices=["ridge", "hgb"], default="hgb")
    parser.add_argument("--ridge-alpha", type=float, default=10.0)
    parser.add_argument("--hgb-max-iter", type=int, default=180)
    parser.add_argument("--hgb-learning-rate", type=float, default=0.04)
    parser.add_argument("--hgb-l2", type=float, default=0.1)
    parser.add_argument("--zcap", type=float, default=5.0)
    parser.add_argument("--min-period-stocks", type=int, default=50)
    parser.add_argument("--features", nargs="+", default=None)
    return parser.parse_args()


def percentile_by_period(df: pd.DataFrame, col: str, direction: int) -> pd.Series:
    values = df[col]
    if direction < 0:
        values = -values
    return values.groupby(df["statDate"]).rank(pct=True) * 100


def add_quality_score(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    score_parts = []
    used = []
    for col, direction in QUALITY_SCORE_SPECS.items():
        if col not in out.columns:
            continue
        numeric = pd.to_numeric(out[col], errors="coerce")
        out[col] = numeric.replace([np.inf, -np.inf], np.nan)
        part = percentile_by_period(out, col, direction)
        score_parts.append(part)
        used.append(col)
    if not score_parts:
        raise RuntimeError("No quality score columns available.")
    score_frame = pd.concat(score_parts, axis=1)
    out["quality_score"] = score_frame.mean(axis=1)
    out["quality_score_component_count"] = score_frame.notna().sum(axis=1)
    return out


def add_trend_features(df: pd.DataFrame, features: list[str]) -> tuple[pd.DataFrame, list[str]]:
    out = df.sort_values(["code", "statDate"]).copy()
    final_features = []
    for feature in features:
        if feature not in out.columns:
            continue
        out[feature] = pd.to_numeric(out[feature], errors="coerce")
        final_features.append(feature)
        out[f"{feature}_chg4q"] = out.groupby("code")[feature].diff(4)
        out[f"{feature}_avg4q"] = out.groupby("code")[feature].rolling(4, min_periods=2).mean().reset_index(level=0, drop=True)
        final_features.extend([f"{feature}_chg4q", f"{feature}_avg4q"])
    out["quality_score_chg4q"] = out.groupby("code")["quality_score"].diff(4)
    out["quality_score_avg4q"] = (
        out.groupby("code")["quality_score"].rolling(4, min_periods=2).mean().reset_index(level=0, drop=True)
    )
    final_features.extend(["quality_score", "quality_score_chg4q", "quality_score_avg4q"])
    return out, final_features


def cross_sectional_zscore(df: pd.DataFrame, features: list[str], zcap: float) -> tuple[pd.DataFrame, list[str]]:
    out = df.copy()
    z_features = []
    grouped = out.groupby("statDate", sort=False)
    for feature in features:
        if feature not in out.columns:
            continue
        mean = grouped[feature].transform("mean")
        std = grouped[feature].transform("std").replace(0, np.nan)
        z_col = f"z_{feature}"
        out[z_col] = (out[feature] - mean) / std
        if zcap > 0:
            out[z_col] = out[z_col].clip(-zcap, zcap)
        z_features.append(z_col)
    return out.dropna(subset=z_features), z_features


def global_feature_stats(df: pd.DataFrame, features: list[str]) -> dict[str, dict[str, float]]:
    stats = {}
    for feature in features:
        values = pd.to_numeric(df[feature], errors="coerce").replace([np.inf, -np.inf], np.nan).dropna()
        if values.empty:
            continue
        std = float(values.std())
        stats[feature] = {"mean": float(values.mean()), "std": std if std > 0 else 1.0}
    return stats


def prepare_data(args: argparse.Namespace) -> tuple[pd.DataFrame, list[str]]:
    df = pd.read_csv(args.data_file)
    df["statDate"] = pd.to_datetime(df["statDate"], errors="coerce")
    df["pubDate"] = pd.to_datetime(df["pubDate"], errors="coerce")
    df = df.dropna(subset=["code", "statDate"]).sort_values(["code", "statDate"])
    df = add_quality_score(df)
    base_features = args.features or BASE_FEATURES
    df, features = add_trend_features(df, base_features)
    df["future_quality_score"] = df.groupby("code")["quality_score"].shift(-args.future_quarters)
    df["future_quality_score_chg"] = df["future_quality_score"] - df["quality_score"]
    df = df[df["quality_score_component_count"] >= 5].copy()
    df, z_features = cross_sectional_zscore(df, features, args.zcap)
    return df.dropna(subset=["future_quality_score"]), z_features


def fit_model(train: pd.DataFrame, z_features: list[str], args: argparse.Namespace):
    x = train[z_features].to_numpy()
    y = train[target_col(args)].to_numpy()
    if args.model == "ridge":
        model = Ridge(alpha=args.ridge_alpha)
    else:
        model = HistGradientBoostingRegressor(
            max_iter=args.hgb_max_iter,
            learning_rate=args.hgb_learning_rate,
            l2_regularization=args.hgb_l2,
            max_leaf_nodes=31,
            min_samples_leaf=30,
            early_stopping=True,
            validation_fraction=0.15,
            n_iter_no_change=20,
            random_state=7,
        )
    model.fit(x, y)
    return model


def target_col(args: argparse.Namespace) -> str:
    return "future_quality_score_chg" if args.target == "future_change" else "future_quality_score"


def rank_ic_by_period(df: pd.DataFrame) -> pd.DataFrame:
    rows = []
    for stat_date, part in df.groupby("statDate"):
        if len(part) < 20:
            continue
        rows.append(
            {
                "statDate": stat_date,
                "rank_ic": part[["prediction", "target"]].corr(method="spearman").iloc[0, 1],
                "pearson_ic": part[["prediction", "target"]].corr(method="pearson").iloc[0, 1],
                "n": len(part),
            }
        )
    return pd.DataFrame(rows).dropna()


def group_summary(df: pd.DataFrame, groups: int = 5) -> pd.DataFrame:
    rows = []
    for stat_date, part in df.groupby("statDate"):
        if len(part) < groups * 10:
            continue
        ranked = part.copy()
        ranked["group"] = pd.qcut(ranked["prediction"].rank(method="first"), groups, labels=False) + 1
        for group, gpart in ranked.groupby("group"):
            rows.append(
                {
                    "statDate": stat_date,
                    "group": int(group),
                    "future_quality_score": gpart["future_quality_score"].mean(),
                    "future_quality_score_chg": gpart["future_quality_score_chg"].mean(),
                    "n": len(gpart),
                }
            )
    return pd.DataFrame(rows)


def latest_scores(data: pd.DataFrame, z_features: list[str], model, args: argparse.Namespace) -> pd.DataFrame:
    latest_idx = data.groupby("code")["statDate"].idxmax()
    latest = data.loc[latest_idx].copy()
    latest["prediction"] = model.predict(latest[z_features].to_numpy())
    if args.target == "future_change":
        latest["predicted_quality_trend"] = latest["prediction"]
        latest["predicted_future_quality_score"] = latest["quality_score"] + latest["predicted_quality_trend"]
    else:
        latest["predicted_future_quality_score"] = latest["prediction"]
        latest["predicted_quality_trend"] = latest["predicted_future_quality_score"] - latest["quality_score"]
    latest["score"] = latest["prediction"].rank(pct=True) * 100
    latest["trend_score"] = latest["predicted_quality_trend"].rank(pct=True) * 100
    latest["rank"] = latest["prediction"].rank(ascending=False, method="first").astype(int)
    latest["rating"] = pd.cut(
        latest["score"],
        bins=[-0.01, 20, 40, 60, 80, 100],
        labels=["弱", "偏弱", "中性", "偏强", "强"],
    ).astype(str)
    keep = [
        "code",
        "statDate",
        "pubDate",
        "quality_score",
        "predicted_future_quality_score",
        "predicted_quality_trend",
        "score",
        "trend_score",
        "rank",
        "rating",
    ]
    return latest[keep].sort_values("rank")


def write_plots(output_dir: Path, test: pd.DataFrame, ic: pd.DataFrame, groups: pd.DataFrame) -> None:
    sample = test.sample(min(len(test), 50000), random_state=7) if len(test) else test
    plt.figure(figsize=(7, 6))
    plt.scatter(sample["prediction"], sample["target"], s=8, alpha=0.2)
    plt.xlabel("Predicted target")
    plt.ylabel("Actual target")
    plt.title("Financial Quality Trend: Prediction vs Actual")
    plt.tight_layout()
    plt.savefig(output_dir / "prediction_vs_actual_quality.png", dpi=160)
    plt.close()

    if not ic.empty:
        plt.figure(figsize=(9, 4))
        plt.plot(ic["statDate"], ic["rank_ic"], linewidth=1)
        plt.axhline(0, color="black", linewidth=0.8)
        plt.xlabel("Quarter")
        plt.ylabel("Rank IC")
        plt.title("Quarterly Rank IC")
        plt.tight_layout()
        plt.savefig(output_dir / "rank_ic_timeseries.png", dpi=160)
        plt.close()

    if not groups.empty:
        summary = groups.groupby("group")["future_quality_score_chg"].mean()
        plt.figure(figsize=(7, 4))
        plt.bar(summary.index.astype(str), summary.values)
        plt.xlabel("Prediction Quantile Group")
        plt.ylabel("Future 4Q quality score change")
        plt.title("Future Quality Change by Prediction Group")
        plt.tight_layout()
        plt.savefig(output_dir / "group_future_quality_change.png", dpi=160)
        plt.close()


def main() -> None:
    args = parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)

    data, z_features = prepare_data(args)
    raw_features = [feature.removeprefix("z_") for feature in z_features]
    feature_stats = global_feature_stats(data, raw_features)
    test_start = pd.Timestamp(args.test_start)
    train = data[data["statDate"] < test_start].copy()
    test = data[data["statDate"] >= test_start].copy()
    if train.empty or test.empty:
        raise RuntimeError("Train or test set is empty.")

    model = fit_model(train, z_features, args)
    train["prediction"] = model.predict(train[z_features].to_numpy())
    test["prediction"] = model.predict(test[z_features].to_numpy())
    train["target"] = train[target_col(args)]
    test["target"] = test[target_col(args)]
    ic = rank_ic_by_period(test)
    groups = group_summary(test)
    latest = latest_scores(data, z_features, model, args)

    metrics = {
        "model": args.model,
        "future_quarters": args.future_quarters,
        "target": target_col(args),
        "train_rows": int(len(train)),
        "test_rows": int(len(test)),
        "train_start": str(train["statDate"].min().date()),
        "train_end": str(train["statDate"].max().date()),
        "test_start": str(test["statDate"].min().date()),
        "test_end": str(test["statDate"].max().date()),
        "features": raw_features,
        "train_r2": float(r2_score(train["target"], train["prediction"])),
        "test_r2": float(r2_score(test["target"], test["prediction"])),
        "train_rmse": float(math.sqrt(mean_squared_error(train["target"], train["prediction"]))),
        "test_rmse": float(math.sqrt(mean_squared_error(test["target"], test["prediction"]))),
        "test_rank_ic_mean": None if ic.empty else float(ic["rank_ic"].mean()),
        "test_rank_ic_positive_rate": None if ic.empty else float((ic["rank_ic"] > 0).mean()),
        "top_minus_bottom_future_quality_change": None
        if groups.empty
        else float(
            groups[groups["group"] == groups["group"].max()]["future_quality_score_chg"].mean()
            - groups[groups["group"] == groups["group"].min()]["future_quality_score_chg"].mean()
        ),
    }

    if hasattr(model, "coef_"):
        coef = pd.DataFrame({"feature": raw_features, "coefficient": model.coef_})
    else:
        coef = pd.DataFrame({"feature": raw_features, "coefficient": np.nan})

    artifact = {
        "model": args.model,
        "target": target_col(args),
        "future_quarters": args.future_quarters,
        "metrics": metrics,
        "features": raw_features,
        "featureStats": feature_stats,
        "intercept": float(getattr(model, "intercept_", 0.0)),
        "coefficients": {feature: float(coef_value) for feature, coef_value in zip(raw_features, getattr(model, "coef_", []))},
        "scoreSpecs": QUALITY_SCORE_SPECS,
    }

    train[["code", "statDate", "pubDate", "quality_score", "future_quality_score", "future_quality_score_chg", "target", "prediction"]].to_csv(
        args.output_dir / "train_predictions.csv", index=False
    )
    test[["code", "statDate", "pubDate", "quality_score", "future_quality_score", "future_quality_score_chg", "target", "prediction"]].to_csv(
        args.output_dir / "test_predictions.csv", index=False
    )
    latest.to_csv(args.output_dir / "latest_quality_trend_scores.csv", index=False)
    ic.to_csv(args.output_dir / "quarterly_ic.csv", index=False)
    groups.to_csv(args.output_dir / "group_quality_change.csv", index=False)
    coef.to_csv(args.output_dir / "coefficients.csv", index=False)
    with open(args.output_dir / "metrics.json", "w", encoding="utf-8") as f:
        json.dump(metrics, f, ensure_ascii=False, indent=2)
    with open(args.output_dir / "model_artifact.json", "w", encoding="utf-8") as f:
        json.dump(artifact, f, ensure_ascii=False, indent=2)
    write_plots(args.output_dir, test, ic, groups)

    print(json.dumps(metrics, ensure_ascii=False, indent=2))
    print(f"Outputs written to: {args.output_dir.resolve()}")


if __name__ == "__main__":
    main()
