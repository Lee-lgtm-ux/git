# LLM Price Prediction Experiment

这个模块用于测试“LLM 直接看历史行情文本，预测未来 1/3/5 个交易日股价变化”的能力。

它不是交易系统，也不会输出买卖建议。目标是回答一个更具体的问题：

```text
给 LLM 最近 N 天的日线走势，它预测未来几天方向和收益的能力到底怎么样？
```

## 实验流程

1. 从股票日线 CSV 抽取样本。
2. 把每个样本整理成一段紧凑的 prompt。
3. 让 LLM 输出固定 JSON。
4. 把 LLM 预测和真实未来收益对比。
5. 输出方向准确率、MAE、Rank IC 等指标。

## 为什么要这样做

如果只让 LLM 随便回答“这只股票会涨吗”，很难判断结果有没有价值。这个模块会把每一次预测都落到可回测样本上，避免只看几个案例产生错觉。

## 生成 prompt 样本

```bash
cd "/Users/lilongjiang/Documents/Git/量化交易/llm price prediction"

/Users/lilongjiang/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 \
  scripts/evaluate_llm_price_prediction.py \
  --mode export-prompts \
  --max-files 20 \
  --samples-per-stock 3 \
  --output-file results/prompts.jsonl
```

## 跑一个非 LLM 基线

```bash
/Users/lilongjiang/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 \
  scripts/evaluate_llm_price_prediction.py \
  --mode baseline \
  --max-files 80 \
  --samples-per-stock 5 \
  --output-file results/baseline_predictions.jsonl \
  --metrics-file results/baseline_metrics.json
```

这个基线只是用最近动量做一个简单预测，目的是给 LLM 一个最低比较对象。

## 接入 OpenAI-compatible LLM

脚本支持常见的 OpenAI-compatible `chat/completions` 接口。

如果使用 OpenAI，只需要设置：

```bash
export OPENAI_API_KEY="你的 key"
export OPENAI_MODEL="gpt-5-nano"
```

如果使用其他 OpenAI-compatible 服务，可以改用：

```bash
export LLM_BASE_URL="你的服务地址，例如 http://127.0.0.1:1234/v1"
export LLM_API_KEY="你的 key"
export LLM_MODEL="你的模型名"
```

然后运行：

```bash
/Users/lilongjiang/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 \
  scripts/evaluate_llm_price_prediction.py \
  --mode predict \
  --prompt-file results/prompts.jsonl \
  --output-file results/llm_predictions.jsonl
```

再评估：

```bash
/Users/lilongjiang/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 \
  scripts/evaluate_llm_price_prediction.py \
  --mode evaluate \
  --prompt-file results/prompts.jsonl \
  --prediction-file results/llm_predictions.jsonl \
  --metrics-file results/llm_metrics.json
```

## LLM 必须输出的 JSON

```json
{
  "prob_up_1d": 0.52,
  "prob_up_3d": 0.54,
  "prob_up_5d": 0.55,
  "pred_return_1d": 0.002,
  "pred_return_3d": 0.006,
  "pred_return_5d": 0.010,
  "confidence": 0.35,
  "reason": "short explanation"
}
```

字段含义：

- `prob_up_*`：上涨概率，范围 0 到 1
- `pred_return_*`：预期收益率，例如 `0.01` 表示 +1%
- `confidence`：模型自评置信度，范围 0 到 1
- `reason`：简短理由

## 判断标准

重点看：

- 方向准确率是否明显高于 50%
- AUC 是否高于 0.5
- 预测收益和真实收益的 Rank IC 是否稳定为正
- 是否超过简单动量基线
- JSON 是否稳定可解析

如果 LLM 不能超过简单动量基线，就说明“直接把行情塞给 LLM 预测”暂时没有明显优势。
