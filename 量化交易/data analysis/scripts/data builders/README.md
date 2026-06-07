# Data Builders

这里存放构建数据集和前端数据文件的脚本。

## 文件说明

- `build_quality_dataset.py`
  - 用途：从本地全量股票日线 CSV 和 BaoStock 财务接口构建质量因子数据。
  - 输入数据：`/Users/lilongjiang/Desktop/量化交易/trading-data.20260522/stock data`
  - 主要输出：`quality_dataset/daily_market_panel.csv`、`quality_dataset/quarterly_quality_factors.csv`、`quality_dataset/daily_quality_asof.csv`

- `build_akshare_quality_dataset.py`
  - 用途：用 AkShare 同花顺财务摘要接口更快地构建财务质量因子。
  - 输入数据：`quality_dataset/representative_universe.csv` 和本地 `stock data`
  - 主要输出：`quality_dataset/quarterly_quality_factors.csv`、`quality_dataset/akshare_quality_by_code/`

- `build_representative_dataset.py`
  - 用途：构建代表性 A 股训练样本，默认覆盖沪深 300、中证 500、中证 1000、创业板 50、科创 50 等范围。
  - 输入数据：本地 `stock data`，并通过 BaoStock 获取指数成分股。
  - 主要输出：`quality_dataset/representative_universe.csv`、`quality_dataset/daily_market_panel.csv`、`quality_dataset/quarterly_quality_factors.csv`

- `build_pair_pool_data.py`
  - 用途：把 `daily_market_panel.csv` 转成浏览器可直接加载的 `pair_pool_data.js`。
  - 输入数据：`quality_dataset/daily_market_panel.csv`、`quality_dataset/representative_universe.csv`
  - 主要输出：`data/frontend/pair_pool_data.js`

## 运行位置

建议在 `量化交易/data analysis` 目录下运行，例如：

```bash
python3 "scripts/data builders/build_pair_pool_data.py" \
  --panel quality_dataset/daily_market_panel.csv \
  --universe quality_dataset/representative_universe.csv \
  --output data/frontend/pair_pool_data.js
```
