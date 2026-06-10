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

## v1 Sample Bias and v2 Fix

After manual inspection, v1 had a serious sampling issue:

```text
Full stock universe: bj=564, sh=2454, sz=3078
v1 first 600 sorted files: bj=564, sh=36, sz=0
```

This made v1 heavily biased toward Beijing Stock Exchange names and unsuitable as a general A-share predictor. In practice, TCN v1 was often overly bearish and Transformer v1 could disagree in an unstable way on out-of-distribution `sh/sz` uploads.

The training scripts now default to:

```text
--file-sample-mode stratified
```

For v2, the training file sample was:

```text
max-files: 900
file-sample-mode: stratified
sample distribution: bj=300, sh=300, sz=300
samples-per-stock: 100
lookback: 30
```

## TCN v2 Balanced

Output directory:

```text
results/model outputs/torch_tcn_v2_balanced
```

Training split:

```text
train rows: 46,887
test rows: 41,056
```

Training loss by epoch:

| Epoch | Loss |
| ---: | ---: |
| 1 | 1.82855 |
| 2 | 1.80468 |
| 3 | 1.79967 |
| 4 | 1.79301 |
| 5 | 1.79097 |
| 6 | 1.78584 |
| 7 | 1.77974 |
| 8 | 1.77656 |
| 9 | 1.76969 |
| 10 | 1.76190 |

Test metrics:

| Horizon | Direction Accuracy | AUC | Rank IC | Return MAE |
| --- | ---: | ---: | ---: | ---: |
| 1d | 53.55% | 0.546 | 0.072 | 0.0241 |
| 3d | 54.10% | 0.548 | 0.089 | 0.0406 |
| 5d | 54.52% | 0.558 | 0.113 | 0.0509 |

Latest prediction distribution:

| Horizon | Mean Prob Up | P10 | P50 | P90 | Above 0.50 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1d | 0.486 | 0.403 | 0.490 | 0.554 | 45.1% |
| 3d | 0.459 | 0.344 | 0.464 | 0.554 | 33.7% |
| 5d | 0.480 | 0.353 | 0.482 | 0.588 | 42.6% |

## Transformer v2 Balanced

Output directory:

```text
results/model outputs/torch_transformer_v2_balanced
```

Training split:

```text
train rows: 46,887
test rows: 41,056
```

Training loss by epoch:

| Epoch | Loss |
| ---: | ---: |
| 1 | 1.84545 |
| 2 | 1.81433 |
| 3 | 1.80766 |
| 4 | 1.80179 |
| 5 | 1.79811 |
| 6 | 1.79488 |
| 7 | 1.78869 |
| 8 | 1.78440 |

Test metrics:

| Horizon | Direction Accuracy | AUC | Rank IC | Return MAE |
| --- | ---: | ---: | ---: | ---: |
| 1d | 54.08% | 0.547 | 0.074 | 0.0243 |
| 3d | 53.34% | 0.542 | 0.095 | 0.0407 |
| 5d | 54.27% | 0.553 | 0.110 | 0.0507 |

Latest prediction distribution:

| Horizon | Mean Prob Up | P10 | P50 | P90 | Above 0.50 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1d | 0.502 | 0.425 | 0.505 | 0.574 | 54.9% |
| 3d | 0.518 | 0.440 | 0.518 | 0.595 | 64.9% |
| 5d | 0.506 | 0.423 | 0.507 | 0.586 | 54.6% |

## Current Recommended Models

The platform should use the balanced v2 models by default:

```text
torch_tcn_v2_balanced
torch_transformer_v2_balanced
```

These are still weak predictive signals, but they no longer collapse into the obvious v1 behavior where one model was broadly bearish and the other could look structurally bullish on out-of-distribution stocks.

## Platform Preprocessing Fix

The local prediction server must apply the same per-window normalization used during training. Training builds every input sequence through:

```text
window_to_vector(window)
```

The first platform version incorrectly sent the raw feature matrix into the global standardizer. That made uploaded stocks look artificially similar to the models and produced misleading repeated directional outputs.

The platform now normalizes the uploaded stock's latest 30-day window with `window_to_vector` before applying the model artifact's global feature mean/std. A quick local prediction check after this fix gave visibly different model views across stocks:

| Code | Window | TCN 5d | Transformer 5d |
| --- | --- | ---: | ---: |
| sh600519 | 2026-04-08 to 2026-05-22 | 0.531 / +0.72% | 0.518 / +0.16% |
| sh600000 | 2026-04-08 to 2026-05-22 | 0.583 / +1.43% | 0.386 / -1.32% |
| sz300750 | 2026-04-08 to 2026-05-22 | 0.631 / +1.91% | 0.409 / -1.20% |
| bj430017 | 2025-08-20 to 2025-09-30 | 0.467 / -0.20% | 0.525 / +0.12% |
| bj831906 | 2025-08-20 to 2025-09-30 | 0.380 / -0.89% | 0.400 / -1.08% |
