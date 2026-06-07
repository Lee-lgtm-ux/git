#!/usr/bin/env python3
"""Rank stock-pool matches by pair-trading SSD distance.

The script compares one uploaded/target stock file with every stock in a
market-panel CSV. Prices are aligned on common dates, normalized to their first
overlapping price, and ranked by sum of squared differences.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import pandas as pd


DATE_CANDIDATES = ("date", "日期", "交易日期", "trade_date")
CODE_CANDIDATES = ("code", "ticker", "symbol", "股票代码", "证券代码")
PRICE_CANDIDATES = (
    "adjust_price_f",
    "adj_close",
    "adjust_price",
    "复权收盘价",
    "后复权收盘价",
    "close",
    "收盘",
    "收盘价",
)


def pick_column(df: pd.DataFrame, requested: str | None, candidates: tuple[str, ...], label: str) -> str:
    if requested:
        if requested not in df.columns:
            raise ValueError(f"{label} column '{requested}' not found. Available: {list(df.columns)}")
        return requested

    normalized = {str(col).strip().lower(): col for col in df.columns}
    for candidate in candidates:
        if candidate.lower() in normalized:
            return normalized[candidate.lower()]

    raise ValueError(f"Could not infer {label} column. Available: {list(df.columns)}")


def load_price_series(
    path: Path,
    *,
    date_col: str | None = None,
    price_col: str | None = None,
    code_col: str | None = None,
    code: str | None = None,
) -> tuple[str, pd.Series]:
    df = pd.read_csv(path)
    date_col = pick_column(df, date_col, DATE_CANDIDATES, "date")
    price_col = pick_column(df, price_col, PRICE_CANDIDATES, "price")

    inferred_code = path.stem
    if code_col or code or any(str(col).strip().lower() in CODE_CANDIDATES for col in df.columns):
        try:
            code_col = pick_column(df, code_col, CODE_CANDIDATES, "code")
        except ValueError:
            code_col = None
        if code_col:
            if code:
                df = df[df[code_col].astype(str) == str(code)]
                inferred_code = code
            elif df[code_col].nunique(dropna=True) == 1:
                inferred_code = str(df[code_col].dropna().iloc[0])

    df = df[[date_col, price_col]].copy()
    df[date_col] = pd.to_datetime(df[date_col], errors="coerce")
    df[price_col] = pd.to_numeric(df[price_col], errors="coerce")
    df = df.dropna(subset=[date_col, price_col])
    df = df[df[price_col] > 0]
    df = df.sort_values(date_col).drop_duplicates(date_col, keep="last")

    if df.empty:
        raise ValueError(f"No valid positive prices found in {path}")

    return inferred_code, df.set_index(date_col)[price_col]


def normalize(series: pd.Series) -> pd.Series:
    first = series.iloc[0]
    if first <= 0:
        raise ValueError("Cannot normalize a series whose first price is non-positive")
    return series / first


def rank_ssd(
    target: pd.Series,
    panel_path: Path,
    *,
    panel_date_col: str | None = None,
    panel_code_col: str | None = None,
    panel_price_col: str | None = None,
    min_overlap: int = 120,
    start_date: str | None = None,
    end_date: str | None = None,
) -> pd.DataFrame:
    panel = pd.read_csv(panel_path)
    date_col = pick_column(panel, panel_date_col, DATE_CANDIDATES, "panel date")
    code_col = pick_column(panel, panel_code_col, CODE_CANDIDATES, "panel code")
    price_col = pick_column(panel, panel_price_col, PRICE_CANDIDATES, "panel price")

    panel = panel[[code_col, date_col, price_col]].copy()
    panel[date_col] = pd.to_datetime(panel[date_col], errors="coerce")
    panel[price_col] = pd.to_numeric(panel[price_col], errors="coerce")
    panel = panel.dropna(subset=[code_col, date_col, price_col])
    panel = panel[panel[price_col] > 0]

    if start_date:
        start = pd.to_datetime(start_date)
        target = target[target.index >= start]
        panel = panel[panel[date_col] >= start]
    if end_date:
        end = pd.to_datetime(end_date)
        target = target[target.index <= end]
        panel = panel[panel[date_col] <= end]

    target = target.sort_index()
    rows: list[dict[str, object]] = []

    for code, stock_df in panel.groupby(code_col, sort=False):
        stock = (
            stock_df.sort_values(date_col)
            .drop_duplicates(date_col, keep="last")
            .set_index(date_col)[price_col]
        )
        aligned = pd.concat({"target": target, "candidate": stock}, axis=1, join="inner").dropna()
        if len(aligned) < min_overlap:
            continue

        target_norm = normalize(aligned["target"])
        candidate_norm = normalize(aligned["candidate"])
        diff = target_norm - candidate_norm
        ssd = float((diff * diff).sum())
        rows.append(
            {
                "candidate_code": str(code),
                "ssd": ssd,
                "overlap_days": int(len(aligned)),
                "start_date": aligned.index.min().date().isoformat(),
                "end_date": aligned.index.max().date().isoformat(),
                "target_end_norm": float(target_norm.iloc[-1]),
                "candidate_end_norm": float(candidate_norm.iloc[-1]),
            }
        )

    if not rows:
        raise ValueError(f"No candidates met min_overlap={min_overlap}. Try lowering --min-overlap.")

    return pd.DataFrame(rows).sort_values("ssd", ascending=False).reset_index(drop=True)


def main() -> None:
    parser = argparse.ArgumentParser(description="Rank worst SSD matches for pair-trading research.")
    parser.add_argument("target_file", type=Path, help="CSV containing the stock to compare against the pool.")
    parser.add_argument("--panel", type=Path, default=Path("quality_dataset/daily_market_panel.csv"))
    parser.add_argument("--top", type=int, default=10, help="Number of worst matches to print.")
    parser.add_argument("--min-overlap", type=int, default=120, help="Minimum common trading days required.")
    parser.add_argument("--start-date", help="Optional formation-period start date, e.g. 2022-01-01.")
    parser.add_argument("--end-date", help="Optional formation-period end date, e.g. 2025-12-31.")
    parser.add_argument("--target-code", help="If target CSV has multiple stocks, choose this code.")
    parser.add_argument("--target-date-col")
    parser.add_argument("--target-code-col")
    parser.add_argument("--target-price-col")
    parser.add_argument("--panel-date-col")
    parser.add_argument("--panel-code-col")
    parser.add_argument("--panel-price-col")
    parser.add_argument("--output", type=Path, help="Optional CSV path for the full ranking.")
    args = parser.parse_args()

    target_code, target = load_price_series(
        args.target_file,
        date_col=args.target_date_col,
        price_col=args.target_price_col,
        code_col=args.target_code_col,
        code=args.target_code,
    )
    ranking = rank_ssd(
        target,
        args.panel,
        panel_date_col=args.panel_date_col,
        panel_code_col=args.panel_code_col,
        panel_price_col=args.panel_price_col,
        min_overlap=args.min_overlap,
        start_date=args.start_date,
        end_date=args.end_date,
    )

    if args.output:
        ranking.to_csv(args.output, index=False)

    print(f"Target: {target_code}")
    print(f"Panel: {args.panel}")
    print(f"Ranking: worst {args.top} matches by SSD (higher = less similar)")
    print(ranking.head(args.top).to_string(index=True))
    if args.output:
        print(f"\nFull ranking saved to: {args.output}")


if __name__ == "__main__":
    main()
