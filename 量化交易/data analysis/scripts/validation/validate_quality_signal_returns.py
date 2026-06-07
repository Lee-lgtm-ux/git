#!/usr/bin/env python3
"""
Validate whether financial-quality trend predictions relate to future returns.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Validate quality trend signal against future stock returns.")
    parser.add_argument("--predictions", type=Path, default=Path("model_outputs_quality_trend_change_ridge_v1/test_predictions.csv"))
    parser.add_argument("--daily", type=Path, default=Path("quality_dataset/daily_market_panel.csv"))
    parser.add_argument("--output-dir", type=Path, default=Path("quality_signal_return_validation"))
    parser.add_argument("--horizons", nargs="+", type=int, default=[250, 500])
    return parser.parse_args()


def load_daily_returns(path: Path, horizons: list[int]) -> pd.DataFrame:
    daily = pd.read_csv(path, usecols=["code", "date", "adjust_price_f"])
    daily["date"] = pd.to_datetime(daily["date"], errors="coerce")
    daily["adjust_price_f"] = pd.to_numeric(daily["adjust_price_f"], errors="coerce")
    daily = daily.dropna(subset=["code", "date", "adjust_price_f"]).sort_values(["code", "date"])
    frames = []
    for _, part in daily.groupby("code", sort=False):
        stock = part.copy()
        for horizon in horizons:
            stock[f"future_return_{horizon}d"] = stock["adjust_price_f"].shift(-horizon) / stock["adjust_price_f"] - 1.0
        frames.append(stock)
    return pd.concat(frames, ignore_index=True)


def merge_predictions(predictions: pd.DataFrame, daily: pd.DataFrame) -> pd.DataFrame:
    predictions = predictions.copy()
    predictions["pubDate"] = pd.to_datetime(predictions["pubDate"], errors="coerce")
    predictions = predictions.dropna(subset=["code", "pubDate", "prediction"]).sort_values(["code", "pubDate"])
    daily = daily.sort_values(["code", "date"])
    merged = []
    for code, part in predictions.groupby("code", sort=False):
        dpart = daily[daily["code"] == code]
        if dpart.empty:
            continue
        merged.append(pd.merge_asof(part.sort_values("pubDate"), dpart, left_on="pubDate", right_on="date", direction="forward"))
    if not merged:
        return pd.DataFrame()
    out = pd.concat(merged, ignore_index=True)
    if "code_x" in out.columns:
        out = out.rename(columns={"code_x": "code"}).drop(columns=[col for col in ["code_y"] if col in out.columns])
    return out


def rank_ic_by_period(df: pd.DataFrame, return_col: str) -> pd.DataFrame:
    rows = []
    for pub_date, part in df.dropna(subset=[return_col]).groupby("pubDate"):
        if len(part) < 20:
            continue
        rows.append(
            {
                "pubDate": pub_date,
                "rank_ic": part[["prediction", return_col]].corr(method="spearman").iloc[0, 1],
                "pearson_ic": part[["prediction", return_col]].corr(method="pearson").iloc[0, 1],
                "n": len(part),
            }
        )
    return pd.DataFrame(rows).dropna()


def group_returns(df: pd.DataFrame, return_col: str, groups: int = 5) -> pd.DataFrame:
    rows = []
    for pub_date, part in df.dropna(subset=[return_col]).groupby("pubDate"):
        if len(part) < groups * 10:
            continue
        ranked = part.copy()
        ranked["group"] = pd.qcut(ranked["prediction"].rank(method="first"), groups, labels=False) + 1
        for group, gpart in ranked.groupby("group"):
            rows.append({"pubDate": pub_date, "group": int(group), "mean_return": gpart[return_col].mean(), "n": len(gpart)})
    return pd.DataFrame(rows)


def main() -> None:
    args = parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    predictions = pd.read_csv(args.predictions)
    daily = load_daily_returns(args.daily, args.horizons)
    merged = merge_predictions(predictions, daily)
    merged.to_csv(args.output_dir / "quality_signal_return_samples.csv", index=False)

    summary_rows = []
    for horizon in args.horizons:
        return_col = f"future_return_{horizon}d"
        valid = merged.dropna(subset=[return_col, "prediction"]).copy()
        ic = rank_ic_by_period(valid, return_col)
        groups = group_returns(valid, return_col)
        ic.to_csv(args.output_dir / f"rank_ic_{horizon}d.csv", index=False)
        groups.to_csv(args.output_dir / f"group_returns_{horizon}d.csv", index=False)
        group_avg = groups.groupby("group")["mean_return"].mean() if not groups.empty else pd.Series(dtype=float)
        top_bottom = np.nan
        if not group_avg.empty and group_avg.index.min() != group_avg.index.max():
            top_bottom = group_avg.loc[group_avg.index.max()] - group_avg.loc[group_avg.index.min()]
        summary_rows.append(
            {
                "horizon": horizon,
                "samples": int(len(valid)),
                "periods": int(ic["pubDate"].nunique()) if not ic.empty else 0,
                "rank_ic_mean": None if ic.empty else float(ic["rank_ic"].mean()),
                "rank_ic_positive_rate": None if ic.empty else float((ic["rank_ic"] > 0).mean()),
                "top_group_return": None if group_avg.empty else float(group_avg.loc[group_avg.index.max()]),
                "bottom_group_return": None if group_avg.empty else float(group_avg.loc[group_avg.index.min()]),
                "top_minus_bottom": None if not np.isfinite(top_bottom) else float(top_bottom),
            }
        )
    summary = pd.DataFrame(summary_rows)
    summary.to_csv(args.output_dir / "summary.csv", index=False)
    with open(args.output_dir / "summary.json", "w", encoding="utf-8") as f:
        json.dump(summary_rows, f, ensure_ascii=False, indent=2)
    print(summary.to_string(index=False))


if __name__ == "__main__":
    main()
