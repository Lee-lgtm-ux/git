# Validation

这里存放模型信号验证脚本。

## 文件说明

- `validate_quality_signal_returns.py`
  - 用途：验证财务质量趋势模型的预测分数是否和未来股票收益有关。
  - 输入数据：
    - 模型预测：`results/model outputs/.../test_predictions.csv`
    - 日线价格：`quality_dataset/daily_market_panel.csv`
  - 验证方式：在财务数据可用日 `pubDate` 买入，观察未来 250/500 个交易日收益。
  - 主要输出：Rank IC、分组收益、验证样本和 summary 文件。

## 示例命令

```bash
python3 "scripts/validation/validate_quality_signal_returns.py" \
  --predictions "results/model outputs/model_outputs_quality_trend_change_hgb_v1/test_predictions.csv" \
  --daily quality_dataset/daily_market_panel.csv \
  --output-dir "results/validation/quality_signal_return_validation_hgb"
```
