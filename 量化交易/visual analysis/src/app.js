const state = {
  rows: [],
  columns: [],
};

const els = {
  fileInput: document.querySelector("#csvFile"),
  dateColumn: document.querySelector("#dateColumn"),
  openColumn: document.querySelector("#openColumn"),
  highColumn: document.querySelector("#highColumn"),
  lowColumn: document.querySelector("#lowColumn"),
  closeColumn: document.querySelector("#closeColumn"),
  volumeColumn: document.querySelector("#volumeColumn"),
  showMa: document.querySelector("#showMa"),
  showLongMa: document.querySelector("#showLongMa"),
  showBoll: document.querySelector("#showBoll"),
  showMacd: document.querySelector("#showMacd"),
  showRsi: document.querySelector("#showRsi"),
  showKdj: document.querySelector("#showKdj"),
  showAcf: document.querySelector("#showAcf"),
  acfLag: document.querySelector("#acfLag"),
  acfLagValue: document.querySelector("#acfLagValue"),
  adfLag: document.querySelector("#adfLag"),
  adfLagValue: document.querySelector("#adfLagValue"),
  lbLag: document.querySelector("#lbLag"),
  lbLagValue: document.querySelector("#lbLagValue"),
  startDate: document.querySelector("#startDate"),
  endDate: document.querySelector("#endDate"),
  resetDates: document.querySelector("#resetDates"),
  loadSample: document.querySelector("#loadSample"),
  stats: document.querySelector("#stats"),
  adfResults: document.querySelector("#adfResults"),
  lbResults: document.querySelector("#lbResults"),
  rowCount: document.querySelector("#rowCount"),
  mainLegend: document.querySelector("#mainLegend"),
  klineChart: document.querySelector("#klineChart"),
  volumeChart: document.querySelector("#volumeChart"),
  cumulativeReturnChart: document.querySelector("#cumulativeReturnChart"),
  macdChart: document.querySelector("#macdChart"),
  rsiChart: document.querySelector("#rsiChart"),
  kdjChart: document.querySelector("#kdjChart"),
  acfChart: document.querySelector("#acfChart"),
  pacfChart: document.querySelector("#pacfChart"),
};

const colors = {
  rise: "#d84b36",
  fall: "#13936f",
  ma5: "#2f6fd6",
  ma10: "#c58a18",
  ma20: "#8058c7",
  ma60: "#0f8c9f",
  ma120: "#7c6a48",
  cumulativeReturn: "#0f8c9f",
  bollMid: "#4c5963",
  bollBand: "#8a98a3",
  dif: "#2f6fd6",
  dea: "#c58a18",
  rsi6: "#2f6fd6",
  rsi12: "#8058c7",
  rsi24: "#c58a18",
  k: "#2f6fd6",
  d: "#c58a18",
  j: "#d84b36",
  acf: "#0f8c9f",
  pacf: "#8058c7",
  confidence: "#9aa6b2",
};

els.fileInput.addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  loadCsvText(await file.text());
});

els.loadSample.addEventListener("click", () => {
  loadCsvText(generateSampleCsv());
});

els.resetDates.addEventListener("click", () => {
  setDateRangeDefaults();
  render();
});

els.dateColumn.addEventListener("change", setDateRangeDefaults);

[
  els.dateColumn,
  els.openColumn,
  els.highColumn,
  els.lowColumn,
  els.closeColumn,
  els.volumeColumn,
  els.showMa,
  els.showLongMa,
  els.showBoll,
  els.showMacd,
  els.showRsi,
  els.showKdj,
  els.showAcf,
  els.adfLag,
  els.lbLag,
  els.startDate,
  els.endDate,
].forEach((input) => input.addEventListener("change", render));

els.acfLag.addEventListener("input", () => {
  els.acfLagValue.textContent = els.acfLag.value;
  render();
});

els.adfLag.addEventListener("input", () => {
  els.adfLagValue.textContent = els.adfLag.value;
  render();
});

els.lbLag.addEventListener("input", () => {
  els.lbLagValue.textContent = els.lbLag.value;
  render();
});

function loadCsvText(text) {
  const parsed = parseCsv(text);
  state.rows = parsed.rows;
  state.columns = parsed.columns;
  setupColumnSelectors();
  setDateRangeDefaults();
  render();
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (!lines.length) return { columns: [], rows: [] };

  const columns = splitCsvLine(lines[0]).map((name) => name.trim());
  const rows = lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    return Object.fromEntries(columns.map((column, index) => [column, values[index] ?? ""]));
  });

  return { columns, rows };
}

function generateSampleCsv() {
  const rows = ["date,open,high,low,close,volume"];
  let price = 10.2;
  const date = new Date("2025-06-02");

  for (let index = 0; index < 240; index += 1) {
    if (date.getDay() === 0) date.setDate(date.getDate() + 1);
    if (date.getDay() === 6) date.setDate(date.getDate() + 2);

    const wave = Math.sin(index / 9) * 0.18 + Math.cos(index / 21) * 0.12;
    const drift = index * 0.0008;
    const open = price + Math.sin(index / 5) * 0.08;
    const close = Math.max(2, open + wave * 0.25 + Math.sin(index / 3) * 0.06 + drift);
    const high = Math.max(open, close) + 0.12 + Math.abs(Math.sin(index / 4)) * 0.18;
    const low = Math.min(open, close) - 0.1 - Math.abs(Math.cos(index / 6)) * 0.15;
    const volume = Math.round(900000 + Math.abs(close - open) * 4200000 + Math.abs(Math.sin(index / 8)) * 650000 + index * 1800);

    rows.push([date.toISOString().slice(0, 10), open.toFixed(2), high.toFixed(2), low.toFixed(2), close.toFixed(2), volume].join(","));
    price = close;
    date.setDate(date.getDate() + 1);
  }

  return rows.join("\n");
}

function splitCsvLine(line) {
  const cells = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(cell.trim());
      cell = "";
    } else {
      cell += char;
    }
  }

  cells.push(cell.trim());
  return cells;
}

function setupColumnSelectors() {
  fillSelect(els.dateColumn, ["date", "trade_date", "datetime", "time", "日期", "时间"]);
  fillSelect(els.openColumn, ["open", "开盘", "开盘价"]);
  fillSelect(els.highColumn, ["high", "最高", "最高价"]);
  fillSelect(els.lowColumn, ["low", "最低", "最低价"]);
  fillSelect(els.closeColumn, ["close", "收盘", "收盘价", "price", "last"]);
  fillSelect(els.volumeColumn, ["volume", "vol", "成交量"]);
}

function fillSelect(select, guessNames) {
  select.innerHTML = `<option value="">请选择字段</option>` + state.columns
    .map((column) => `<option value="${escapeHtml(column)}">${escapeHtml(column)}</option>`)
    .join("");

  const exactMatch = state.columns.find((column) => {
    const lower = column.trim().toLowerCase();
    return guessNames.some((guess) => lower === guess.toLowerCase());
  });
  const fuzzyMatch = state.columns.find((column) => {
    const lower = column.toLowerCase();
    return guessNames.some((guess) => lower.includes(guess.toLowerCase()));
  });
  const match = exactMatch ?? fuzzyMatch;

  if (match) select.value = match;
}

function setDateRangeDefaults() {
  if (!state.rows.length || !els.dateColumn.value) {
    els.startDate.value = "";
    els.endDate.value = "";
    return;
  }

  const dates = state.rows
    .map((row) => toInputDate(row[els.dateColumn.value]))
    .filter(Boolean)
    .sort();

  els.startDate.value = dates[0] ?? "";
  els.endDate.value = dates.at(-1) ?? "";
}

function render() {
  if (state.rows.length && !hasRequiredMappings()) {
    clearAllCharts();
    els.rowCount.textContent = "字段映射不完整";
    els.stats.innerHTML = metric("状态", "请选择日期、开盘、最高、最低、收盘、成交量字段");
    els.adfResults.innerHTML = "";
    els.lbResults.innerHTML = "";
    return;
  }

  const allBars = normalizeBars();
  const allIndicators = calculateIndicators(allBars);
  const visibleIndexes = getVisibleIndexes(allBars);
  const bars = visibleIndexes.map((index) => allBars[index]);
  const indicators = visibleIndexes.map((index) => allIndicators[index]);

  els.rowCount.textContent = bars.length ? `${bars.length} / ${allBars.length} 根 K 线` : "当前日期范围无数据";
  if (allBars.length && !bars.length) {
    els.stats.innerHTML = metric("状态", "当前日期范围没有数据");
  } else {
    renderStats(bars);
  }
  renderAdfTests(bars);
  renderLbTests(bars);
  renderLegend();
  drawKlineChart(els.klineChart, bars, indicators);
  drawVolumeChart(els.volumeChart, bars, indicators);
  drawCumulativeReturnChart(els.cumulativeReturnChart, bars);
  drawMacdChart(els.macdChart, indicators);
  drawRsiChart(els.rsiChart, indicators);
  drawKdjChart(els.kdjChart, indicators);
  drawAcfPacfCharts(bars);
}

function getVisibleIndexes(bars) {
  const start = els.startDate.value;
  const end = els.endDate.value;
  const indexes = [];

  bars.forEach((bar, index) => {
    const date = bar.sortDate;
    if (!date) {
      indexes.push(index);
      return;
    }
    if (start && date < start) return;
    if (end && date > end) return;
    indexes.push(index);
  });

  return indexes;
}

function hasRequiredMappings() {
  return [
    els.dateColumn,
    els.openColumn,
    els.highColumn,
    els.lowColumn,
    els.closeColumn,
    els.volumeColumn,
  ].every((select) => select.value);
}

function clearAllCharts() {
  [
    els.klineChart,
    els.volumeChart,
    els.cumulativeReturnChart,
    els.macdChart,
    els.rsiChart,
    els.kdjChart,
    els.acfChart,
    els.pacfChart,
  ].forEach((canvas) => setupCanvas(canvas));
}

function normalizeBars() {
  const keys = {
    date: els.dateColumn.value,
    open: els.openColumn.value,
    high: els.highColumn.value,
    low: els.lowColumn.value,
    close: els.closeColumn.value,
    volume: els.volumeColumn.value,
  };

  return state.rows
    .map((row) => {
      const close = parseNumber(row[keys.close]);
      const open = parseNumber(row[keys.open]) || close;
      const high = parseNumber(row[keys.high]) || Math.max(open, close);
      const low = parseNumber(row[keys.low]) || Math.min(open, close);
      return {
        date: row[keys.date],
        sortDate: toInputDate(row[keys.date]),
        open,
        high,
        low,
        close,
        volume: parseNumber(row[keys.volume]) || 0,
      };
    })
    .filter((bar) => [bar.open, bar.high, bar.low, bar.close].every(Number.isFinite));
}

function calculateIndicators(bars) {
  const close = bars.map((bar) => bar.close);
  const high = bars.map((bar) => bar.high);
  const low = bars.map((bar) => bar.low);
  const volume = bars.map((bar) => bar.volume);
  const ma5 = sma(close, 5);
  const ma10 = sma(close, 10);
  const ma20 = sma(close, 20);
  const ma60 = sma(close, 60);
  const ma120 = sma(close, 120);
  const boll = bollinger(close, 20, 2);
  const macd = calculateMacd(close, 12, 26, 9);
  const rsi6 = rsi(close, 6);
  const rsi12 = rsi(close, 12);
  const rsi24 = rsi(close, 24);
  const kdj = calculateKdj(high, low, close, 9);
  const mavol5 = sma(volume, 5);
  const mavol10 = sma(volume, 10);

  return bars.map((bar, index) => ({
    ...bar,
    ma5: ma5[index],
    ma10: ma10[index],
    ma20: ma20[index],
    ma60: ma60[index],
    ma120: ma120[index],
    bollMid: boll.mid[index],
    bollUpper: boll.upper[index],
    bollLower: boll.lower[index],
    dif: macd.dif[index],
    dea: macd.dea[index],
    hist: macd.hist[index],
    rsi6: rsi6[index],
    rsi12: rsi12[index],
    rsi24: rsi24[index],
    k: kdj.k[index],
    d: kdj.d[index],
    j: kdj.j[index],
    mavol5: mavol5[index],
    mavol10: mavol10[index],
  }));
}

function renderStats(bars) {
  if (!bars.length) {
    els.stats.innerHTML = metric("状态", "请导入 CSV");
    return;
  }

  const closes = bars.map((bar) => bar.close);
  const last = bars.at(-1);
  const previous = bars.at(-2) ?? last;
  const returns = closes.slice(1).map((price, index) => price / closes[index] - 1);
  const totalReturn = closes.at(-1) / closes[0] - 1;
  const dayChange = last.close / previous.close - 1;
  const maxDrawdown = getMaxDrawdown(closes);
  const volatility = standardDeviation(returns) * Math.sqrt(252);
  const turnover = bars.slice(-20).reduce((sum, bar) => sum + bar.volume, 0) / Math.min(20, bars.length);

  els.stats.innerHTML = [
    metric("最新收盘", formatNumber(last.close)),
    metric("当日涨跌", formatPercent(dayChange)),
    metric("区间收益", formatPercent(totalReturn)),
    metric("最大回撤", formatPercent(maxDrawdown)),
    metric("年化波动", formatPercent(volatility)),
    metric("20日均量", formatNumber(turnover)),
  ].join("");
}

function renderAdfTests(bars) {
  if (!bars.length) {
    els.adfResults.innerHTML = adfEmptyCard("ADF 单位根检验", "请导入 CSV 后查看平稳性检验");
    return;
  }

  const closes = bars.map((bar) => bar.close);
  const logReturns = toLogReturns(closes);
  const maxLag = Number(els.adfLag.value);
  const priceTest = adfTest(closes, maxLag);
  const returnTest = adfTest(logReturns, maxLag);

  els.adfResults.innerHTML = [
    adfCard("收盘价水平序列", priceTest),
    adfCard("对数收益率序列", returnTest),
  ].join("");
}

function adfEmptyCard(title, message) {
  return `<div class="adf-card"><h2>${title}</h2><p class="adf-note">${message}</p></div>`;
}

function adfCard(title, result) {
  if (!result.ok) return adfEmptyCard(title, result.message);

  const resultClass = result.stationary ? "adf-result" : "adf-result not-stationary";
  const conclusion = result.stationary ? "平稳" : "非平稳";
  return `
    <div class="adf-card">
      <h2>${title}</h2>
      <div class="adf-grid">
        <div class="adf-item"><span>Test Statistic</span><strong>${formatSigned(result.statistic)}</strong></div>
        <div class="adf-item"><span>1% 临界值</span><strong>${formatSigned(result.critical["1%"])}</strong></div>
        <div class="adf-item"><span>5% 临界值</span><strong>${formatSigned(result.critical["5%"])}</strong></div>
        <div class="adf-item"><span>10% 临界值</span><strong>${formatSigned(result.critical["10%"])}</strong></div>
        <div class="adf-item"><span>5% 结论</span><strong class="${resultClass}">${conclusion}</strong></div>
      </div>
      <p class="adf-note">常数项 ADF 回归，实际差分滞后 ${result.lag}，样本 ${result.observations}；临界值为常用近似值，统计量小于临界值时拒绝单位根。</p>
    </div>
  `;
}

function renderLbTests(bars) {
  if (!bars.length) {
    els.lbResults.innerHTML = adfEmptyCard("LB 白噪声检验", "请导入 CSV 后查看随机性检验");
    return;
  }

  const closes = bars.map((bar) => bar.close);
  const logReturns = toLogReturns(closes);
  const lag = Number(els.lbLag.value);
  const priceTest = ljungBoxTest(closes, lag);
  const returnTest = ljungBoxTest(logReturns, lag);

  els.lbResults.innerHTML = [
    lbCard("收盘价水平序列", priceTest),
    lbCard("对数收益率序列", returnTest),
  ].join("");
}

function lbCard(title, result) {
  if (!result.ok) return adfEmptyCard(title, result.message);

  const isRandom = result.pValue >= 0.05;
  const resultClass = isRandom ? "adf-result" : "adf-result not-stationary";
  const conclusion = isRandom ? "近似随机" : "非随机";
  return `
    <div class="adf-card">
      <h2>${title} LB 白噪声检验</h2>
      <div class="adf-grid">
        <div class="adf-item"><span>Q Statistic</span><strong>${formatSigned(result.statistic)}</strong></div>
        <div class="adf-item"><span>检验滞后</span><strong>${result.lag}</strong></div>
        <div class="adf-item"><span>自由度</span><strong>${result.degrees}</strong></div>
        <div class="adf-item"><span>p-value</span><strong>${formatPValue(result.pValue)}</strong></div>
        <div class="adf-item"><span>5% 结论</span><strong class="${resultClass}">${conclusion}</strong></div>
      </div>
      <p class="adf-note">原假设为前 ${result.lag} 阶自相关整体为 0；p-value 小于 0.05 时拒绝白噪声，认为序列不是随机序列。</p>
    </div>
  `;
}

function renderLegend() {
  const items = [];
  if (els.showMa.checked) {
    items.push(["MA5", colors.ma5], ["MA10", colors.ma10], ["MA20", colors.ma20], ["MA60", colors.ma60]);
  }
  if (els.showLongMa.checked) items.push(["MA120", colors.ma120]);
  if (els.showBoll.checked) items.push(["BOLL", colors.bollBand]);

  els.mainLegend.innerHTML = items
    .map(
      ([label, color]) =>
        `<span class="legend-item"><i class="legend-swatch" style="background:${color}"></i>${label}</span>`,
    )
    .join("");
}

function drawKlineChart(canvas, bars, indicators) {
  const ctx = setupCanvas(canvas);
  if (!bars.length) return;

  const pad = { left: 58, right: 18, top: 18, bottom: 34 };
  const overlayKeys = [];
  if (els.showMa.checked) overlayKeys.push("ma5", "ma10", "ma20", "ma60");
  if (els.showLongMa.checked) overlayKeys.push("ma120");
  if (els.showBoll.checked) overlayKeys.push("bollUpper", "bollMid", "bollLower");

  const values = bars.flatMap((bar) => [bar.high, bar.low]);
  overlayKeys.forEach((key) => indicators.forEach((item) => pushFinite(values, item[key])));
  const range = paddedRange(values);
  drawGrid(ctx, canvas, pad, range.min, range.max);

  const slot = (canvas.width - pad.left - pad.right) / bars.length;
  const candleWidth = Math.max(3, Math.min(14, slot * 0.62));

  bars.forEach((bar, index) => {
    const x = pad.left + index * slot + slot / 2;
    const openY = yScale(bar.open, range.min, range.max, canvas.height, pad);
    const closeY = yScale(bar.close, range.min, range.max, canvas.height, pad);
    const highY = yScale(bar.high, range.min, range.max, canvas.height, pad);
    const lowY = yScale(bar.low, range.min, range.max, canvas.height, pad);
    const rising = bar.close >= bar.open;

    ctx.strokeStyle = rising ? colors.rise : colors.fall;
    ctx.fillStyle = rising ? "#fff" : colors.fall;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, highY);
    ctx.lineTo(x, lowY);
    ctx.stroke();
    ctx.strokeRect(x - candleWidth / 2, Math.min(openY, closeY), candleWidth, Math.max(1, Math.abs(openY - closeY)));
    if (!rising) ctx.fillRect(x - candleWidth / 2, Math.min(openY, closeY), candleWidth, Math.max(1, Math.abs(openY - closeY)));
  });

  if (els.showBoll.checked) {
    drawLine(ctx, canvas, indicators, "bollUpper", range, pad, colors.bollBand, 1.5, [7, 5]);
    drawLine(ctx, canvas, indicators, "bollMid", range, pad, colors.bollMid, 1.5);
    drawLine(ctx, canvas, indicators, "bollLower", range, pad, colors.bollBand, 1.5, [7, 5]);
  }
  if (els.showMa.checked) {
    drawLine(ctx, canvas, indicators, "ma5", range, pad, colors.ma5, 2);
    drawLine(ctx, canvas, indicators, "ma10", range, pad, colors.ma10, 2);
    drawLine(ctx, canvas, indicators, "ma20", range, pad, colors.ma20, 2);
    drawLine(ctx, canvas, indicators, "ma60", range, pad, colors.ma60, 2);
  }
  if (els.showLongMa.checked) drawLine(ctx, canvas, indicators, "ma120", range, pad, colors.ma120, 2);

  drawDateLabels(ctx, canvas, bars, pad);
}

function drawVolumeChart(canvas, bars, indicators) {
  const ctx = setupCanvas(canvas);
  if (!bars.length) return;

  const pad = { left: 58, right: 18, top: 16, bottom: 26 };
  const values = bars.map((bar) => bar.volume);
  indicators.forEach((item) => {
    pushFinite(values, item.mavol5);
    pushFinite(values, item.mavol10);
  });
  const range = { min: 0, max: Math.max(...values, 1) };
  drawGrid(ctx, canvas, pad, range.min, range.max);

  const slot = (canvas.width - pad.left - pad.right) / bars.length;
  const barWidth = Math.max(1, slot * 0.68);
  bars.forEach((bar, index) => {
    const x = pad.left + index * slot + (slot - barWidth) / 2;
    const y = yScale(bar.volume, range.min, range.max, canvas.height, pad);
    ctx.fillStyle = bar.close >= bar.open ? colors.rise : colors.fall;
    ctx.globalAlpha = 0.78;
    ctx.fillRect(x, y, barWidth, canvas.height - pad.bottom - y);
    ctx.globalAlpha = 1;
  });

  drawLine(ctx, canvas, indicators, "mavol5", range, pad, colors.ma5, 2);
  drawLine(ctx, canvas, indicators, "mavol10", range, pad, colors.ma10, 2);
}

function drawCumulativeReturnChart(canvas, bars) {
  const ctx = setupCanvas(canvas);
  if (!bars.length) return;

  const baseClose = bars[0].close;
  const returns = bars.map((bar) => ({
    ...bar,
    cumulativeReturn: baseClose ? bar.close / baseClose - 1 : 0,
  }));
  const values = returns.map((bar) => bar.cumulativeReturn);
  const range = paddedRange(values.concat([0]));
  const pad = { left: 58, right: 18, top: 16, bottom: 26 };

  drawPercentGrid(ctx, canvas, pad, range.min, range.max);
  drawZeroLine(ctx, canvas, pad, range);
  drawReturnArea(ctx, canvas, returns, range, pad);
  drawLine(ctx, canvas, returns, "cumulativeReturn", range, pad, colors.cumulativeReturn, 2.4);
  drawDateLabels(ctx, canvas, bars, pad);
}

function drawMacdChart(canvas, indicators) {
  const ctx = setupCanvas(canvas);
  if (!indicators.length || !els.showMacd.checked) return;

  const pad = { left: 58, right: 18, top: 16, bottom: 26 };
  const values = indicators.flatMap((item) => [item.dif, item.dea, item.hist]).filter(Number.isFinite);
  const range = paddedRange(values.concat([0]));
  drawGrid(ctx, canvas, pad, range.min, range.max);
  drawZeroLine(ctx, canvas, pad, range);

  const slot = (canvas.width - pad.left - pad.right) / indicators.length;
  indicators.forEach((item, index) => {
    if (!Number.isFinite(item.hist)) return;
    const x = pad.left + index * slot + slot * 0.18;
    const zero = yScale(0, range.min, range.max, canvas.height, pad);
    const y = yScale(item.hist, range.min, range.max, canvas.height, pad);
    ctx.fillStyle = item.hist >= 0 ? colors.rise : colors.fall;
    ctx.fillRect(x, Math.min(y, zero), Math.max(1, slot * 0.62), Math.max(1, Math.abs(zero - y)));
  });

  drawLine(ctx, canvas, indicators, "dif", range, pad, colors.dif, 2);
  drawLine(ctx, canvas, indicators, "dea", range, pad, colors.dea, 2);
}

function drawRsiChart(canvas, indicators) {
  const ctx = setupCanvas(canvas);
  if (!indicators.length || !els.showRsi.checked) return;

  const pad = { left: 58, right: 18, top: 16, bottom: 26 };
  const range = { min: 0, max: 100 };
  drawGrid(ctx, canvas, pad, range.min, range.max);
  drawReferenceLine(ctx, canvas, pad, range, 70, "#ccd5dc");
  drawReferenceLine(ctx, canvas, pad, range, 30, "#ccd5dc");
  drawLine(ctx, canvas, indicators, "rsi6", range, pad, colors.rsi6, 2);
  drawLine(ctx, canvas, indicators, "rsi12", range, pad, colors.rsi12, 2);
  drawLine(ctx, canvas, indicators, "rsi24", range, pad, colors.rsi24, 2);
}

function drawKdjChart(canvas, indicators) {
  const ctx = setupCanvas(canvas);
  if (!indicators.length || !els.showKdj.checked) return;

  const pad = { left: 58, right: 18, top: 16, bottom: 26 };
  const values = indicators.flatMap((item) => [item.k, item.d, item.j]).filter(Number.isFinite);
  const range = paddedRange(values.concat([0, 100]));
  drawGrid(ctx, canvas, pad, range.min, range.max);
  drawReferenceLine(ctx, canvas, pad, range, 80, "#ccd5dc");
  drawReferenceLine(ctx, canvas, pad, range, 20, "#ccd5dc");
  drawLine(ctx, canvas, indicators, "k", range, pad, colors.k, 2);
  drawLine(ctx, canvas, indicators, "d", range, pad, colors.d, 2);
  drawLine(ctx, canvas, indicators, "j", range, pad, colors.j, 2);
}

function drawAcfPacfCharts(bars) {
  const acfCtx = setupCanvas(els.acfChart);
  const pacfCtx = setupCanvas(els.pacfChart);
  if (!els.showAcf.checked || bars.length < 12) return;

  const returns = toLogReturns(bars.map((bar) => bar.close));
  const maxLag = Math.min(Number(els.acfLag.value), returns.length - 1);
  if (returns.length < 10 || maxLag < 1) return;

  const acf = autocorrelation(returns, maxLag);
  const pacf = partialAutocorrelation(acf, maxLag);
  const confidence = 1.96 / Math.sqrt(returns.length);

  drawCorrelationChart(acfCtx, els.acfChart, acf, confidence, colors.acf);
  drawCorrelationChart(pacfCtx, els.pacfChart, pacf, confidence, colors.pacf);
}

function drawCorrelationChart(ctx, canvas, values, confidence, color) {
  const pad = { left: 58, right: 18, top: 16, bottom: 30 };
  const plotWidth = canvas.width - pad.left - pad.right;
  const maxAbs = Math.max(1, Math.abs(confidence), ...values.slice(1).map((value) => Math.abs(value)));
  const range = { min: -maxAbs, max: maxAbs };
  const zeroY = yScale(0, range.min, range.max, canvas.height, pad);
  const slot = plotWidth / Math.max(1, values.length - 1);
  const stemWidth = Math.max(2, Math.min(8, slot * 0.38));

  drawGrid(ctx, canvas, pad, range.min, range.max);
  drawReferenceLine(ctx, canvas, pad, range, 0, "#aeb8bf");
  drawReferenceLine(ctx, canvas, pad, range, confidence, colors.confidence);
  drawReferenceLine(ctx, canvas, pad, range, -confidence, colors.confidence);

  values.slice(1).forEach((value, index) => {
    const lag = index + 1;
    const x = pad.left + lag * slot;
    const y = yScale(value, range.min, range.max, canvas.height, pad);
    ctx.strokeStyle = Math.abs(value) > confidence ? color : "#6d7883";
    ctx.lineWidth = stemWidth;
    ctx.beginPath();
    ctx.moveTo(x, zeroY);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.fillStyle = ctx.strokeStyle;
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = "#66727c";
  ctx.font = "17px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
  const step = Math.max(1, Math.ceil((values.length - 1) / 8));
  for (let lag = step; lag < values.length; lag += step) {
    const x = pad.left + lag * slot;
    ctx.fillText(String(lag), Math.min(x, canvas.width - 28), canvas.height - 9);
  }
}

function setupCanvas(canvas) {
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return ctx;
}

function drawGrid(ctx, canvas, pad, min, max) {
  ctx.strokeStyle = "#e8edf1";
  ctx.lineWidth = 1;
  ctx.font = "18px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
  ctx.fillStyle = "#66727c";

  for (let step = 0; step <= 4; step += 1) {
    const y = pad.top + (step / 4) * (canvas.height - pad.top - pad.bottom);
    const value = max - (step / 4) * (max - min);
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(canvas.width - pad.right, y);
    ctx.stroke();
    ctx.fillText(formatNumber(value), 8, y + 6);
  }
}

function drawPercentGrid(ctx, canvas, pad, min, max) {
  ctx.strokeStyle = "#e8edf1";
  ctx.lineWidth = 1;
  ctx.font = "18px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
  ctx.fillStyle = "#66727c";

  for (let step = 0; step <= 4; step += 1) {
    const y = pad.top + (step / 4) * (canvas.height - pad.top - pad.bottom);
    const value = max - (step / 4) * (max - min);
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(canvas.width - pad.right, y);
    ctx.stroke();
    ctx.fillText(formatPercent(value), 8, y + 6);
  }
}

function drawReturnArea(ctx, canvas, rows, range, pad) {
  const slot = (canvas.width - pad.left - pad.right) / rows.length;
  const zeroY = yScale(0, range.min, range.max, canvas.height, pad);
  ctx.fillStyle = "rgba(15, 140, 159, 0.12)";
  ctx.beginPath();
  ctx.moveTo(pad.left + slot / 2, zeroY);

  rows.forEach((row, index) => {
    const x = pad.left + index * slot + slot / 2;
    const y = yScale(row.cumulativeReturn, range.min, range.max, canvas.height, pad);
    ctx.lineTo(x, y);
  });

  ctx.lineTo(pad.left + (rows.length - 0.5) * slot, zeroY);
  ctx.closePath();
  ctx.fill();
}

function drawDateLabels(ctx, canvas, bars, pad) {
  ctx.fillStyle = "#66727c";
  ctx.font = "17px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
  const labels = 5;
  for (let index = 0; index < labels; index += 1) {
    const barIndex = Math.round((index / (labels - 1)) * (bars.length - 1));
    const x = pad.left + (barIndex / Math.max(1, bars.length - 1)) * (canvas.width - pad.left - pad.right);
    ctx.fillText(String(bars[barIndex].date ?? ""), Math.min(x, canvas.width - 120), canvas.height - 9);
  }
}

function drawLine(ctx, canvas, rows, key, range, pad, color, width = 2, dash = []) {
  const slot = (canvas.width - pad.left - pad.right) / rows.length;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dash);
  ctx.beginPath();
  let drawing = false;

  rows.forEach((row, index) => {
    const value = row[key];
    if (!Number.isFinite(value)) {
      drawing = false;
      return;
    }
    const x = pad.left + index * slot + slot / 2;
    const y = yScale(value, range.min, range.max, canvas.height, pad);
    if (!drawing) {
      ctx.moveTo(x, y);
      drawing = true;
    } else {
      ctx.lineTo(x, y);
    }
  });

  ctx.stroke();
  ctx.setLineDash([]);
}

function drawZeroLine(ctx, canvas, pad, range) {
  drawReferenceLine(ctx, canvas, pad, range, 0, "#aeb8bf");
}

function drawReferenceLine(ctx, canvas, pad, range, value, color) {
  if (value < range.min || value > range.max) return;
  const y = yScale(value, range.min, range.max, canvas.height, pad);
  ctx.strokeStyle = color;
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.moveTo(pad.left, y);
  ctx.lineTo(canvas.width - pad.right, y);
  ctx.stroke();
  ctx.setLineDash([]);
}

function yScale(value, min, max, height, pad) {
  if (max === min) return height / 2;
  return height - pad.bottom - ((value - min) / (max - min)) * (height - pad.top - pad.bottom);
}

function sma(values, period) {
  const result = Array(values.length).fill(null);
  let sum = 0;
  values.forEach((value, index) => {
    sum += value;
    if (index >= period) sum -= values[index - period];
    if (index >= period - 1) result[index] = sum / period;
  });
  return result;
}

function ema(values, period) {
  const result = Array(values.length).fill(null);
  const multiplier = 2 / (period + 1);
  values.forEach((value, index) => {
    if (index === 0) result[index] = value;
    else result[index] = value * multiplier + result[index - 1] * (1 - multiplier);
  });
  return result;
}

function bollinger(values, period, multiplier) {
  const mid = sma(values, period);
  const upper = Array(values.length).fill(null);
  const lower = Array(values.length).fill(null);
  values.forEach((_, index) => {
    if (index < period - 1) return;
    const slice = values.slice(index - period + 1, index + 1);
    const avg = mid[index];
    const dev = Math.sqrt(slice.reduce((sum, value) => sum + (value - avg) ** 2, 0) / period);
    upper[index] = avg + dev * multiplier;
    lower[index] = avg - dev * multiplier;
  });
  return { mid, upper, lower };
}

function calculateMacd(values, shortPeriod, longPeriod, signalPeriod) {
  const shortEma = ema(values, shortPeriod);
  const longEma = ema(values, longPeriod);
  const dif = values.map((_, index) => shortEma[index] - longEma[index]);
  const dea = ema(dif, signalPeriod);
  const hist = dif.map((value, index) => (value - dea[index]) * 2);
  return { dif, dea, hist };
}

function rsi(values, period) {
  const result = Array(values.length).fill(null);
  let avgGain = 0;
  let avgLoss = 0;

  for (let index = 1; index < values.length; index += 1) {
    const change = values[index] - values[index - 1];
    const gain = Math.max(change, 0);
    const loss = Math.max(-change, 0);

    if (index <= period) {
      avgGain += gain;
      avgLoss += loss;
      if (index === period) {
        avgGain /= period;
        avgLoss /= period;
        result[index] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
      }
    } else {
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
      result[index] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    }
  }

  return result;
}

function calculateKdj(highs, lows, closes, period) {
  const k = Array(closes.length).fill(null);
  const d = Array(closes.length).fill(null);
  const j = Array(closes.length).fill(null);
  let previousK = 50;
  let previousD = 50;

  closes.forEach((close, index) => {
    const start = Math.max(0, index - period + 1);
    const high = Math.max(...highs.slice(start, index + 1));
    const low = Math.min(...lows.slice(start, index + 1));
    const rsv = high === low ? 50 : ((close - low) / (high - low)) * 100;
    previousK = (2 * previousK + rsv) / 3;
    previousD = (2 * previousD + previousK) / 3;
    k[index] = previousK;
    d[index] = previousD;
    j[index] = 3 * previousK - 2 * previousD;
  });

  return { k, d, j };
}

function toLogReturns(values) {
  const returns = [];
  for (let index = 1; index < values.length; index += 1) {
    const previous = values[index - 1];
    const current = values[index];
    if (previous > 0 && current > 0) returns.push(Math.log(current / previous));
  }
  return returns;
}

function autocorrelation(values, maxLag) {
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  const centered = values.map((value) => value - average);
  const denominator = centered.reduce((sum, value) => sum + value * value, 0);
  const result = [];

  for (let lag = 0; lag <= maxLag; lag += 1) {
    let numerator = 0;
    for (let index = lag; index < centered.length; index += 1) {
      numerator += centered[index] * centered[index - lag];
    }
    result.push(denominator ? numerator / denominator : 0);
  }

  return result;
}

function partialAutocorrelation(acf, maxLag) {
  const result = [1];
  const phi = [];
  let variance = acf[0] || 1;

  for (let lag = 1; lag <= maxLag; lag += 1) {
    let numerator = acf[lag];
    for (let index = 1; index < lag; index += 1) {
      numerator -= (phi[index] || 0) * acf[lag - index];
    }

    const coefficient = variance ? numerator / variance : 0;
    const nextPhi = phi.slice();
    nextPhi[lag] = coefficient;

    for (let index = 1; index < lag; index += 1) {
      nextPhi[index] = (phi[index] || 0) - coefficient * (phi[lag - index] || 0);
    }

    phi.splice(0, phi.length, ...nextPhi);
    variance *= 1 - coefficient * coefficient;
    result.push(coefficient);
  }

  return result;
}

function adfTest(values, requestedLag) {
  const clean = values.filter(Number.isFinite);
  if (clean.length < 12) return { ok: false, message: "有效样本太少，无法进行 ADF 检验" };

  const maxUsefulLag = Math.max(0, Math.floor((clean.length - 6) / 3));
  const lag = Math.min(requestedLag, maxUsefulLag);
  const diff = clean.slice(1).map((value, index) => value - clean[index]);
  const y = [];
  const x = [];

  for (let index = lag + 1; index < clean.length; index += 1) {
    const row = [1, clean[index - 1]];
    for (let diffLag = 1; diffLag <= lag; diffLag += 1) {
      row.push(diff[index - diffLag - 1]);
    }
    x.push(row);
    y.push(diff[index - 1]);
  }

  const observations = y.length;
  const regressors = lag + 2;
  if (observations <= regressors + 1) return { ok: false, message: "样本不足以估计当前 ADF 滞后阶数" };

  const fit = ordinaryLeastSquares(x, y);
  if (!fit) return { ok: false, message: "ADF 回归矩阵不可逆，请换一个时间区间或降低滞后阶数" };

  const coefficient = fit.beta[1];
  const standardError = Math.sqrt(Math.max(0, fit.covariance[1][1]));
  const statistic = standardError ? coefficient / standardError : NaN;
  if (!Number.isFinite(statistic)) return { ok: false, message: "ADF 统计量无法计算" };

  const critical = adfCriticalValues();
  return {
    ok: true,
    lag,
    observations,
    statistic,
    critical,
    stationary: statistic < critical["5%"],
  };
}

function ordinaryLeastSquares(x, y) {
  const rows = x.length;
  const cols = x[0].length;
  const xtx = Array.from({ length: cols }, () => Array(cols).fill(0));
  const xty = Array(cols).fill(0);

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      xty[col] += x[row][col] * y[row];
      for (let inner = 0; inner < cols; inner += 1) {
        xtx[col][inner] += x[row][col] * x[row][inner];
      }
    }
  }

  const inverse = invertMatrix(xtx);
  if (!inverse) return null;

  const beta = inverse.map((row) => row.reduce((sum, value, index) => sum + value * xty[index], 0));
  let rss = 0;
  for (let row = 0; row < rows; row += 1) {
    const fitted = x[row].reduce((sum, value, index) => sum + value * beta[index], 0);
    rss += (y[row] - fitted) ** 2;
  }

  const degrees = rows - cols;
  if (degrees <= 0) return null;
  const variance = rss / degrees;
  const covariance = inverse.map((row) => row.map((value) => value * variance));
  return { beta, covariance };
}

function invertMatrix(matrix) {
  const size = matrix.length;
  const augmented = matrix.map((row, index) => [
    ...row,
    ...Array.from({ length: size }, (_, col) => (col === index ? 1 : 0)),
  ]);

  for (let col = 0; col < size; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < size; row += 1) {
      if (Math.abs(augmented[row][col]) > Math.abs(augmented[pivot][col])) pivot = row;
    }
    if (Math.abs(augmented[pivot][col]) < 1e-12) return null;

    [augmented[col], augmented[pivot]] = [augmented[pivot], augmented[col]];
    const divisor = augmented[col][col];
    for (let item = 0; item < size * 2; item += 1) augmented[col][item] /= divisor;

    for (let row = 0; row < size; row += 1) {
      if (row === col) continue;
      const factor = augmented[row][col];
      for (let item = 0; item < size * 2; item += 1) {
        augmented[row][item] -= factor * augmented[col][item];
      }
    }
  }

  return augmented.map((row) => row.slice(size));
}

function adfCriticalValues() {
  return {
    "1%": -3.43,
    "5%": -2.86,
    "10%": -2.57,
  };
}

function ljungBoxTest(values, requestedLag) {
  const clean = values.filter(Number.isFinite);
  if (clean.length < 8) return { ok: false, message: "有效样本太少，无法进行 LB 检验" };

  const lag = Math.min(requestedLag, clean.length - 2);
  if (lag < 1) return { ok: false, message: "LB 检验滞后阶数不足" };

  const acf = autocorrelation(clean, lag);
  let statistic = 0;
  for (let index = 1; index <= lag; index += 1) {
    statistic += (acf[index] ** 2) / (clean.length - index);
  }
  statistic *= clean.length * (clean.length + 2);

  return {
    ok: true,
    lag,
    degrees: lag,
    statistic,
    pValue: chiSquareSurvival(statistic, lag),
  };
}

function chiSquareSurvival(value, degrees) {
  if (value < 0 || degrees < 1) return NaN;
  return regularizedGammaQ(degrees / 2, value / 2);
}

function regularizedGammaQ(a, x) {
  if (x < 0 || a <= 0) return NaN;
  if (x === 0) return 1;
  if (x < a + 1) return 1 - regularizedGammaPSeries(a, x);
  return regularizedGammaQContinuedFraction(a, x);
}

function regularizedGammaPSeries(a, x) {
  const gln = logGamma(a);
  let sum = 1 / a;
  let del = sum;
  let ap = a;

  for (let index = 0; index < 100; index += 1) {
    ap += 1;
    del *= x / ap;
    sum += del;
    if (Math.abs(del) < Math.abs(sum) * 1e-12) break;
  }

  return sum * Math.exp(-x + a * Math.log(x) - gln);
}

function regularizedGammaQContinuedFraction(a, x) {
  const gln = logGamma(a);
  let b = x + 1 - a;
  let c = 1 / 1e-30;
  let d = 1 / b;
  let h = d;

  for (let index = 1; index <= 100; index += 1) {
    const an = -index * (index - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = b + an / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-12) break;
  }

  return Math.exp(-x + a * Math.log(x) - gln) * h;
}

function logGamma(value) {
  const coefficients = [
    676.5203681218851,
    -1259.1392167224028,
    771.3234287776531,
    -176.6150291621406,
    12.507343278686905,
    -0.13857109526572012,
    9.984369578019572e-6,
    1.5056327351493116e-7,
  ];

  if (value < 0.5) return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * value)) - logGamma(1 - value);

  let x = 0.9999999999998099;
  const z = value - 1;
  for (let index = 0; index < coefficients.length; index += 1) {
    x += coefficients[index] / (z + index + 1);
  }
  const t = z + coefficients.length - 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

function paddedRange(values) {
  const clean = values.filter(Number.isFinite);
  if (!clean.length) return { min: 0, max: 1 };
  let min = Math.min(...clean);
  let max = Math.max(...clean);
  const pad = (max - min || Math.abs(max) || 1) * 0.08;
  min -= pad;
  max += pad;
  return { min, max };
}

function pushFinite(values, value) {
  if (Number.isFinite(value)) values.push(value);
}

function getMaxDrawdown(values) {
  let peak = values[0];
  let worst = 0;
  values.forEach((value) => {
    peak = Math.max(peak, value);
    worst = Math.min(worst, value / peak - 1);
  });
  return worst;
}

function standardDeviation(values) {
  if (values.length < 2) return 0;
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - average) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function metric(label, value) {
  return `<div class="metric"><span>${label}</span><strong>${value}</strong></div>`;
}

function parseNumber(value) {
  const number = Number(String(value ?? "").replaceAll(",", ""));
  return Number.isFinite(number) ? number : NaN;
}

function toInputDate(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return `${iso[1]}-${pad2(iso[2])}-${pad2(iso[3])}`;

  const slash = raw.match(/^(\d{4})[/.年](\d{1,2})[/.月](\d{1,2})/);
  if (slash) return `${slash[1]}-${pad2(slash[2])}-${pad2(slash[3])}`;

  const compact = raw.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compact) return `${compact[1]}-${compact[2]}-${compact[3]}`;

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "";
  return [
    parsed.getFullYear(),
    pad2(parsed.getMonth() + 1),
    pad2(parsed.getDate()),
  ].join("-");
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

function formatNumber(value) {
  return Number(value).toLocaleString("zh-CN", { maximumFractionDigits: 2 });
}

function formatSigned(value) {
  return Number(value).toLocaleString("zh-CN", {
    maximumFractionDigits: 4,
    minimumFractionDigits: 4,
  });
}

function formatPValue(value) {
  if (!Number.isFinite(value)) return "-";
  if (value < 0.0001) return "<0.0001";
  return Number(value).toLocaleString("zh-CN", {
    maximumFractionDigits: 4,
    minimumFractionDigits: 4,
  });
}

function formatPercent(value) {
  return `${(value * 100).toFixed(2)}%`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

render();
