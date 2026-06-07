#!/usr/bin/env python3
"""
Build financial quality factors for the representative A-share dataset.

AkShare's THS abstract endpoint returns many historical financial indicators
per stock in one request, which is much faster than one request per
stock-quarter-table.
"""

from __future__ import annotations

import argparse
import time
from pathlib import Path

import pandas as pd

from build_quality_dataset import DEFAULT_STOCK_DIR, build_daily_asof


DEFAULT_OUTPUT_DIR = Path("quality_dataset")
DEFAULT_START_DATE = "2016-01-01"
DEFAULT_END_DATE = "2026-05-22"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build AkShare financial quality dataset.")
    parser.add_argument("--stock-dir", type=Path, default=DEFAULT_STOCK_DIR)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--universe-file", type=Path, default=DEFAULT_OUTPUT_DIR / "representative_universe.csv")
    parser.add_argument("--start-date", default=DEFAULT_START_DATE)
    parser.add_argument("--end-date", default=DEFAULT_END_DATE)
    parser.add_argument("--max-stocks", type=int, default=0)
    parser.add_argument("--sleep", type=float, default=0.05)
    parser.add_argument("--force", action="store_true")
    return parser.parse_args()


def code_digits(code: str) -> str:
    return "".join(ch for ch in str(code) if ch.isdigit())[-6:]


def conservative_available_date(report_date: pd.Timestamp) -> pd.Timestamp:
    month_day = (report_date.month, report_date.day)
    if month_day == (12, 31):
        lag_days = 120
    elif month_day == (6, 30):
        lag_days = 75
    else:
        lag_days = 45
    return report_date + pd.Timedelta(days=lag_days)


def fetch_one_stock_quality(symbol: str) -> pd.DataFrame:
    import akshare as ak

    raw = ak.stock_financial_abstract_new_ths(symbol=symbol)
    if raw.empty:
        return pd.DataFrame()
    keep_cols = ["report_date", "metric_name", "value", "single", "yoy", "mom", "single_yoy"]
    raw = raw[[col for col in keep_cols if col in raw.columns]].copy()
    raw["report_date"] = pd.to_datetime(raw["report_date"], errors="coerce")
    raw = raw.dropna(subset=["report_date", "metric_name"])
    for col in ["value", "single", "yoy", "mom", "single_yoy"]:
        if col in raw.columns:
            raw[col] = pd.to_numeric(raw[col], errors="coerce")

    pieces = []
    for value_col in ["value", "single", "yoy", "mom", "single_yoy"]:
        if value_col not in raw.columns:
            continue
        pivot = raw.pivot_table(index="report_date", columns="metric_name", values=value_col, aggfunc="last")
        pivot = pivot.add_prefix(f"quality_{value_col}_")
        pieces.append(pivot)
    if not pieces:
        return pd.DataFrame()

    out = pd.concat(pieces, axis=1).reset_index()
    out["statDate"] = out["report_date"]
    out["pubDate"] = out["statDate"].map(conservative_available_date)
    return out.drop(columns=["report_date"])


def build_quality(args: argparse.Namespace) -> pd.DataFrame:
    universe = pd.read_csv(args.universe_file)
    codes = universe["code"].astype(str).str.lower().tolist()
    if args.max_stocks:
        codes = codes[: args.max_stocks]

    cache_dir = args.output_dir / "akshare_quality_by_code"
    cache_dir.mkdir(parents=True, exist_ok=True)
    frames = []
    start_buffer = pd.to_datetime(args.start_date) - pd.DateOffset(years=1)
    end_date = pd.to_datetime(args.end_date)

    for index, code in enumerate(codes, start=1):
        cache_path = cache_dir / f"{code}.csv"
        if cache_path.exists() and not args.force:
            frame = pd.read_csv(cache_path, parse_dates=["pubDate", "statDate"])
        else:
            try:
                frame = fetch_one_stock_quality(code_digits(code))
            except Exception as exc:
                print(f"Warning: {code} failed: {exc}", flush=True)
                frame = pd.DataFrame(columns=["code", "pubDate", "statDate"])
            if not frame.empty:
                frame.insert(0, "code", code)
                frame = frame[(frame["statDate"] >= start_buffer) & (frame["statDate"] <= end_date)]
            frame.to_csv(cache_path, index=False)
            if args.sleep:
                time.sleep(args.sleep)

        if not frame.empty:
            frames.append(frame)
        if index % 100 == 0:
            rows = sum(len(x) for x in frames)
            print(f"Fetched quality {index:,}/{len(codes):,} codes; rows: {rows:,}", flush=True)

    if not frames:
        return pd.DataFrame(columns=["code", "pubDate", "statDate"])
    quality = pd.concat(frames, ignore_index=True)
    quality = quality.sort_values(["code", "pubDate", "statDate"])
    return quality


def main() -> None:
    args = parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)

    quality_path = args.output_dir / "quarterly_quality_factors.csv"
    quality = build_quality(args)
    quality.to_csv(quality_path, index=False)
    print(f"Wrote quality factors: {quality_path} rows={len(quality):,} cols={len(quality.columns):,}", flush=True)

    daily_path = args.output_dir / "daily_quality_asof.csv"
    build_daily_asof(
        stock_dir=args.stock_dir,
        quality=quality,
        output_path=daily_path,
        start_date=args.start_date,
        end_date=args.end_date,
    )
    print(f"Wrote daily as-of quality panel: {daily_path}", flush=True)


if __name__ == "__main__":
    main()
