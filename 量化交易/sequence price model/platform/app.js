const state = {
  file: null,
  csv: "",
};

const els = {
  stockFile: document.getElementById("stockFile"),
  fileName: document.getElementById("fileName"),
  predictBtn: document.getElementById("predictBtn"),
  title: document.getElementById("title"),
  subtitle: document.getElementById("subtitle"),
  metaGrid: document.getElementById("metaGrid"),
  results: document.getElementById("results"),
  metrics: document.getElementById("metrics"),
};

els.stockFile.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  state.file = file;
  state.csv = await file.text();
  els.fileName.textContent = file.name;
  els.predictBtn.disabled = false;
});

els.predictBtn.addEventListener("click", async () => {
  if (!state.csv) return;
  els.predictBtn.disabled = true;
  els.predictBtn.textContent = "预测中...";
  els.results.innerHTML = "";
  els.metrics.innerHTML = "";
  try {
    const response = await fetch("/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csv: state.csv }),
    });
    const data = await response.json();
    if (!response.ok || data.error) throw new Error(data.error || "预测失败");
    render(data);
  } catch (error) {
    const fileMode = window.location.protocol === "file:";
    const hint = fileMode
      ? "当前是直接打开 HTML 文件。请使用 start_platform.sh 或 启动序列预测平台.command 启动后，从 http://127.0.0.1:8877 访问。"
      : "请确认本地后端服务正在运行：scripts/serve_sequence_prediction_platform.py。";
    els.results.innerHTML = `<div class="error">${escapeHtml(error.message)}<br />${escapeHtml(hint)}</div>`;
  } finally {
    els.predictBtn.disabled = false;
    els.predictBtn.textContent = "开始预测";
  }
});

function render(data) {
  const { meta, predictions } = data;
  els.title.textContent = `${meta.code} · ${meta.asof_date}`;
  els.subtitle.textContent = `本次预测基于 ${meta.window_start} 至 ${meta.window_end} 的最近 ${meta.lookback} 个有效交易日。`;
  els.metaGrid.innerHTML = [
    ["股票代码", meta.code],
    ["预测日期", meta.asof_date],
    ["预测依据时间段", `${meta.window_start} 至 ${meta.window_end}`],
    ["有效特征行数", formatInt(meta.valid_feature_rows)],
  ]
    .map(([label, value]) => `<article class="meta-card"><span>${label}</span><strong>${value}</strong></article>`)
    .join("");

  els.results.innerHTML = predictions.map(renderModelCard).join("");
  els.metrics.innerHTML = predictions.flatMap(renderMetrics).join("");
}

function renderModelCard(model) {
  return `
    <article class="model-card">
      <div>
        <h4>${model.name}</h4>
        <p class="note">5日判断：${model.rating_5d}</p>
      </div>
      <div class="horizon-grid">
        ${[1, 3, 5].map((h) => renderHorizon(model, h)).join("")}
      </div>
    </article>
  `;
}

function renderHorizon(model, h) {
  const prob = model[`prob_up_${h}d`];
  const ret = model[`pred_return_${h}d`];
  return `
    <div class="horizon">
      <span>${h}日</span>
      <strong>上涨概率 ${formatPercent(prob)}</strong>
      <strong class="${ret >= 0 ? "positive" : "negative"}">预期收益 ${formatSignedPercent(ret)}</strong>
    </div>
  `;
}

function renderMetrics(model) {
  return [1, 3, 5].map((h) => {
    const m = model.test_metrics[`${h}d`];
    return `
      <article class="metric-card">
        <span>${model.name} · ${h}日测试表现</span>
        <strong>Acc ${formatPercent(m.direction_accuracy)}</strong>
        <span>AUC ${formatNumber(m.auc, 3)} · IC ${formatNumber(m.rank_ic, 3)}</span>
      </article>
    `;
  });
}

function formatPercent(value) {
  const n = Number(value);
  return Number.isFinite(n) ? `${(n * 100).toFixed(1)}%` : "-";
}

function formatSignedPercent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  return `${n > 0 ? "+" : ""}${(n * 100).toFixed(2)}%`;
}

function formatNumber(value, digits = 2) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(digits) : "-";
}

function formatInt(value) {
  const n = Number(value);
  return Number.isFinite(n) ? new Intl.NumberFormat("zh-CN").format(n) : "-";
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}
