const defaultScoresCsv = `code,date,rank,trend_score,rating,confidence,prob_up_1d,prob_up_3d,prob_up_5d,pred_return_1d,pred_return_3d,pred_return_5d,ret_5d,ret_20d,rel_ret_5d,rel_ret_20d,turnover,log_money,PE_TTM,PB
sh600519,2026-05-22,1,96.4,强,0.24,0.58,0.62,0.65,0.006,0.015,0.026,0.018,0.071,0.012,0.046,0.006,20.91,24.6,8.1
sz300750,2026-05-22,2,89.2,强,0.19,0.55,0.59,0.63,0.004,0.012,0.021,0.011,0.046,0.006,0.021,0.018,21.44,31.2,6.4
sz000333,2026-05-22,3,77.8,偏强,0.14,0.54,0.56,0.59,0.003,0.008,0.014,0.006,0.026,0.001,0.001,0.009,20.38,15.8,3.5
sh600000,2026-05-22,4,51.6,中性,0.07,0.51,0.52,0.54,0.001,0.003,0.006,-0.004,0.012,-0.009,-0.013,0.003,19.72,6.7,0.6
sz000001,2026-05-22,5,34.1,偏弱,0.11,0.48,0.46,0.44,-0.002,-0.006,-0.011,-0.006,0.004,-0.011,-0.021,0.007,20.12,5.3,0.7`;

const defaultMetrics = {
  model: "demo",
  train_rows: 1280000,
  test_rows: 310000,
  train_start: "2005-01-04",
  train_end: "2023-12-29",
  test_start: "2024-01-02",
  test_end: "2026-05-22",
  latest_data_date: "2026-05-22",
  test_rank_ic_5d_mean: 0.026,
  test_rank_ic_5d_positive_rate: 0.57,
  group_5_minus_1_return_5d: 0.008,
  per_horizon: {
    "1d": { direction_accuracy: 0.522, up_auc: 0.535, test_rmse: 0.032 },
    "3d": { direction_accuracy: 0.536, up_auc: 0.548, test_rmse: 0.055 },
    "5d": { direction_accuracy: 0.544, up_auc: 0.557, test_rmse: 0.071 },
  },
};

const state = {
  rows: [],
  metrics: defaultMetrics,
  selectedCode: "",
  sortKey: "trend_score",
};

const els = {
  scoreFile: document.getElementById("scoreFile"),
  metricFile: document.getElementById("metricFile"),
  scoreFileName: document.getElementById("scoreFileName"),
  metricFileName: document.getElementById("metricFileName"),
  searchInput: document.getElementById("searchInput"),
  ratingFilter: document.getElementById("ratingFilter"),
  minScore: document.getElementById("minScore"),
  minScoreText: document.getElementById("minScoreText"),
  resetBtn: document.getElementById("resetBtn"),
  exportBtn: document.getElementById("exportBtn"),
  pageTitle: document.getElementById("pageTitle"),
  metricCards: document.getElementById("metricCards"),
  scoreBody: document.getElementById("scoreBody"),
  tableSubtitle: document.getElementById("tableSubtitle"),
  detailTitle: document.getElementById("detailTitle"),
  detailSubtitle: document.getElementById("detailSubtitle"),
  detailContent: document.getElementById("detailContent"),
  validationGrid: document.getElementById("validationGrid"),
};

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  const headers = splitCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    const row = {};
    headers.forEach((header, index) => {
      row[header] = coerce(values[index] ?? "");
    });
    return row;
  });
}

function splitCsvLine(line) {
  const out = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      out.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  out.push(current);
  return out;
}

function coerce(value) {
  const trimmed = String(value).trim();
  if (trimmed === "") return "";
  const numeric = Number(trimmed);
  return Number.isFinite(numeric) && /^-?\d+(\.\d+)?(e[-+]?\d+)?$/i.test(trimmed) ? numeric : trimmed;
}

async function loadDefaultFiles() {
  const candidates = [
    "results/model outputs/daily_trend_hgb_v1",
    "results/model outputs/daily_trend_quick",
  ];
  try {
    let loaded = false;
    for (const dir of candidates) {
      const [scoresResponse, metricsResponse] = await Promise.all([
        fetch(`${dir}/latest_daily_trend_scores.csv`),
        fetch(`${dir}/metrics.json`),
      ]);
      if (!scoresResponse.ok) continue;
      state.rows = parseCsv(await scoresResponse.text());
      if (metricsResponse.ok) {
        state.metrics = await metricsResponse.json();
      }
      els.scoreFileName.textContent = `已读取 ${dir}`;
      loaded = true;
      break;
    }
    if (!loaded) throw new Error("scores not found");
  } catch {
    state.rows = parseCsv(defaultScoresCsv);
    state.metrics = defaultMetrics;
    els.scoreFileName.textContent = "当前显示内置示例数据";
  }
  state.selectedCode = state.rows[0]?.code ?? "";
  render();
}

function filteredRows() {
  const query = els.searchInput.value.trim().toLowerCase();
  const rating = els.ratingFilter.value;
  const minScore = Number(els.minScore.value);
  return state.rows
    .filter((row) => !query || String(row.code).toLowerCase().includes(query))
    .filter((row) => !rating || row.rating === rating)
    .filter((row) => Number(row.trend_score) >= minScore)
    .sort((a, b) => Number(b[state.sortKey]) - Number(a[state.sortKey]));
}

function render() {
  const rows = filteredRows();
  els.pageTitle.textContent = `${formatInt(state.rows.length)} 只股票走势评分`;
  els.tableSubtitle.textContent = `当前显示 ${formatInt(rows.length)} 条；模型只判断走势，不输出交易指令。`;
  renderMetricCards(rows);
  renderTable(rows);
  renderDetail(rows.find((row) => row.code === state.selectedCode) || rows[0]);
  renderValidation();
}

function renderMetricCards(rows) {
  const strongCount = rows.filter((row) => row.rating === "强").length;
  const avgScore = average(rows.map((row) => Number(row.trend_score)));
  const avgProb5 = average(rows.map((row) => Number(row.prob_up_5d)));
  const latestDate = state.metrics.latest_data_date || rows[0]?.date || "-";
  const cards = [
    ["最新日期", latestDate],
    ["强评级数量", formatInt(strongCount)],
    ["平均趋势分", formatNumber(avgScore, 1)],
    ["平均5日上涨概率", formatPercent(avgProb5)],
  ];
  els.metricCards.innerHTML = cards
    .map(([label, value]) => `<article class="metric-card"><span>${label}</span><strong>${value}</strong></article>`)
    .join("");
}

function renderTable(rows) {
  els.scoreBody.innerHTML = rows
    .slice(0, 300)
    .map(
      (row) => `
        <tr class="${row.code === state.selectedCode ? "selected" : ""}" data-code="${row.code}">
          <td>${formatInt(row.rank)}</td>
          <td>${row.code}</td>
          <td>${row.date}</td>
          <td>${ratingBadge(row.rating)}</td>
          <td>${formatNumber(row.trend_score, 1)}</td>
          <td>${formatPercent(row.prob_up_1d)}</td>
          <td>${formatPercent(row.prob_up_3d)}</td>
          <td>${formatPercent(row.prob_up_5d)}</td>
          <td class="${Number(row.pred_return_5d) >= 0 ? "positive" : "negative"}">${formatSignedPercent(row.pred_return_5d)}</td>
          <td>${formatPercent(row.confidence)}</td>
        </tr>
      `
    )
    .join("");
}

function ratingBadge(rating) {
  const cls = rating === "强" ? "strong" : rating === "偏强" ? "good" : rating === "中性" ? "neutral" : "weak";
  return `<span class="rating ${cls}">${rating || "-"}</span>`;
}

function renderDetail(row) {
  if (!row) {
    els.detailTitle.textContent = "没有匹配结果";
    els.detailSubtitle.textContent = "调整筛选条件后再看。";
    els.detailContent.innerHTML = "";
    return;
  }
  state.selectedCode = row.code;
  els.detailTitle.textContent = row.code;
  els.detailSubtitle.textContent = `${row.date} · ${row.rating} · 排名 ${formatInt(row.rank)}`;
  els.detailContent.innerHTML = `
    ${probRow("1日上涨概率", row.prob_up_1d)}
    ${probRow("3日上涨概率", row.prob_up_3d)}
    ${probRow("5日上涨概率", row.prob_up_5d)}
    <div class="kv-grid">
      ${kv("趋势分", formatNumber(row.trend_score, 1))}
      ${kv("置信度", formatPercent(row.confidence))}
      ${kv("1日预期", formatSignedPercent(row.pred_return_1d))}
      ${kv("3日预期", formatSignedPercent(row.pred_return_3d))}
      ${kv("5日预期", formatSignedPercent(row.pred_return_5d))}
      ${kv("近20日", formatSignedPercent(row.ret_20d))}
      ${kv("相对大盘5日", formatSignedPercent(row.rel_ret_5d))}
      ${kv("换手率", formatPercent(row.turnover))}
      ${kv("PE", formatNumber(row.PE_TTM, 2))}
      ${kv("PB", formatNumber(row.PB, 2))}
    </div>
    <p class="muted">说明：评级只表示模型对短期价格走势的相对判断，不代表买入、卖出或持仓建议。</p>
  `;
}

function probRow(label, value) {
  const pct = Math.max(0, Math.min(100, Number(value) * 100 || 0));
  return `
    <div class="prob-row">
      <header><span>${label}</span><strong>${formatPercent(value)}</strong></header>
      <div class="bar"><span style="width:${pct}%"></span></div>
    </div>
  `;
}

function kv(label, value) {
  return `<div class="kv"><span>${label}</span><strong>${value}</strong></div>`;
}

function renderValidation() {
  const m = state.metrics || {};
  const h5 = m.per_horizon?.["5d"] || {};
  const h3 = m.per_horizon?.["3d"] || {};
  const h1 = m.per_horizon?.["1d"] || {};
  const items = [
    ["训练区间", `${m.train_start || "-"} 至 ${m.train_end || "-"}`],
    ["测试区间", `${m.test_start || "-"} 至 ${m.test_end || "-"}`],
    ["5日 Rank IC", formatNumber(m.test_rank_ic_5d_mean, 4)],
    ["IC 为正比例", formatPercent(m.test_rank_ic_5d_positive_rate)],
    ["5组-1组收益差", formatSignedPercent(m.group_5_minus_1_return_5d)],
    ["1日方向准确率", formatPercent(h1.direction_accuracy)],
    ["3日方向准确率", formatPercent(h3.direction_accuracy)],
    ["5日方向准确率", formatPercent(h5.direction_accuracy)],
    ["5日 AUC", formatNumber(h5.up_auc, 3)],
    ["测试样本", formatInt(m.test_rows)],
  ];
  els.validationGrid.innerHTML = items
    .map(([label, value]) => `<div class="validation-item"><span>${label}</span><strong>${value}</strong></div>`)
    .join("");
}

function average(values) {
  const clean = values.filter((value) => Number.isFinite(value));
  return clean.length ? clean.reduce((sum, value) => sum + value, 0) / clean.length : 0;
}

function formatNumber(value, digits = 2) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(digits) : "-";
}

function formatInt(value) {
  const number = Number(value);
  return Number.isFinite(number) ? new Intl.NumberFormat("zh-CN").format(Math.round(number)) : "-";
}

function formatPercent(value) {
  const number = Number(value);
  return Number.isFinite(number) ? `${(number * 100).toFixed(1)}%` : "-";
}

function formatSignedPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "-";
  const sign = number > 0 ? "+" : "";
  return `${sign}${(number * 100).toFixed(2)}%`;
}

function downloadCurrentRows() {
  const rows = filteredRows();
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(","), ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(","))].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "daily_trend_filtered_scores.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

els.scoreFile.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  state.rows = parseCsv(await file.text());
  state.selectedCode = state.rows[0]?.code ?? "";
  els.scoreFileName.textContent = file.name;
  render();
});

els.metricFile.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  state.metrics = JSON.parse(await file.text());
  els.metricFileName.textContent = file.name;
  render();
});

els.searchInput.addEventListener("input", render);
els.ratingFilter.addEventListener("change", render);
els.minScore.addEventListener("input", () => {
  els.minScoreText.textContent = els.minScore.value;
  render();
});
els.resetBtn.addEventListener("click", () => {
  els.searchInput.value = "";
  els.ratingFilter.value = "";
  els.minScore.value = "0";
  els.minScoreText.textContent = "0";
  state.sortKey = "trend_score";
  document.querySelectorAll(".segmented button").forEach((button) => {
    button.classList.toggle("active", button.dataset.sort === state.sortKey);
  });
  state.selectedCode = state.rows[0]?.code ?? "";
  render();
});
els.exportBtn.addEventListener("click", downloadCurrentRows);
els.scoreBody.addEventListener("click", (event) => {
  const row = event.target.closest("tr");
  if (!row) return;
  state.selectedCode = row.dataset.code;
  render();
});
document.querySelectorAll(".segmented button").forEach((button) => {
  button.addEventListener("click", () => {
    state.sortKey = button.dataset.sort;
    document.querySelectorAll(".segmented button").forEach((item) => item.classList.toggle("active", item === button));
    render();
  });
});

loadDefaultFiles();
