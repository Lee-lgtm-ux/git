#!/usr/bin/env python3
"""
Build A-share quality-factor datasets from BaoStock quarterly financial APIs.

Outputs:
- daily_market_panel.csv: local all-stock daily market/valuation panel.
- quarterly_quality_factors.csv: one row per stock/report quarter.
- daily_quality_asof.csv: optional daily panel merged by disclosure date.

The daily merge uses pubDate, not report period end date, to reduce look-ahead bias.
"""

from __future__ import annotations

import argparse
import time
from pathlib import Path

import numpy as np
import pandas as pd
from pandas.errors import EmptyDataError


DEFAULT_STOCK_DIR = Path("/Users/lilongjiang/Desktop/量化交易/trading-data.20260522/stock data")
DEFAULT_OUTPUT_DIR = Path("quality_dataset")

QUERY_SPECS = {
    "profit": "query_profit_data",
    "operation": "query_operation_data",
    "growth": "query_growth_data",
    "balance": "query_balance_data",
    "cashflow": "query_cash_flow_data",
    "dupont": "query_dupont_data",
}

DEFAULT_TABLES = tuple(QUERY_SPECS.keys())

DAILY_KEEP_COLS = [
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
    "PE_TTM",
    "PS_TTM",
    "PC_TTM",
    "PB",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build A-share quality-factor dataset.")
    parser.add_argument("--stock-dir", type=Path, default=DEFAULT_STOCK_DIR)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--start-year", type=int, default=2005)
    parser.add_argument("--end-year", type=int, default=2026)
    parser.add_argument("--start-date", default=None, help="Optional daily start date, e.g. 2016-01-01.")
    parser.add_argument("--end-date", default=None, help="Optional daily end date, e.g. 2026-05-22.")
    parser.add_argument("--max-stocks", type=int, default=0, help="For quick tests; 0 means all local stock files.")
    parser.add_argument("--codes", nargs="*", default=None, help="Optional explicit local codes, e.g. sh600519 sz300750.")
    parser.add_argument("--sleep", type=float, default=0.02, help="Pause between BaoStock requests.")
    parser.add_argument(
        "--tables",
        nargs="+",
        choices=sorted(QUERY_SPECS),
        default=list(DEFAULT_TABLES),
        help="BaoStock financial tables to fetch.",
    )
    parser.add_argument("--daily-market", action="store_true", help="Build local all-stock daily market panel.")
    parser.add_argument("--daily-asof", action="store_true", help="Also build daily panel merged by pubDate.")
    parser.add_argument("--skip-quality", action="store_true", help="Only build requested local daily outputs.")
    parser.add_argument("--force", action="store_true", help="Overwrite existing outputs.")
    return parser.parse_args()


def local_universe(stock_dir: Path, max_stocks: int = 0) -> list[str]:
    files = sorted(stock_dir.glob("*.csv"))
    codes = [path.stem for path in files]
    if max_stocks:
        codes = codes[:max_stocks]
    return codes


def requested_universe(stock_dir: Path, max_stocks: int = 0, codes: list[str] | None = None) -> list[str]:
    if codes:
        normalized = [code.strip().lower().replace(".", "") for code in codes if code.strip()]
        return normalized[:max_stocks] if max_stocks else normalized
    return local_universe(stock_dir, max_stocks)


def to_baostock_code(code: str) -> str:
    text = code.strip().lower().replace(".", "")
    if text.startswith(("sh", "sz", "bj")):
        return f"{text[:2]}.{text[2:]}"
    if text.startswith("6"):
        return f"sh.{text}"
    if text.startswith(("0", "3")):
        return f"sz.{text}"
    if text.startswith(("4", "8")):
        return f"bj.{text}"
    raise ValueError(f"Cannot infer exchange for code: {code}")


def from_baostock_code(code: str) -> str:
    return code.replace(".", "").lower()


def fetch_one_table(bs, query_name: str, code: str, year: int, quarter: int) -> pd.DataFrame:
    query = getattr(bs, query_name)
    rs = query(code=code, year=year, quarter=quarter)
    rows = []
    while (rs.error_code == "0") and rs.next():
        rows.append(rs.get_row_data())
    if rs.error_code != "0":
        return pd.DataFrame()
    if not rows:
        return pd.DataFrame()
    return pd.DataFrame(rows, columns=rs.fields)


def prefix_factor_columns(df: pd.DataFrame, prefix: str) -> pd.DataFrame:
    keys = {"code", "pubDate", "statDate"}
    renamed = {col: f"{prefix}_{col}" for col in df.columns if col not in keys}
    return df.rename(columns=renamed)


def build_daily_market_panel(
    stock_dir: Path,
    output_path: Path,
    max_stocks: int = 0,
    codes: list[str] | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
) -> None:
    codes = requested_universe(stock_dir, max_stocks, codes)
    first = True
    for index, code in enumerate(codes, start=1):
        stock_path = stock_dir / f"{code}.csv"
        try:
            daily = pd.read_csv(stock_path)
        except Exception as exc:
            print(f"Skip {stock_path.name}: {exc}", flush=True)
            continue
        if daily.empty:
            continue
        if "code" not in daily.columns:
            daily.insert(0, "code", code)
        else:
            daily["code"] = daily["code"].fillna(code).astype(str)
        daily = filter_daily_dates(daily, start_date, end_date)
        if daily.empty:
            continue
        daily.to_csv(output_path, mode="w" if first else "a", header=first, index=False)
        first = False
        if index % 500 == 0:
            print(f"Wrote daily market panel {index:,}/{len(codes):,} codes", flush=True)


def fetch_quality_factors(
    codes: list[str],
    start_year: int,
    end_year: int,
    sleep: float,
    tables: list[str],
    cache_dir: Path,
    force: bool,
) -> pd.DataFrame:
    try:
        import baostock as bs
    except ImportError as exc:
        raise RuntimeError("Missing package: baostock. Install with `python3 -m pip install baostock`.") from exc

    login = bs.login()
    if login.error_code != "0":
        raise RuntimeError(f"BaoStock login failed: {login.error_msg}")

    all_rows = []
    try:
        cache_dir.mkdir(parents=True, exist_ok=True)
        total_jobs = len(codes) * (end_year - start_year + 1) * 4
        done = 0
        for local_code in codes:
            cache_path = cache_dir / f"{local_code}.csv"
            if cache_path.exists() and not force:
                try:
                    cached = pd.read_csv(cache_path, parse_dates=["pubDate", "statDate"])
                except EmptyDataError:
                    cached = pd.DataFrame()
                if not cached.empty:
                    all_rows.append(cached)
                done += (end_year - start_year + 1) * 4
                continue

            bs_code = to_baostock_code(local_code)
            code_rows = []
            for year in range(start_year, end_year + 1):
                for quarter in range(1, 5):
                    pieces = []
                    for prefix in tables:
                        query_name = QUERY_SPECS[prefix]
                        frame = fetch_one_table(bs, query_name, bs_code, year, quarter)
                        if not frame.empty:
                            pieces.append(prefix_factor_columns(frame, prefix))
                        if sleep:
                            time.sleep(sleep)
                    merged = merge_quarter_pieces(pieces)
                    if not merged.empty:
                        merged["code"] = from_baostock_code(bs_code)
                        merged["year"] = year
                        merged["quarter"] = quarter
                        code_rows.append(merged)
                    done += 1
                    if done % 1000 == 0:
                        print(f"Fetched {done:,}/{total_jobs:,} stock-quarter jobs; rows: {sum(len(x) for x in all_rows):,}", flush=True)
            if code_rows:
                code_frame = normalize_quality_frame(pd.concat(code_rows, ignore_index=True))
                code_frame.to_csv(cache_path, index=False)
                all_rows.append(code_frame)
            else:
                pd.DataFrame(columns=["code", "pubDate", "statDate", "year", "quarter"]).to_csv(cache_path, index=False)
    finally:
        bs.logout()

    if not all_rows:
        return pd.DataFrame(columns=["code", "pubDate", "statDate", "year", "quarter"])
    out = pd.concat(all_rows, ignore_index=True)
    out = normalize_quality_frame(out)
    return out


def merge_quarter_pieces(pieces: list[pd.DataFrame]) -> pd.DataFrame:
    if not pieces:
        return pd.DataFrame()
    merged = pieces[0]
    for frame in pieces[1:]:
        keys = [key for key in ["code", "pubDate", "statDate"] if key in merged.columns and key in frame.columns]
        if not keys:
            keys = ["code"] if "code" in merged.columns and "code" in frame.columns else None
        merged = merged.merge(frame, on=keys, how="outer") if keys else pd.concat([merged, frame], axis=1)
    return merged


def normalize_quality_frame(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    for col in ["pubDate", "statDate"]:
        if col in out.columns:
            out[col] = pd.to_datetime(out[col], errors="coerce")
    out = out.dropna(subset=["code", "pubDate"])
    for col in out.columns:
        if col in {"code", "pubDate", "statDate", "year", "quarter"}:
            continue
        out[col] = pd.to_numeric(out[col], errors="coerce")
    out = out.sort_values(["code", "pubDate", "statDate", "year", "quarter"]).drop_duplicates(
        subset=["code", "pubDate", "statDate", "year", "quarter"],
        keep="last",
    )
    return out


def filter_daily_dates(df: pd.DataFrame, start_date: str | None, end_date: str | None) -> pd.DataFrame:
    if "date" not in df.columns or (not start_date and not end_date):
        return df
    out = df.copy()
    out["date"] = pd.to_datetime(out["date"], errors="coerce")
    if start_date:
        out = out[out["date"] >= pd.to_datetime(start_date)]
    if end_date:
        out = out[out["date"] <= pd.to_datetime(end_date)]
    return out


def build_daily_asof(
    stock_dir: Path,
    quality: pd.DataFrame,
    output_path: Path,
    max_stocks: int = 0,
    start_date: str | None = None,
    end_date: str | None = None,
) -> None:
    if quality.empty or not {"code", "pubDate"}.issubset(quality.columns):
        pd.DataFrame().to_csv(output_path, index=False)
        return
    quality = quality.sort_values(["code", "pubDate"])
    codes = sorted(quality["code"].dropna().unique())
    if max_stocks:
        codes = codes[:max_stocks]

    first = True
    for index, code in enumerate(codes, start=1):
        stock_path = stock_dir / f"{code}.csv"
        if not stock_path.exists():
            continue
        daily = pd.read_csv(stock_path, usecols=lambda col: col in DAILY_KEEP_COLS)
        if daily.empty:
            continue
        daily["date"] = pd.to_datetime(daily["date"], errors="coerce")
        daily = daily.dropna(subset=["date"]).sort_values("date")
        daily = filter_daily_dates(daily, start_date, end_date)
        if daily.empty:
            continue
        q = quality[quality["code"] == code].sort_values("pubDate")
        if q.empty:
            continue
        merged = pd.merge_asof(daily, q, left_on="date", right_on="pubDate", by="code", direction="backward")
        merged.to_csv(output_path, mode="w" if first else "a", header=first, index=False)
        first = False
        if index % 500 == 0:
            print(f"Merged daily as-of {index:,}/{len(codes):,} codes", flush=True)


def main() -> None:
    args = parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    market_path = args.output_dir / "daily_market_panel.csv"
    quarterly_path = args.output_dir / "quarterly_quality_factors.csv"
    daily_path = args.output_dir / "daily_quality_asof.csv"

    if args.daily_market:
        if market_path.exists() and not args.force:
            print(f"Daily market panel already exists: {market_path}")
        else:
            build_daily_market_panel(
                args.stock_dir,
                market_path,
                args.max_stocks,
                args.codes,
                args.start_date,
                args.end_date,
            )
            print(f"Wrote daily market panel: {market_path}")

    if args.skip_quality:
        return

    if quarterly_path.exists() and not args.force:
        quality = pd.read_csv(quarterly_path, parse_dates=["pubDate", "statDate"])
        print(f"Loaded existing quarterly dataset: {quarterly_path}")
    else:
        codes = requested_universe(args.stock_dir, args.max_stocks, args.codes)
        print(f"Fetching quality factors for {len(codes):,} local A-share codes")
        quality = fetch_quality_factors(
            codes=codes,
            start_year=args.start_year,
            end_year=args.end_year,
            sleep=args.sleep,
            tables=args.tables,
            cache_dir=args.output_dir / "quarterly_by_code",
            force=args.force,
        )
        quality.to_csv(quarterly_path, index=False)
        print(f"Wrote {len(quality):,} quarterly rows: {quarterly_path}")

    if args.daily_asof:
        if daily_path.exists() and not args.force:
            print(f"Daily as-of dataset already exists: {daily_path}")
        else:
            build_daily_asof(args.stock_dir, quality, daily_path, args.max_stocks, args.start_date, args.end_date)
            print(f"Wrote daily as-of dataset: {daily_path}")


if __name__ == "__main__":
    main()
