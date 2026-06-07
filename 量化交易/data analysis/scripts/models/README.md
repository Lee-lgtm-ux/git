# Models

这里存放模型训练脚本。

## 文件说明

- `train_quality_trend_model.py`
  - 模型目标：预测未来 4 个季度财务质量综合分的改善幅度，属于长期基本面改善模型。
  - 训练数据：`quality_dataset/quarterly_quality_factors.csv`
  - 主要特征：ROE、毛利率、净利率、经营现金流、营收增长、利润增长、扣非利润增长、资产负债率等财务质量因子，以及部分同比/环比趋势特征。
  - 不使用的数据：日线价格、成交量、换手率、估值、技术指标。
  - 主要输出：`results/model outputs/model_outputs_quality_trend_change_hgb_v1/` 或 `results/model outputs/model_outputs_quality_trend_change_ridge_v1/`

- `train_market_model.py`
  - 模型目标：用日线市场因子预测未来 N 日收益。
  - 训练数据：`/Users/lilongjiang/Desktop/量化交易/trading-data.20260522/stock data`
  - 主要特征：换手率、成交额、PE/PS/PC/PB、动量、波动率、回撤、均线偏离、估值分位等。
  - 主要输出：脚本参数指定的模型输出目录。

## 示例命令

```bash
python3 "scripts/models/train_quality_trend_model.py" \
  --data-file quality_dataset/quarterly_quality_factors.csv \
  --output-dir "results/model outputs/model_outputs_quality_trend_change_hgb_v1" \
  --model hgb \
  --target future_change \
  --future-quarters 4 \
  --test-start 2023-01-01
```
