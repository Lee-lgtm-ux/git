#!/usr/bin/env python3
"""
Build a representative A-share training dataset.

Default universe:
- CSI 300
- CSI 500
- CSI 1000
- ChiNext 50
- STAR 50

The script keeps only codes that exist in the local daily CSV folder.
"""

from __future__ import annotations

import argparse
from collections import defaultdict
from pathlib import Path

import pandas as pd

from build_quality_dataset import (
    DEFAULT_STOCK_DIR,
    build_daily_asof,
    build_daily_market_panel,
    fetch_quality_factors,
)


DEFAULT_OUTPUT_DIR = Path("quality_dataset")
DEFAULT_START_DATE = "2016-01-01"
DEFAULT_END_DATE = "2026-05-22"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build representative A-share dataset.")
    parser.add_argument("--stock-dir", type=Path, default=DEFAULT_STOCK_DIR)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--start-date", default=DEFAULT_START_DATE)
    parser.add_argument("--end-date", default=DEFAULT_END_DATE)
    parser.add_argument("--start-year", type=int, default=2016)
    parser.add_argument("--end-year", type=int, default=2026)
    parser.add_argument("--index-date", default=DEFAULT_END_DATE)
    parser.add_argument("--sleep", type=float, default=0.02)
    parser.add_argument("--skip-quality", action="store_true")
    parser.add_argument("--force", action="store_true")
    return parser.parse_args()


def normalize_code(raw: str, exchange: str | None = None) -> str:
    text = str(raw).strip().lower().replace(".", "")
    digits = "".join(ch for ch in text if ch.isdigit())
    if text.startswith(("sh", "sz", "bj")):
        return f"{text[:2]}{digits[-6:]}"
    if exchange and "上海" in str(exchange):
        return f"sh{digits[-6:]}"
    if exchange and "深圳" in str(exchange):
        return f"sz{digits[-6:]}"
    if digits.startswith("6"):
        return f"sh{digits[-6:]}"
    if digits.startswith(("0", "3")):
        return f"sz{digits[-6:]}"
    if digits.startswith(("4", "8")):
        return f"bj{digits[-6:]}"
    return digits[-6:]


def fetch_baostock_index(index_date: str) -> pd.DataFrame:
    import baostock as bs

    specs = {
        "沪深300": bs.query_hs300_stocks,
        "中证500": bs.query_zz500_stocks,
    }
    rows = []
    login = bs.login()
    if login.error_code != "0":
        raise RuntimeError(f"BaoStock login failed: {login.error_msg}")
    try:
        for index_name, query in specs.items():
            rs = query(date=index_date)
            while rs.error_code == "0" and rs.next():
                row = dict(zip(rs.fields, rs.get_row_data()))
                rows.append(
                    {
                        "code": normalize_code(row.get("code", "")),
                        "name": row.get("code_name", ""),
                        "source_index": index_name,
                        "source_date": row.get("updateDate", index_date),
                    }
                )
            if rs.error_code != "0":
                print(f"Warning: {index_name} failed: {rs.error_msg}", flush=True)
    finally:
        bs.logout()
    return pd.DataFrame(rows)


def fetch_akshare_index() -> pd.DataFrame:
    import akshare as ak

    rows = []
    csindex_specs = {
        "中证1000": "000852",
        "科创50": "000688",
    }
    for index_name, symbol in csindex_specs.items():
        try:
            df = ak.index_stock_cons_csindex(symbol=symbol)
        except Exception as exc:
            print(f"Warning: {index_name} failed: {exc}", flush=True)
            continue
        for _, row in df.iterrows():
            rows.append(
                {
                    "code": normalize_code(row.get("成分券代码"), row.get("交易所")),
                    "name": row.get("成分券名称", ""),
                    "source_index": index_name,
                    "source_date": row.get("日期", ""),
                }
            )

    try:
        df = ak.index_stock_cons(symbol="399673")
        for _, row in df.iterrows():
            rows.append(
                {
                    "code": normalize_code(row.get("品种代码")),
                    "name": row.get("品种名称", ""),
                    "source_index": "创业板50",
                    "source_date": row.get("纳入日期", ""),
                }
            )
    except Exception as exc:
        print(f"Warning: 创业板50 failed: {exc}", flush=True)

    return pd.DataFrame(rows)


def local_codes(stock_dir: Path) -> set[str]:
    return {path.stem.lower() for path in stock_dir.glob("*.csv")}


def combine_universe(frames: list[pd.DataFrame], available: set[str]) -> pd.DataFrame:
    sources: dict[str, set[str]] = defaultdict(set)
    names: dict[str, str] = {}
    source_dates: dict[str, set[str]] = defaultdict(set)
    for frame in frames:
        if frame.empty:
            continue
        for _, row in frame.dropna(subset=["code"]).iterrows():
            code = str(row["code"]).lower()
            if code not in available:
                continue
            sources[code].add(str(row["source_index"]))
            if row.get("name"):
                names[code] = str(row["name"])
            if row.get("source_date"):
                source_dates[code].add(str(row["source_date"]))

    rows = [
        {
            "code": code,
            "name": names.get(code, ""),
            "source_indices": ";".join(sorted(sources[code])),
            "source_dates": ";".join(sorted(source_dates[code])),
        }
        for code in sorted(sources)
    ]
    return pd.DataFrame(rows)


def main() -> None:
    args = parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)

    print("Fetching representative index constituents", flush=True)
    universe = combine_universe(
        [fetch_baostock_index(args.index_date), fetch_akshare_index()],
        local_codes(args.stock_dir),
    )
    universe_path = args.output_dir / "representative_universe.csv"
    universe.to_csv(universe_path, index=False)
    codes = universe["code"].tolist()
    print(f"Wrote {len(codes):,} representative codes: {universe_path}", flush=True)

    market_path = args.output_dir / "daily_market_panel.csv"
    build_daily_market_panel(
        stock_dir=args.stock_dir,
        output_path=market_path,
        codes=codes,
        start_date=args.start_date,
        end_date=args.end_date,
    )
    print(f"Wrote representative daily panel: {market_path}", flush=True)

    if args.skip_quality:
        return

    quality = fetch_quality_factors(
        codes=codes,
        start_year=args.start_year,
        end_year=args.end_year,
        sleep=args.sleep,
        tables=["profit", "operation", "growth", "balance", "cashflow", "dupont"],
        cache_dir=args.output_dir / "quarterly_by_code",
        force=args.force,
    )
    quarterly_path = args.output_dir / "quarterly_quality_factors.csv"
    quality.to_csv(quarterly_path, index=False)
    print(f"Wrote representative quality factors: {quarterly_path}", flush=True)

    daily_path = args.output_dir / "daily_quality_asof.csv"
    build_daily_asof(
        stock_dir=args.stock_dir,
        quality=quality,
        output_path=daily_path,
        start_date=args.start_date,
        end_date=args.end_date,
    )
    print(f"Wrote representative daily as-of panel: {daily_path}", flush=True)


if __name__ == "__main__":
    main()
