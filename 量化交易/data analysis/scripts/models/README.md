# Models

这个目录存放“模型训练脚本”。这些脚本不会凭空生成模型，而是把前面 `data builders/` 生成的数据整理成特征和目标，再用机器学习方法训练、评估、输出结果。

建议在 `量化交易/data analysis` 目录下运行这些脚本。

## train_quality_trend_model.py

这个脚本训练的是“财务质量趋势模型”。

一句话理解：它不是预测股价涨跌，而是预测一家公司未来几个季度的基本面质量会不会变好。

### 模型从哪里来

训练数据来自：

```text
quality_dataset/quarterly_quality_factors.csv
```

这个文件通常由 `scripts/data builders/build_akshare_quality_dataset.py` 或 `scripts/data builders/build_quality_dataset.py` 生成。

每一行大致代表：

```text
某只股票 + 某个财报季度 + 当时可见的财务质量指标
```

### 训练目标怎么构造

脚本先用财务指标合成一个 `quality_score`，也就是“当前财务质量综合分”。

参与综合分的指标包括：

- ROE
- 毛利率
- 净利率
- 经营现金流质量
- 营收增长
- 利润增长
- 扣非利润增长
- 资产负债率

其中资产负债率是反向指标，越低越好。

然后脚本会取未来第 `future_quarters` 个季度的质量分：

```text
future_quality_score = 未来 N 个季度后的 quality_score
```

如果参数是：

```bash
--future-quarters 4
--target future_change
```

那么模型目标就是：

```text
future_quality_score_chg = 未来 4 个季度后的质量分 - 当前质量分
```

也就是说，模型学习的是：

```text
现在的财务特征 -> 未来 4 个季度财务质量改善幅度
```

### 特征怎么生成

脚本会使用原始财务质量因子，也会为部分指标生成趋势特征：

- 当前值
- 过去 4 个季度变化
- 过去 4 个季度平均值
- 当前综合质量分
- 综合质量分过去 4 季度变化
- 综合质量分过去 4 季度平均值

之后，脚本会在每个财报期横截面内做标准化：

```text
z_feature = 同一季度内该指标的 z-score
```

这样做是为了比较同一时期不同公司之间的相对强弱，而不是混在不同时期直接比较。

### 训练和测试怎么划分

默认测试开始日期是：

```text
2023-01-01
```

也就是：

- `statDate < 2023-01-01`：训练集
- `statDate >= 2023-01-01`：测试集

### 可选模型

脚本支持两种模型：

- `ridge`：线性 Ridge 回归，更容易解释
- `hgb`：HistGradientBoostingRegressor，非线性模型，能捕捉更复杂关系

### 输出文件

常见输出目录：

```text
results/model outputs/model_outputs_quality_trend_change_hgb_v1/
```

里面主要有：

- `metrics.json`：训练/测试 R²、RMSE、Rank IC 等指标
- `train_predictions.csv`：训练集预测
- `test_predictions.csv`：测试集预测
- `latest_quality_trend_scores.csv`：每只股票最新一期的质量趋势预测分
- `quarterly_ic.csv`：每个季度的预测排序相关性
- `group_quality_change.csv`：按预测分组后的未来质量改善表现
- `coefficients.csv`：线性模型系数，HGB 模型这里通常为空或不可解释
- `model_artifact.json`：模型配置、特征列表和标准化信息
- `prediction_vs_actual_quality.png`：预测值和真实值散点图
- `rank_ic_timeseries.png`：Rank IC 时间序列图
- `group_future_quality_change.png`：分组质量改善图

### 常用命令

```bash
python3 "scripts/models/train_quality_trend_model.py" \
  --data-file quality_dataset/quarterly_quality_factors.csv \
  --output-dir "results/model outputs/model_outputs_quality_trend_change_hgb_v1" \
  --model hgb \
  --target future_change \
  --future-quarters 4 \
  --test-start 2023-01-01
```

### 当前训练效果

这里展示的是已经保存到仓库里的财务质量趋势模型结果。这个任务不是神经网络训练，所以没有传统意义上每个 epoch 的 loss 曲线；更适合看下面这些评估图：

- 预测值和真实值是否大致同向
- 每个季度的 Rank IC 是否稳定为正
- 按预测分组后，高分组是否真的有更好的未来质量改善

#### 指标对比

| 模型 | 训练样本 | 测试样本 | 训练区间 | 测试区间 | 训练 R² | 测试 R² | 测试 RMSE | 测试 Rank IC 均值 | Rank IC 为正比例 | 最高组 - 最低组未来质量改善 |
| --- | ---: | ---: | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| HGB | 32,756 | 14,041 | 2016-03-31 至 2022-12-31 | 2023-03-31 至 2025-03-31 | 0.526 | 0.311 | 15.566 | 0.542 | 100% | 31.38 |
| Ridge | 32,756 | 14,041 | 2016-03-31 至 2022-12-31 | 2023-03-31 至 2025-03-31 | 0.385 | 0.322 | 15.436 | 0.533 | 100% | 30.60 |

怎么读这些指标：

- `测试 R²`：模型在样本外解释未来质量变化的能力，越高越好。
- `测试 RMSE`：预测误差，越低越好。
- `Rank IC`：更适合选股排序任务，表示预测排名和真实未来改善排名是否一致，越高越好。
- `最高组 - 最低组未来质量改善`：如果把股票按预测分数分组，高分组比低分组未来质量改善多多少。

#### HGB 模型图

预测值和真实值散点图：

![HGB prediction vs actual](../../results/model%20outputs/model_outputs_quality_trend_change_hgb_v1/prediction_vs_actual_quality.png)

Rank IC 时间序列：

![HGB rank IC timeseries](../../results/model%20outputs/model_outputs_quality_trend_change_hgb_v1/rank_ic_timeseries.png)

按预测分组后的未来质量改善：

![HGB group future quality change](../../results/model%20outputs/model_outputs_quality_trend_change_hgb_v1/group_future_quality_change.png)

#### Ridge 模型图

预测值和真实值散点图：

![Ridge prediction vs actual](../../results/model%20outputs/model_outputs_quality_trend_change_ridge_v1/prediction_vs_actual_quality.png)

Rank IC 时间序列：

![Ridge rank IC timeseries](../../results/model%20outputs/model_outputs_quality_trend_change_ridge_v1/rank_ic_timeseries.png)

按预测分组后的未来质量改善：

![Ridge group future quality change](../../results/model%20outputs/model_outputs_quality_trend_change_ridge_v1/group_future_quality_change.png)

#### 结论

HGB 和 Ridge 在测试集上的表现接近。Ridge 的测试 R² 和 RMSE 略好，HGB 的 Rank IC 和分组质量改善略好。

如果目标是“解释模型为什么这样判断”，Ridge 更容易解释；如果目标是“做基本面改善排序”，HGB 略占优势。

## train_market_model.py

这个脚本训练的是“市场收益预测模型”。

一句话理解：它用某一天的市场因子，预测未来 N 个交易日的股票收益。

### 模型从哪里来

默认训练数据来自本地全量股票日线数据：

```text
/Users/lilongjiang/Desktop/量化交易/trading-data.20260522/stock data
```

也可以用一个已经合并好的面板文件：

```bash
--data-file quality_dataset/daily_quality_asof.csv
```

### 训练目标怎么构造

对每只股票，脚本用第 `t` 天的因子预测未来 `horizon` 个交易日收益：

```text
future_return = adjust_price_f(t + horizon) / adjust_price_f(t) - 1
```

默认：

```text
horizon = 20
```

也就是预测未来约 20 个交易日的收益。

为了减少极端值干扰，目标收益默认会被截断：

```text
--winsor 0.30
```

表示把未来收益限制在 `-30%` 到 `+30%` 之间。

### 特征从哪里来

脚本会读取原始字段，也会自动生成滚动特征。

原始字段常见包括：

- 换手率 `turnover`
- 成交额 `money`
- 估值：`PE_TTM`、`PS_TTM`、`PC_TTM`、`PB`
- 市值：`market_value`
- 复权价：`adjust_price_f`

自动生成的特征包括：

- 动量：`mom_20d`、`mom_60d`、`mom_120d`、`mom_250d`
- 波动率：`vol_20d`、`vol_60d`、`vol_120d`
- 回撤：`drawdown_250d`、`drawdown_750d`
- 均线偏离：`ma_gap_60d`、`ma_gap_120d`、`ma_gap_250d`
- 换手均值和变化
- 成交额均值
- 估值变化和估值分位

### 特征预设

脚本内置了几套特征组合：

- `value`：基础估值和交易因子
- `growth`：动量、估值变化、成交变化
- `recovery`：反弹、回撤、估值位置，偏“困境反转”
- `recovery_light`：简化版反转特征
- `quality_growth`：市场因子 + 财务质量因子

使用方式：

```bash
--feature-preset growth
```

### 训练和测试怎么划分

默认测试开始日期是：

```text
2024-01-01
```

也就是：

- `date < 2024-01-01`：训练集
- `date >= 2024-01-01`：测试集

### 可选模型

脚本支持三种模型：

- `linear`：普通线性回归
- `ridge`：带正则的线性模型
- `hgb`：HistGradientBoostingRegressor，非线性模型

非线性模型默认最多抽样 `1,500,000` 行训练，以控制训练时间。

### 输出文件

输出目录由 `--output-dir` 指定，常见输出包括：

- `metrics.json`：训练/测试 R²、RMSE、Rank IC 等指标
- `coefficients.csv`：线性模型的系数
- `latest_predictions.csv`：最新交易日附近股票的预测收益和排名
- `test_predictions.csv`：测试集预测结果
- `daily_ic.csv`：每日 Rank IC
- `group_returns.csv`：按预测分组后的未来收益
- `prediction_vs_actual.png`：预测收益和真实收益散点图
- `rank_ic_timeseries.png`：Rank IC 时间序列
- `group_returns.png`：分组未来收益图

如果开启：

```bash
--long-term-score
```

还会输出：

- `long_term_scores.csv`
- `long_term_scores_clean.csv`

### 常用命令

使用默认本地股票 CSV 训练一个 20 日收益模型：

```bash
python3 "scripts/models/train_market_model.py" \
  --output-dir "results/model outputs/market_return_hgb_20d" \
  --model hgb \
  --feature-preset growth \
  --horizon 20 \
  --test-start 2024-01-01
```

使用已经合并了财务质量因子的训练表：

```bash
python3 "scripts/models/train_market_model.py" \
  --data-file quality_dataset/daily_quality_asof.csv \
  --output-dir "results/model outputs/market_quality_growth_hgb_20d" \
  --model hgb \
  --feature-preset quality_growth \
  --horizon 20 \
  --test-start 2024-01-01
```

## 两个模型的区别

| 脚本 | 预测什么 | 主要数据 | 时间尺度 | 用途 |
| --- | --- | --- | --- | --- |
| `train_quality_trend_model.py` | 未来财务质量是否改善 | 季度财务质量因子 | 未来 4 个季度 | 长期基本面观察 |
| `train_market_model.py` | 未来 N 日收益 | 日线价格、成交、估值、技术因子 | 未来 20/60/120 等交易日 | 市场收益预测 |

简单说：

- 财务趋势模型回答：“这家公司基本面未来会不会变好？”
- 市场收益模型回答：“这只股票未来一段时间收益可能如何？”

这两个模型可以互补，但不能混为一谈。
