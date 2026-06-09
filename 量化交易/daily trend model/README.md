# Daily Price Trend Model

这个模块用于做“版本 A”：只判断未来几天股价走势，不直接给买卖、仓位、止损等操作指令。

## 目标

基于日线 OHLCV、成交额、换手率、估值和指数环境特征，预测每只股票未来 1/3/5 个交易日的：

- 上涨概率
- 预期收益
- 横截面趋势评分
- 强/偏强/中性/偏弱/弱评级
- 置信度

## 平台入口

打开：

```text
index.html
```

平台会优先尝试读取：

```text
results/model outputs/daily_trend_hgb_v1/latest_daily_trend_scores.csv
results/model outputs/daily_trend_hgb_v1/metrics.json
```

如果文件不存在，会显示内置示例数据。也可以在页面左侧手动导入模型输出 CSV 和指标 JSON。

## 训练第一版模型

建议在本目录运行：

```bash
python3 scripts/models/train_daily_trend_model.py \
  --output-dir "results/model outputs/daily_trend_hgb_v1" \
  --model hgb \
  --test-start 2024-01-01
```

快速测试可以先限制股票数量：

```bash
python3 scripts/models/train_daily_trend_model.py \
  --max-files 80 \
  --train-sample 200000 \
  --output-dir "results/model outputs/daily_trend_quick"
```

完整默认数据目录：

```text
/Users/lilongjiang/Desktop/量化交易/trading-data.20260522
```

## 输出文件

- `latest_daily_trend_scores.csv`：最新交易日每只股票的趋势判断
- `metrics.json`：训练/测试区间、方向准确率、Rank IC、分组收益等
- `test_predictions.csv`：测试集逐日预测
- `daily_ic.csv`：每日 Rank IC
- `group_returns.csv`：按预测评分分组的未来收益表现
- `model_artifact.json`：模型配置、特征列表、训练摘要
- `rank_ic_timeseries.png`：Rank IC 时间序列
- `group_returns.png`：分组收益图

## 重要边界

这个模块输出的是走势判断，不是投资建议。第一版刻意不输出“买入/卖出/仓位/止损”，这样可以更清楚地验证预测本身有没有价值。
