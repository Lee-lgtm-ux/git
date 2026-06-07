#!/usr/bin/env python3
"""Build browser-ready price pool data for SSD pair-trading analysis."""

from __future__ import annotations

import argparse
import csv
import json
from collections import defaultdict
from pathlib import Path


def load_names(path: Path) -> dict[str, str]:
    if not path.exists():
        return {}
    with path.open("r", encoding="utf-8-sig", newline="") as file:
        reader = csv.DictReader(file)
        return {row.get("code", ""): row.get("name", "") for row in reader if row.get("code")}


def build_pool(panel_path: Path, universe_path: Path, output_path: Path, price_col: str) -> None:
    names = load_names(universe_path)
    date_set: set[str] = set()
    by_code: dict[str, dict[str, float]] = defaultdict(dict)

    with panel_path.open("r", encoding="utf-8-sig", newline="") as file:
        reader = csv.DictReader(file)
        for row in reader:
            code = (row.get("code") or "").strip()
            date = (row.get("date") or "").strip()
            raw_price = row.get(price_col)
            if not code or not date or raw_price in (None, ""):
                continue
            try:
                price = float(raw_price)
            except ValueError:
                continue
            if price <= 0:
                continue
            date_set.add(date)
            by_code[code][date] = round(price, 4)

    dates = sorted(date_set)
    series = []
    for code in sorted(by_code):
        price_map = by_code[code]
        prices = [price_map.get(date) for date in dates]
        series.append({"code": code, "name": names.get(code, ""), "p": prices})

    payload = {"priceColumn": price_col, "dates": dates, "series": series}
    with output_path.open("w", encoding="utf-8") as file:
        file.write("window.pairTradingPool = ")
        json.dump(payload, file, ensure_ascii=False, separators=(",", ":"))
        file.write(";\n")

    print(f"Wrote {output_path} with {len(series)} stocks and {len(dates)} dates.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Create pair_pool_data.js from daily_market_panel.csv.")
    parser.add_argument("--panel", type=Path, default=Path("quality_dataset/daily_market_panel.csv"))
    parser.add_argument("--universe", type=Path, default=Path("quality_dataset/representative_universe.csv"))
    parser.add_argument("--output", type=Path, default=Path("pair_pool_data.js"))
    parser.add_argument("--price-col", default="adjust_price_f")
    args = parser.parse_args()
    build_pool(args.panel, args.universe, args.output, args.price_col)


if __name__ == "__main__":
    main()
