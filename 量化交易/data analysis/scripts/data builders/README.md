# Data Builders

这个目录存放“数据构建脚本”。它们不是模型本身，而是给模型训练、网页展示和策略分析准备输入数据。

建议在 `量化交易/data analysis` 目录下运行这些脚本，这样默认路径会比较一致。

## build_quality_dataset.py

这个脚本是质量因子训练数据库的底层构建脚本。

它主要做三件事：

1. 读取本地股票日线 CSV
   - 默认路径：`/Users/lilongjiang/Desktop/量化交易/trading-data.20260522/stock data`
   - 数据内容：每日价格、成交额、换手率、PE/PS/PC/PB 等市场和估值字段

2. 从 BaoStock 拉取季度财务质量数据
   - `profit`：盈利能力
   - `operation`：运营能力
   - `growth`：成长能力
   - `balance`：资产负债
   - `cashflow`：现金流
   - `dupont`：杜邦分析

3. 把日线数据和季度财务数据整理成训练用表
   - `quality_dataset/daily_market_panel.csv`：所有股票的日线行情面板
   - `quality_dataset/quarterly_quality_factors.csv`：每只股票每个季度一行的财务质量因子
   - `quality_dataset/daily_quality_asof.csv`：按财务数据可用日期合并到日线后的训练表

这个脚本特别注意避免未来函数：财务数据合并到日线时使用 `pubDate`，不是直接用报告期结束日。

适合什么时候用：

- 想从头构建质量因子数据库
- 想重新生成 `daily_market_panel.csv`
- 想把财务数据和日线数据合并成模型可用的训练表

常用命令：

```bash
python3 "scripts/data builders/build_quality_dataset.py" \
  --output-dir quality_dataset \
  --daily-market \
  --daily-asof \
  --force
```

如果只想合并本地日线，不联网拉财务数据：

```bash
python3 "scripts/data builders/build_quality_dataset.py" \
  --output-dir quality_dataset \
  --daily-market \
  --skip-quality \
  --force
```

## build_akshare_quality_dataset.py

这个脚本也是构建财务质量因子，但数据来源换成 AkShare 的同花顺财务摘要接口。

它主要做三件事：

1. 读取代表性股票池
   - 默认输入：`quality_dataset/representative_universe.csv`
   - 这个文件通常由 `build_representative_dataset.py` 生成

2. 通过 AkShare 获取每只股票的历史财务摘要
   - 包括 ROE、毛利率、净利率、营收增长、利润增长、资产负债率等指标
   - 每只股票的数据会缓存到 `quality_dataset/akshare_quality_by_code/`

3. 生成质量因子表和日线合并表
   - `quality_dataset/quarterly_quality_factors.csv`
   - `quality_dataset/daily_quality_asof.csv`

这个脚本和 BaoStock 版本的区别：

- AkShare 接口一次返回的历史财务指标更多，通常更快
- 但它没有精确公告日，所以脚本使用保守可用日期估计：
  - 年报：报告期后 120 天
  - 半年报：报告期后 75 天
  - 一季报/三季报：报告期后 45 天

适合什么时候用：

- 想更快构建财务质量因子
- 已经有 `representative_universe.csv`
- 接受用保守可用日期来降低未来函数风险

常用命令：

```bash
python3 "scripts/data builders/build_akshare_quality_dataset.py" \
  --force
```

## build_representative_dataset.py

这个脚本用来构建一个“代表性 A 股研究样本”，不是直接使用全市场所有股票。

默认覆盖的股票池：

- 沪深 300
- 中证 500
- 中证 1000
- 创业板 50
- 科创 50

它主要做四件事：

1. 通过 BaoStock 获取指数成分股
2. 和本地 `stock data` 文件夹对齐，只保留本地有 CSV 的股票
3. 生成代表性股票池清单
4. 调用质量因子和日线构建逻辑，生成后续训练用数据

主要输出：

- `quality_dataset/representative_universe.csv`：代表性股票池，记录股票来自哪个指数
- `quality_dataset/daily_market_panel.csv`：代表性股票池的日线面板
- `quality_dataset/quarterly_quality_factors.csv`：代表性股票池的季度财务质量因子
- `quality_dataset/daily_quality_asof.csv`：日线和财务质量因子合并后的训练表

适合什么时候用：

- 不想直接用全 A 股，想先用代表性股票池训练和验证
- 想让样本覆盖大盘、中盘、小盘、创业板、科创板
- 想重新生成正式训练数据库

常用命令：

```bash
python3 "scripts/data builders/build_representative_dataset.py" \
  --skip-quality \
  --force
```

如果要同时重新构建质量因子，可以去掉 `--skip-quality`。

## build_pair_pool_data.py

这个脚本服务于网页里的“配对交易 SSD”功能。

它主要做三件事：

1. 读取日线行情面板
   - 默认输入：`quality_dataset/daily_market_panel.csv`
   - 使用价格列：默认 `adjust_price_f`

2. 读取代表性股票池名称
   - 默认输入：`quality_dataset/representative_universe.csv`

3. 生成浏览器可直接加载的 JS 数据文件
   - 默认输出：`data/frontend/pair_pool_data.js`
   - 页面会把它加载成 `window.pairTradingPool`

这个文件会被 `index.html` 直接使用。如果删除或路径不对，网页里的配对交易股票池功能会缺数据。

适合什么时候用：

- 更新了 `daily_market_panel.csv`
- 更新了代表性股票池
- 想让前端页面使用最新的配对交易股票池数据

常用命令：

```bash
python3 "scripts/data builders/build_pair_pool_data.py" \
  --panel quality_dataset/daily_market_panel.csv \
  --universe quality_dataset/representative_universe.csv \
  --output data/frontend/pair_pool_data.js
```

## 推荐的数据构建顺序

如果从零开始重建数据，可以按这个顺序：

1. 构建代表性股票池和日线面板

```bash
python3 "scripts/data builders/build_representative_dataset.py" \
  --skip-quality \
  --force
```

2. 构建财务质量因子

```bash
python3 "scripts/data builders/build_akshare_quality_dataset.py" \
  --force
```

3. 构建前端配对交易池数据

```bash
python3 "scripts/data builders/build_pair_pool_data.py" \
  --panel quality_dataset/daily_market_panel.csv \
  --universe quality_dataset/representative_universe.csv \
  --output data/frontend/pair_pool_data.js
```

完成后，模型训练脚本就可以使用 `quality_dataset/` 里的数据。
