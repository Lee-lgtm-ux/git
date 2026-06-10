# Sequence Model Training Notes

## Dataset

Training used the local daily trading dataset:

```text
/Users/lilongjiang/Desktop/量化交易/trading-data.20260522
```

Relevant subdirectories:

```text
stock data/   per-stock daily CSV files
index data/   market index daily CSV files
```

The model used stock daily OHLCV-style fields:

```text
code, date, open, high, low, close, volume, money, turnover, adjust_price_f
```

It also used the Shanghai Composite index file as the market reference:

```text
/Users/lilongjiang/Desktop/量化交易/trading-data.20260522/index data/sh000001.csv
```

## Target

For each stock/date, the model predicts:

```text
future 1-day return and up probability
future 3-day return and up probability
future 5-day return and up probability
```

Return labels are based on forward adjusted prices:

```text
future_return_Nd = adjust_price_f[t + N] / adjust_price_f[t] - 1
future_up_Nd = future_return_Nd > 0
```

The prediction platform reports both:

```text
pred_return_1d / prob_up_1d
pred_return_3d / prob_up_3d
pred_return_5d / prob_up_5d
```

## Feature Window

Both PyTorch models use a 30-trading-day lookback window. Features per day:

```text
ret_1d, ret_2d, ret_3d, ret_5d,
range_pct, close_position, gap_open,
turnover, turnover_chg_5d,
money_chg_5d, log_money,
vol_5d, vol_20d,
ma_gap_5d, ma_gap_20d,
market_ret_1d, market_ret_5d, rel_ret_5d
```

## Training Configuration

Both v1 models used:

```text
max-files: 600
samples-per-stock: 120
lookback: 30
batch-size: 512
hidden: 64
test-start: 2024-01-01
```

The effective split was:

```text
train rows: 14,544
test rows: 52,507
train range: 1998-04-13 to 2023-12-29
test range: 2024-01-02 to 2026-05-15
```

## Loss Function

The PyTorch script optimizes a combined multi-horizon loss. For each horizon:

```text
SmoothL1Loss(predicted_return, actual_return * 10)
0.7 * BCEWithLogitsLoss(up_logit, actual_up)
```

The total loss is the sum across 1-day, 3-day, and 5-day targets.

Returns are multiplied by 10 during training to keep return and direction losses on more comparable scales. Predictions are divided back by 10 at inference time.

## TCN v1 Loss

Output directory:

```text
results/model outputs/torch_tcn_v1
```

Training loss by epoch:

| Epoch | Loss |
| ---: | ---: |
| 1 | 1.80108 |
| 2 | 1.71596 |
| 3 | 1.68902 |
| 4 | 1.66484 |
| 5 | 1.64512 |
| 6 | 1.62492 |
| 7 | 1.62039 |
| 8 | 1.59245 |
| 9 | 1.58414 |
| 10 | 1.57740 |

Test metrics:

| Horizon | Direction Accuracy | AUC | Rank IC | Return MAE |
| --- | ---: | ---: | ---: | ---: |
| 1d | 52.55% | 0.522 | 0.029 | 0.0256 |
| 3d | 52.02% | 0.529 | 0.064 | 0.0420 |
| 5d | 53.99% | 0.545 | 0.113 | 0.0519 |

## Transformer v1 Loss

Output directory:

```text
results/model outputs/torch_transformer_v1
```

Training loss by epoch:

| Epoch | Loss |
| ---: | ---: |
| 1 | 1.81997 |
| 2 | 1.74036 |
| 3 | 1.71023 |
| 4 | 1.68305 |
| 5 | 1.66607 |
| 6 | 1.64528 |
| 7 | 1.63589 |
| 8 | 1.61925 |

Test metrics:

| Horizon | Direction Accuracy | AUC | Rank IC | Return MAE |
| --- | ---: | ---: | ---: | ---: |
| 1d | 53.04% | 0.524 | 0.021 | 0.0253 |
| 3d | 52.38% | 0.516 | 0.040 | 0.0414 |
| 5d | 53.08% | 0.525 | 0.047 | 0.0520 |

## Current Read

On this larger training run:

- Transformer v1 is slightly better for 1-day direction accuracy.
- TCN v1 is better for 5-day direction accuracy, AUC, and Rank IC.
- Both models are weak but positive short-horizon signals, not trading instructions.

The local platform loads both models and shows the exact date window used for each uploaded stock prediction.
