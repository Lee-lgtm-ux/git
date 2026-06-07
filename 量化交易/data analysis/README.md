# 日线收益率分布分析平台

这是一个本地浏览器运行的轻量平台，用于上传股票日线 OHLCV 数据，计算每日收益率，并生成：

- 按股票分别生成的收益率统计分布图
- 股票相对任意对照数据的收益率散点图
- 股票与对照数据的相关系数、Beta、R² 总结表
- 内置全 A 股长期成长模型，对新上传股票做长期评分
- 按股票代码分组的 summary table
- 核心指标卡片
- 数据质量概览
- 手动选择分析日期区间
- 摘要 CSV 导出

## 使用方式

直接在浏览器打开 `index.html`，或在当前目录启动本地服务：

```bash
python3 -m http.server 8000
```

然后访问 `http://localhost:8000`。

## CSV 格式

至少需要日期列和价格列。若要衡量真实持有收益，优先使用包含分红、送转等公司行动的复权价格列，例如 `adjust_price_f`。

```csv
date,ticker,open,high,low,close,adjust_price_f,volume
2025-01-02,AAA,100.00,102.30,99.60,101.40,101.40,1820000
2025-01-03,AAA,101.40,103.10,100.80,102.20,102.35,1750000
```

如果列名不是 `date`、`adjust_price_f`、`ticker`，可以在页面左侧手动映射字段。

## 多股票与日期区间

当 CSV 中包含 `ticker` 或类似股票代码列时，平台会按股票分别计算收益率统计，并为每只股票单独生成一张收益率分布图。Summary table 中也会按股票代码分别列出统计结果。

页面左侧的“日期区间”会在导入数据后自动设置为数据的最早和最晚日期。调整开始日期或结束日期后，每只股票的分布图和 summary table 都会按新区间重新计算。

## 股票 vs 对照数据

平台已内置 `data/samples/shanghai_index.csv` 作为默认上证指数数据。导入股票 CSV 后，Summary table 会自动为每只股票计算 Alpha 因子和 Beta。

左侧“对照数据窗口”是独立的关系拟合工具，可以上传另一个股票、指数、行业指数、因子、商品、汇率或其他资产数据，用来和主数据做同日收益率散点图与线性拟合；它不会改变 Summary table 中默认以上证指数计算的 Alpha/Beta。

对照 CSV 至少需要日期列和价格/数值列；如果里面有多条序列，可以提供 ticker/code/name 列，然后在“对照序列”里选择其中一条。没有上传对照 CSV 时，对照窗口不会自动使用主数据里的股票。

Summary table 会对齐股票与内置上证指数的同一交易日收益率，并为每只股票生成：

- Alpha 因子：基于 CAPM 残差的日度 Alpha，`average((r_stock - rf_daily) - beta * (r_market - rf_daily))`
- Beta：股票对内置上证指数波动的敏感度
- 股票收益率 vs 对照数据收益率散点图
- 关系拟合截距：对照窗口中的 `r_stock = intercept + slope * r_compare`
- 相关系数：两者同向波动强弱
- R²：线性关系解释度

Alpha/Beta 功能默认使用内置上证指数。对照窗口如果上传了自己的 CSV，会优先把其中的上证指数、上证综指、沪指、`SH000001` 或 `000001.SH` 识别为对照序列；如果没有这些名称，可以在“对照序列”里手动选择，用于散点图和关系拟合。

`data/samples/benchmark_sample.csv` 是一个模拟对照数据文件，只用于测试功能，不是真实市场数据。

## 指标说明

- 简单收益率：`price_t / price_{t-1} - 1`；平台会优先自动选择 `adjust_price_f` 等复权价列，其次才选择 `close`
- 对数收益率：`ln(price_t / price_{t-1})`
- VaR 5%：收益率的 5% 分位数
- CVaR 5%：低于或等于 VaR 5% 的平均收益
- 下行风险：`sqrt(average(min(r_t - MARR, 0)^2))`，当前 `MARR = 0`
- 年化复利率：单股票使用 `CAGR = (期末价格 / 期初价格)^(年化交易日 / 区间交易日数) - 1`
- 若只有收益率序列没有价格序列，则使用 `CAGR = [∏(1 + r_t)]^(年化交易日 / n) - 1`
- 年化波动：`std(日收益率) × sqrt(年化交易日)`
- Sharpe：`mean(daily return - daily risk free rate) / std(daily return) * sqrt(annual trading days)`
- 无风险利率输入为年化百分比，默认 `0%`

## 长期成长模型评估

平台已经内置一个用全 A 股历史日线数据重新训练出的长期成长线性模型，目标是未来约 250 个交易日收益。上传新股票数据后，页面会取每只股票最新一期因子和历史走势进行评估，并输出：

- 综合评分：`60% × max(成长趋势分, 低估修复分) + 40% × 历史表现分`
- 参考等级：按综合评分分为高参考价值、较高参考价值、观察价值、谨慎观察、参考价值有限
- 成长趋势分：看估值、成交、动量、波动、回撤、均线偏离、换手变化和估值变化在全市场中的相对位置
- 低估修复分：单独看大回撤后企稳、低位反弹、均线修复、波动收缩和估值变化
- 历史表现分：看上传区间内的年化复利率、Sharpe、最大回撤、上涨占比和长期均线趋势
- 因子收益代理：成长因子模型输出的长期收益代理值，不是收益承诺
- 诊断：当历史走势和基本面因子互相矛盾时，直接标出“历史趋势强，基本面因子谨慎”等状态
- 主要贡献：对基本面因子分影响最大的因子贡献
- 模型解读：分开解释成长趋势模型和低估修复模型，例如成交拥挤、估值扩张、动量强弱、均线修复、回撤是否破坏趋势等

如果一只股票成长趋势或低估修复至少有一项比较好，综合评分会让这个信号被看见；历史表现仍作为约束项，避免仅凭单个因子直接给出过强结论。页面给出的是参考价值等级，不是直接买卖建议。

成长模型需要这些字段：换手率、PE、PS、PC、PB、成交额，并且至少有 251 个交易日用于计算 60/120/250 日动量、波动、回撤和估值变化。若你的列名是 `turnover`、`PE_TTM`、`PS_TTM`、`PC_TTM`、`PB`、`money`，页面通常会自动识别；否则可以在左侧手动映射。

这个模块更适合做候选池筛选和相对排序，而不是精确预测某只股票一年后涨多少。当前已重新生成代表性股票池和财务质量训练数据，新的模型结果见“当前财务质量模型训练”。后续仍需要组合回测、行业中性、交易成本等步骤后，才能更接近真实投资决策。

## 代表性训练 Dataset 构建

当前正式训练数据库放在 `quality_dataset/`，不是全市场 6096 只股票无差别合并，而是使用更适合训练的代表性股票池：

- 沪深300
- 中证500
- 中证1000
- 创业板50
- 科创50

时间窗口为近 10 年：`2016-01-01` 至 `2026-05-22`。当前生成结果为 `1,804` 只股票、`3,755,869` 行日线记录。

`scripts/data builders/build_representative_dataset.py` 用来重新生成这个正式数据库；`scripts/data builders/build_quality_dataset.py` 则提供底层合并日线和拉取财务质量因子的函数。

重新生成正式代表性日线数据库：

```bash
python3 "scripts/data builders/build_representative_dataset.py" \
  --skip-quality \
  --force
```

生成文件：

- `quality_dataset/representative_universe.csv`：代表性股票池，记录每只股票来自哪个指数。
- `quality_dataset/daily_market_panel.csv`：代表性股票池近 10 年日线面板，包含价格、成交、换手和估值字段。

正式数据库现在包含三层文件：

- `representative_universe.csv`：代表性股票池，记录每只股票来自哪个指数。
- `daily_market_panel.csv`：代表性股票池近 10 年日线面板，包含价格、成交、换手和估值字段。
- `quarterly_quality_factors.csv`：季度财务质量因子，`73,245` 行、`87` 列。
- `daily_quality_asof.csv`：把财务质量因子按可用日期合并到日线后的训练表，`3,755,869` 行。

财务质量因子来自 AkShare 的同花顺财务摘要接口。由于接口返回的是报告期而不是精确公告日，脚本使用保守可用日期估计：年报滞后 120 天，半年报滞后 75 天，一季报和三季报滞后 45 天，用来降低未来函数风险。

如果后续要重新补充公司质量因子，可以运行：

```bash
python3 "scripts/data builders/build_akshare_quality_dataset.py" \
  --force
```

这会继续生成：

- `quarterly_quality_factors.csv`：按股票和报告期整理的季度财务质量因子。
- `daily_quality_asof.csv`：按保守可用日期把最近一期财务因子合并到每日行情。
- `akshare_quality_by_code/`：每只股票的财务因子缓存，支持中断后续跑。

常用可选训练字段包括 ROE、资产负债率、EPS、每股经营现金流、净利率、营收同比、归母净利润同比、扣非净利润同比、净资产、资本公积、未分配利润等。

## 当前财务趋势模型训练

当前已改为独立财务趋势模型：只使用 `quality_dataset/quarterly_quality_factors.csv`，不使用日线价格、成交、换手、估值和技术指标。模型目标不是预测股价收益，而是预测未来 4 个季度财务质量综合分的改善幅度。

财务质量综合分由 ROE、毛利率、净利率、经营现金流、营收增长、利润增长、扣非利润增长、资产负债率等字段的横截面百分位合成。资产负债率为反向指标，越低越好。

训练命令：

```bash
python3 "scripts/models/train_quality_trend_model.py" \
  --output-dir "results/model outputs/model_outputs_quality_trend_change_hgb_v1" \
  --model hgb \
  --target future_change \
  --future-quarters 4 \
  --test-start 2023-01-01
```

当前保留模型：

- `results/model outputs/model_outputs_quality_trend_change_hgb_v1/`：非线性财务趋势模型，排序效果略强。
- `results/model outputs/model_outputs_quality_trend_change_ridge_v1/`：线性基准模型，R² 略强且更容易解释。
- 对比表：`data/samples/quality_trend_model_comparison.csv`

样本外结果：

- 训练期：`2016-03-31` 至 `2022-12-31`
- 测试期：`2023-03-31` 至 `2025-03-31`
- 训练样本：`32,756` 行
- 测试样本：`14,041` 行
- HGB 测试 R²：`0.311`
- HGB Rank IC 均值：`0.542`
- HGB Rank IC 为正期数：`100%`
- HGB 最高预测组相对最低预测组，未来 4 季度质量分改善多约 `31.38` 分

解释：这个模型判断的是“未来基本面质量是否改善”，不是“未来股价涨多少”。它可以作为长期基本面观察层，后续再单独叠加估值和市场价格确认。

## 财务趋势信号与收益验证

财务趋势模型训练后，已用样本外测试期预测分验证其与未来收益的关系。验证逻辑是：在财务数据可用日 `pubDate` 买入，观察未来 250/500 个交易日收益。

HGB 财务趋势信号验证结果：

- 未来 250 日 Rank IC：`0.022`
- 未来 250 日最高组 - 最低组：`0.50%`
- 未来 500 日 Rank IC：`0.097`
- 未来 500 日最高组 - 最低组：`18.33%`

解释：财务改善信号和 250 日收益关系较弱，和 500 日收益的关系更明显，但 500 日可验证季度目前只有 3 个，因此只能作为早期证据。前端平台中的“财务趋势预测”板块会把它定位为长期基本面改善信号，而不是短期收益预测。

验证输出目录：

- `results/validation/quality_signal_return_validation_hgb/`
- `results/validation/quality_signal_return_validation_ridge/`

前端测试样本：

- `data/samples/quality_trend_sample.csv`

可视化平台已加入“财务趋势预测”板块。上传含 `quality_` 财务因子、`statDate`/`pubDate` 的 CSV 后，会显示：

- 当前财务质量分
- 预测未来 4 个季度质量改善幅度
- 趋势等级
- 收益关联验证提示
- 主要财务驱动项
- 模型解读

平台左侧已经有独立的“财务数据窗口”。日线 CSV 和财务 CSV 可以分开上传：

- 日线数据窗口：用于收益率分布、summary table、对照散点图、原来的长期成长/修复模型。
- 财务数据窗口：用于财务趋势预测，可以只上传季度财务表，不必同时上传日线数据。
- 如果主日线 CSV 自身已经包含 `quality_` 财务字段，平台也可以直接从主数据中计算财务趋势；但只要上传了单独财务 CSV，会优先使用财务窗口里的数据。

本地测试页面：

```bash
python3 -m http.server 8001
```

然后访问：

```text
http://127.0.0.1:8001/index.html?sample=quality
```

只测试独立财务数据窗口：

```text
http://127.0.0.1:8001/index.html?sample=finance
```

## 财务质量 Dataset 构建

先做一个小样本验证：

```bash
python3 "scripts/data builders/build_quality_dataset.py" \
  --start-year 2023 \
  --end-year 2023 \
  --codes sh600519 sz300750 sh600989 \
  --output-dir quality_dataset_quick \
  --daily-market \
  --daily-asof \
  --force
```

常用财务质量字段包括：

- 盈利质量：ROE、净利率、毛利率、EPS、净利润
- 成长质量：净利润同比、EPS 同比、归母净利润同比、资产/权益同比
- 运营效率：应收周转、存货周转、流动资产周转、总资产周转
- 财务稳健：流动比率、速动比率、现金比率、资产负债率
- 现金流质量：经营现金流/收入、经营现金流/净利润、经营现金流/总资产
- 杜邦拆解：杜邦 ROE、资产周转、权益乘数、税负/利息负担等

如需对自定义股票池分阶段拉财务因子，例如先跑近几年：

```bash
python3 "scripts/data builders/build_quality_dataset.py" \
  --start-year 2018 \
  --end-year 2026 \
  --output-dir quality_dataset \
  --daily-market \
  --daily-asof
```

如果只想先把你本地已有的全部股票日线合并成一个面板，不联网拉财务数据：

```bash
python3 "scripts/data builders/build_quality_dataset.py" \
  --output-dir quality_dataset \
  --daily-market \
  --skip-quality \
  --force
```

全 A 股、全年份、六张财务表会产生大量接口请求，可能需要较长时间。脚本会按股票缓存结果，因此中断后再次运行同一命令会复用已经完成的股票。

## 分布图说明

每只股票的分布图使用概率密度口径：

- 柱状图：每日收益率的经验概率密度
- 红线：使用该股票样本均值 `mean` 和标准差 `sigma` 生成的正态参考曲线
- 黄线：样本均值位置
- x 轴：日收益率
- y 轴：概率密度，不是上涨概率，也不是样本个数
