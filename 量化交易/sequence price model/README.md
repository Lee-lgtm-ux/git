# Sequence Price Model

这个模块用于训练“股价序列模型”：直接学习过去 N 天日线走势，预测未来 1/3/5 个交易日方向和收益。

它不是聊天 LLM，也不是 prompt 实验，而是专门的时序模型。

## 第一版模型

第一版包含两个层级：

### 1. numpy 序列基线

```text
过去 lookback 天特征序列 -> 展平/标准化 -> 多输出 Ridge -> 未来 1/3/5 日收益和上涨概率
```

这个模型类似一个轻量的 DLinear / temporal ridge baseline。它不是 Transformer，但它使用完整历史窗口作为输入，适合先确认“序列信息是否有预测价值”。

### 2. PyTorch 序列模型

已经支持：

- TCN
- Transformer Encoder

CPU 上建议先跑 TCN，速度更快。

## 运行快速验证

```bash
cd "/Users/lilongjiang/Documents/Git/量化交易/sequence price model"

/Users/lilongjiang/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 \
  scripts/train_sequence_price_model.py \
  --max-files 80 \
  --samples-per-stock 80 \
  --lookback 30 \
  --output-dir "results/model outputs/sequence_ridge_quick"
```

## 完整训练

```bash
/Users/lilongjiang/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 \
  scripts/train_sequence_price_model.py \
  --lookback 60 \
  --output-dir "results/model outputs/sequence_ridge_v1"
```

## PyTorch TCN 快速训练

```bash
/Users/lilongjiang/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 \
  scripts/train_torch_sequence_model.py \
  --model tcn \
  --max-files 80 \
  --samples-per-stock 80 \
  --lookback 30 \
  --epochs 8 \
  --output-dir "results/model outputs/torch_tcn_quick"
```

## PyTorch Transformer 快速训练

```bash
/Users/lilongjiang/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 \
  scripts/train_torch_sequence_model.py \
  --model transformer \
  --max-files 80 \
  --samples-per-stock 80 \
  --lookback 30 \
  --epochs 8 \
  --output-dir "results/model outputs/torch_transformer_quick"
```

## 本地预测平台

最方便的方式是在 Finder 里双击：

```text
启动序列预测平台.command
```

它会自动启动后端服务并打开：

```text
http://127.0.0.1:8877
```

使用时保持弹出的终端窗口打开；用完后在该终端按 `Control+C` 停止服务。

也可以用命令行启动：

训练好 `torch_tcn_v2_balanced` 和 `torch_transformer_v2_balanced` 后启动：

```bash
/Users/lilongjiang/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 \
  scripts/serve_sequence_prediction_platform.py
```

打开：

```text
http://127.0.0.1:8877
```

上传单只股票 CSV 后，平台会输出：

- TCN 的 1/3/5 日上涨概率和预期收益
- Transformer 的 1/3/5 日上涨概率和预期收益
- 本次预测使用的历史时间段，例如 `2025-08-12 至 2025-09-23`
- 两个模型在测试集上的准确率、AUC、Rank IC

## 当前推荐模型

当前平台默认加载平衡抽样后的 v2 模型：

```text
results/model outputs/torch_tcn_v2_balanced
results/model outputs/torch_transformer_v2_balanced
```

v2 修正了 v1 的一个重要问题：v1 使用文件名前 600 个样本训练，样本严重偏向北交所股票；v2 改为按 `bj/sh/sz` 分层抽样训练。

## 输出

- `metrics.json`：方向准确率、AUC、Rank IC、MAE
- `latest_sequence_scores.csv`：每只股票最新日期的序列预测分
- `test_predictions.csv`：测试集预测明细
- `model_artifact.json`：模型配置和特征说明

## 判断标准

重点看：

- 5 日方向准确率是否稳定高于 50%
- 5 日 Rank IC 是否为正
- 5 日 AUC 是否高于 0.5
- 是否超过 LLM prompt 实验和简单动量基线
