const state = {
  rows: [],
  headers: [],
  returnType: "simple",
  summaries: [],
  overallSummary: null,
  enrichedRows: [],
  dateBounds: { min: "", max: "" },
  benchmarkStats: [],
  benchmarkRows: [],
  benchmarkHeaders: [],
  marketRows: [],
  qualityRows: [],
  qualityHeaders: [],
  longTermScores: [],
  qualityTrendScores: [],
  pairSsdResults: [],
};

const els = {
  fileInput: document.getElementById("fileInput"),
  fileName: document.getElementById("fileName"),
  dateCol: document.getElementById("dateCol"),
  closeCol: document.getElementById("closeCol"),
  tickerCol: document.getElementById("tickerCol"),
  turnoverCol: document.getElementById("turnoverCol"),
  peCol: document.getElementById("peCol"),
  psCol: document.getElementById("psCol"),
  pcCol: document.getElementById("pcCol"),
  pbCol: document.getElementById("pbCol"),
  moneyCol: document.getElementById("moneyCol"),
  startDate: document.getElementById("startDate"),
  endDate: document.getElementById("endDate"),
  resetDateBtn: document.getElementById("resetDateBtn"),
  pairMinOverlap: document.getElementById("pairMinOverlap"),
  pairTopCount: document.getElementById("pairTopCount"),
  benchmarkFileInput: document.getElementById("benchmarkFileInput"),
  benchmarkFileName: document.getElementById("benchmarkFileName"),
  qualityFileInput: document.getElementById("qualityFileInput"),
  qualityFileName: document.getElementById("qualityFileName"),
  benchmarkDateCol: document.getElementById("benchmarkDateCol"),
  benchmarkCloseCol: document.getElementById("benchmarkCloseCol"),
  benchmarkTickerCol: document.getElementById("benchmarkTickerCol"),
  benchmarkTicker: document.getElementById("benchmarkTicker"),
  tradingDays: document.getElementById("tradingDays"),
  riskFreeRate: document.getElementById("riskFreeRate"),
  binCount: document.getElementById("binCount"),
  binValue: document.getElementById("binValue"),
  simpleReturnBtn: document.getElementById("simpleReturnBtn"),
  logReturnBtn: document.getElementById("logReturnBtn"),
  sampleBtn: document.getElementById("sampleBtn"),
  exportBtn: document.getElementById("exportBtn"),
  datasetTitle: document.getElementById("datasetTitle"),
  metricCards: document.getElementById("metricCards"),
  chartSubtitle: document.getElementById("chartSubtitle"),
  distributionCharts: document.getElementById("distributionCharts"),
  qualityText: document.getElementById("qualityText"),
  qualityList: document.getElementById("qualityList"),
  summaryHead: document.getElementById("summaryHead"),
  summaryBody: document.getElementById("summaryBody"),
  benchmarkSubtitle: document.getElementById("benchmarkSubtitle"),
  benchmarkCharts: document.getElementById("benchmarkCharts"),
  benchmarkHead: document.getElementById("benchmarkHead"),
  benchmarkBody: document.getElementById("benchmarkBody"),
  pairSsdSubtitle: document.getElementById("pairSsdSubtitle"),
  pairSsdHead: document.getElementById("pairSsdHead"),
  pairSsdBody: document.getElementById("pairSsdBody"),
  longTermSubtitle: document.getElementById("longTermSubtitle"),
  longTermHead: document.getElementById("longTermHead"),
  longTermBody: document.getElementById("longTermBody"),
  qualityTrendSubtitle: document.getElementById("qualityTrendSubtitle"),
  qualityTrendHead: document.getElementById("qualityTrendHead"),
  qualityTrendBody: document.getElementById("qualityTrendBody"),
};

const factorDefs = [
  { key: "turnover", label: "换手率", el: "turnoverCol", candidates: ["turnover", "turnover_rate", "换手率"] },
  { key: "pe", label: "PE", el: "peCol", candidates: ["pe", "pe_ttm", "市盈率"] },
  { key: "ps", label: "PS", el: "psCol", candidates: ["ps", "ps_ttm", "市销率"] },
  { key: "pc", label: "PC", el: "pcCol", candidates: ["pc", "pcf", "pc_ttm", "市现率"] },
  { key: "pb", label: "PB", el: "pbCol", candidates: ["pb", "pb_lf", "市净率"] },
];

const longTermModel = {
  name: "全 A 股长期成长线性模型",
  trainEnd: "2022-12-30",
  testStart: "2023-01-03",
  testEnd: "2025-05-12",
  horizonDays: 250,
  rankIcMean: 0.18291511026558915,
  rankIcPositiveRate: 0.9576719576719577,
  coefficients: {
    intercept: 0.1045295431757177,
    turnover: -0.0132007783227452,
    log_money: -0.0095621356717631,
    PE_TTM: -0.0114530305253865,
    PS_TTM: -0.0122200883620363,
    PC_TTM: 0.0013628208154677,
    PB: -0.0136135089603111,
    mom_60d: 0.0020571485241533,
    mom_120d: 0.0097678640508772,
    mom_250d: 0.0079153390908027,
    vol_60d: -0.0038328824085799,
    drawdown_250d: -0.0312984777251179,
    ma_gap_250d: -0.0216955614439832,
    turnover_60d_mean: 0.0137704526488634,
    turnover_change_20_120: -0.0048883888076353,
    log_money_60d_mean: -0.0410044746175001,
    pe_change_250d: -0.0149527191771172,
    ps_change_250d: -0.0201372258960462,
    pb_change_250d: 0.0005532493214197,
  },
  featureStatsDate: "2026-05-22",
  zcap: 5,
  featureStats: {
    turnover: { mean: 0.033663705857900766, std: 0.03716919697633028 },
    log_money: { mean: 19.159014288425286, std: 1.391437870049095 },
    PE_TTM: { mean: 102.37130861221947, std: 378.08631959865636 },
    PS_TTM: { mean: 6.82879610280802, std: 35.82902539650937 },
    PC_TTM: { mean: 96.12908911746379, std: 1137.0707955873477 },
    PB: { mean: 3.9412760270594083, std: 4.738817665605439 },
    mom_60d: { mean: 0.02469656674177641, std: 0.30482813507464895 },
    mom_120d: { mean: 0.15043621977439056, std: 0.5094617695230748 },
    mom_250d: { mean: 0.44922039340440834, std: 0.9608378952932654 },
    vol_60d: { mean: 0.46090700856689204, std: 0.16503033953747998 },
    drawdown_250d: { mean: 0.209385547981173, std: 0.13094293727600936 },
    ma_gap_250d: { mean: 0.11740773935072259, std: 0.3628630050442679 },
    turnover_60d_mean: { mean: 0.03168239876108856, std: 0.026974466264594217 },
    turnover_change_20_120: { mean: 0.10295851608987582, std: 0.4192562452010129 },
    log_money_60d_mean: { mean: 19.249603934813322, std: 1.2106335154842287 },
    pe_change_250d: { mean: 0.7364355000427502, std: 3.519901789474556 },
    ps_change_250d: { mean: 0.9265678048596196, std: 29.38974719534689 },
    pb_change_250d: { mean: 0.3669023126342752, std: 0.8625243672940474 },
  },
  predictionQuantiles: [
    [0, -0.1470922675900874],
    [0.01, -0.05871113179385896],
    [0.05, -0.005155427859121351],
    [0.1, 0.02140887282866788],
    [0.2, 0.0554506487354341],
    [0.3, 0.0778031173890045],
    [0.4, 0.09782146950752209],
    [0.5, 0.1129974295305679],
    [0.6, 0.12969332309018716],
    [0.7, 0.14645196153971748],
    [0.8, 0.16286216146887222],
    [0.9, 0.18201470354294383],
    [0.95, 0.19781656458503138],
    [0.99, 0.21564395984556609],
    [1, 0.2737466474703676],
  ],
};

const longTermFactorDefs = [
  { key: "turnover", label: "换手率", columnEl: "turnoverCol", transform: "raw" },
  { key: "log_money", label: "成交额", columnEl: "moneyCol", transform: "log1p" },
  { key: "PE_TTM", label: "PE", columnEl: "peCol", transform: "raw" },
  { key: "PS_TTM", label: "PS", columnEl: "psCol", transform: "raw" },
  { key: "PC_TTM", label: "PC", columnEl: "pcCol", transform: "raw" },
  { key: "PB", label: "PB", columnEl: "pbCol", transform: "raw" },
  { key: "mom_60d", label: "60日动量", transform: "derived" },
  { key: "mom_120d", label: "120日动量", transform: "derived" },
  { key: "mom_250d", label: "250日动量", transform: "derived" },
  { key: "vol_60d", label: "60日波动", transform: "derived" },
  { key: "drawdown_250d", label: "250日回撤", transform: "derived" },
  { key: "ma_gap_250d", label: "250日均线偏离", transform: "derived" },
  { key: "turnover_60d_mean", label: "60日均换手", transform: "derived" },
  { key: "turnover_change_20_120", label: "换手变化", transform: "derived" },
  { key: "log_money_60d_mean", label: "60日均成交额", transform: "derived" },
  { key: "pe_change_250d", label: "PE变化", transform: "derived" },
  { key: "ps_change_250d", label: "PS变化", transform: "derived" },
  { key: "pb_change_250d", label: "PB变化", transform: "derived" },
];

const recoveryModel = {
  name: "低估修复轻量线性模型",
  trainEnd: "2022-12-30",
  rankIcMean: 0.18178143727373874,
  rankIcPositiveRate: 0.9594356261022927,
  zcap: 5,
  coefficients: {
    intercept: 0.1045493053815603,
    turnover: -0.013330036695158,
    log_money: -0.0098248822415648,
    PE_TTM: -0.0114743991216024,
    PS_TTM: -0.0122995912811672,
    PC_TTM: 0.0013754803311596,
    PB: -0.0132126410394534,
    mom_20d: -0.0014173887368953,
    mom_60d: -0.000026176279033380204,
    mom_120d: 0.0021483972416478,
    vol_60d: -0.0111875160329278,
    vol_ratio_60_250: 0.0017759272933653,
    drawdown_250d: -0.0280400546137014,
    low_rebound_60d: 0.0127369611294179,
    ma_gap_60d: -0.0132899731594035,
    ma_gap_120d: -0.0023954800098809,
    turnover_60d_mean: 0.0139100880916464,
    log_money_60d_mean: -0.0415330942162861,
    pe_change_250d: -0.0147992570968473,
    ps_change_250d: -0.0199650025749628,
    pb_change_250d: 0.0010919481468962,
  },
  featureStats: {
    turnover: { mean: 0.03366370585790076, std: 0.03716919697633028 },
    log_money: { mean: 19.159014288425286, std: 1.3914378700490948 },
    PE_TTM: { mean: 102.37130861221944, std: 378.08631959865636 },
    PS_TTM: { mean: 6.82879610280802, std: 35.829025396509365 },
    PC_TTM: { mean: 96.12908911746379, std: 1137.070795587348 },
    PB: { mean: 3.941276027059408, std: 4.7388176656054375 },
    mom_20d: { mean: 0.02018664017327685, std: 0.1765544158966207 },
    mom_60d: { mean: 0.0246965667417764, std: 0.3048281350746489 },
    mom_120d: { mean: 0.1504362197743906, std: 0.5094617695230748 },
    vol_60d: { mean: 0.46090700856689204, std: 0.16503033953748003 },
    vol_ratio_60_250: { mean: 0.13086820583822645, std: 0.23314925779283077 },
    drawdown_250d: { mean: 0.20938554798117304, std: 0.13094293727600942 },
    low_rebound_60d: { mean: 0.1993420051474145, std: 0.29597315606574615 },
    ma_gap_60d: { mean: 0.020914466083743477, std: 0.17208143258406114 },
    ma_gap_120d: { mean: 0.041956662512817655, std: 0.24239689009852625 },
    turnover_60d_mean: { mean: 0.03168239876108856, std: 0.02697446626459421 },
    log_money_60d_mean: { mean: 19.249603934813322, std: 1.2106335154842292 },
    pe_change_250d: { mean: 0.7364355000427502, std: 3.519901789474555 },
    ps_change_250d: { mean: 0.9265678048596198, std: 29.389747195346892 },
    pb_change_250d: { mean: 0.36690231263427525, std: 0.8625243672940474 },
  },
  predictionQuantiles: [
    [0, -0.1612941407750497],
    [0.01, -0.06975107041097739],
    [0.05, -0.006879744229242052],
    [0.1, 0.02148965879510589],
    [0.2, 0.05376808344814135],
    [0.3, 0.0770117043676035],
    [0.4, 0.09760410806528563],
    [0.5, 0.11447872009988999],
    [0.6, 0.13051855471310178],
    [0.7, 0.14807696227979217],
    [0.8, 0.16461662358752804],
    [0.9, 0.1835524404652257],
    [0.95, 0.19870509334380354],
    [0.99, 0.21834300157528827],
    [1, 0.2751785036531199],
  ],
};

const recoveryFactorDefs = [
  { key: "turnover", label: "换手率" },
  { key: "log_money", label: "成交额" },
  { key: "PE_TTM", label: "PE" },
  { key: "PS_TTM", label: "PS" },
  { key: "PC_TTM", label: "PC" },
  { key: "PB", label: "PB" },
  { key: "mom_20d", label: "20日动量" },
  { key: "mom_60d", label: "60日动量" },
  { key: "mom_120d", label: "120日动量" },
  { key: "vol_60d", label: "60日波动" },
  { key: "vol_ratio_60_250", label: "波动收缩" },
  { key: "drawdown_250d", label: "250日回撤" },
  { key: "low_rebound_60d", label: "60日低位反弹" },
  { key: "ma_gap_60d", label: "60日均线偏离" },
  { key: "ma_gap_120d", label: "120日均线偏离" },
  { key: "turnover_60d_mean", label: "60日均换手" },
  { key: "log_money_60d_mean", label: "60日均成交额" },
  { key: "pe_change_250d", label: "PE变化" },
  { key: "ps_change_250d", label: "PS变化" },
  { key: "pb_change_250d", label: "PB变化" },
];

const qualityTrendModel = window.qualityTrendArtifact || null;

const qualityFactorLabels = {
  quality_value_index_weighted_avg_roe: "加权ROE",
  quality_value_index_full_diluted_roe: "摊薄ROE",
  quality_value_sale_gross_margin: "毛利率",
  quality_value_sale_net_interest_ratio: "净利率",
  quality_value_index_per_operating_cash_flow_net: "每股经营现金流",
  quality_value_assets_debt_ratio: "资产负债率",
  quality_value_current_ratio: "流动比率",
  quality_value_quick_ratio: "速动比率",
  quality_value_inventory_turnover_ratio: "存货周转率",
  quality_value_receive_accounts_turnover_days: "应收账款周转天数",
  quality_value_calculate_operating_income_total_yoy_growth_ratio: "营收同比",
  quality_value_calculate_parent_holder_net_profit_yoy_growth_ratio: "归母净利同比",
  quality_value_deduct_net_profit_yoy_growth_ratio: "扣非净利同比",
  quality_single_yoy_operating_income_total: "单季营收同比",
  quality_single_yoy_parent_holder_net_profit: "单季归母净利同比",
  quality_yoy_sale_gross_margin: "毛利率同比",
  quality_yoy_assets_debt_ratio: "资产负债率同比",
  quality_mom_sale_gross_margin: "毛利率环比",
  quality_mom_index_weighted_avg_roe: "ROE环比",
  quality_mom_index_per_operating_cash_flow_net: "经营现金流环比",
  quality_score: "当前财务质量分",
  quality_score_chg4q: "质量分4季变化",
  quality_score_avg4q: "质量分4季均值",
};

const summaryColumns = [
  ["ticker", "标的"],
  ["observations", "样本数"],
  ["mean", "均值"],
  ["median", "中位数"],
  ["std", "标准差"],
  ["downsideRisk", "下行风险"],
  ["min", "最小值"],
  ["max", "最大值"],
  ["skew", "偏度"],
  ["kurtosis", "峰度"],
  ["var5", "VaR 5%"],
  ["cvar5", "CVaR 5%"],
  ["positiveRate", "上涨占比"],
  ["alphaFactor", "Alpha 因子"],
  ["beta", "Beta"],
  ["annualReturn", "年化复利率"],
  ["annualVol", "年化波动"],
  ["sharpe", "Sharpe"],
];

const sampleCsv = `date,ticker,open,high,low,close,volume,turnover,pe,ps,pc,pb
2025-01-02,AAA,100.00,102.30,99.60,101.40,1820000
2025-01-03,AAA,101.40,103.10,100.80,102.20,1750000
2025-01-06,AAA,102.20,102.80,99.90,100.60,2200000
2025-01-07,AAA,100.60,104.20,100.20,103.70,2410000
2025-01-08,AAA,103.70,105.00,102.70,104.10,2010000
2025-01-09,AAA,104.10,104.80,101.60,102.40,2120000
2025-01-10,AAA,102.40,106.40,102.10,105.90,2630000
2025-01-13,AAA,105.90,107.10,104.90,106.30,1930000
2025-01-14,AAA,106.30,107.60,103.20,104.00,2860000
2025-01-15,AAA,104.00,106.80,103.70,106.20,2260000
2025-01-02,BBB,55.00,55.70,53.80,54.20,990000
2025-01-03,BBB,54.20,55.30,53.90,54.90,1120000
2025-01-06,BBB,54.90,56.60,54.60,56.10,1280000
2025-01-07,BBB,56.10,56.40,54.10,54.50,1460000
2025-01-08,BBB,54.50,55.00,52.40,53.10,1620000
2025-01-09,BBB,53.10,54.40,52.80,54.00,1250000
2025-01-10,BBB,54.00,55.20,53.70,54.80,1190000
2025-01-13,BBB,54.80,56.10,54.30,55.70,1330000
2025-01-14,BBB,55.70,55.90,53.20,53.80,1710000
2025-01-15,BBB,53.80,54.70,52.90,54.40,1380000
2025-01-02,CCC,28.00,28.80,27.70,28.50,3210000
2025-01-03,CCC,28.50,29.10,28.10,28.90,3370000
2025-01-06,CCC,28.90,29.70,28.70,29.50,3540000
2025-01-07,CCC,29.50,30.20,29.10,29.30,3680000
2025-01-08,CCC,29.30,30.60,29.00,30.40,3920000
2025-01-09,CCC,30.40,31.00,30.00,30.80,3810000
2025-01-10,CCC,30.80,31.90,30.60,31.60,4070000
2025-01-13,CCC,31.60,32.10,31.20,31.40,3990000
2025-01-14,CCC,31.40,33.00,31.10,32.70,4410000
2025-01-15,CCC,32.70,33.40,32.20,33.10,4280000
2025-01-02,DDD,210.00,214.50,206.20,208.30,740000
2025-01-03,DDD,208.30,211.40,202.80,204.60,890000
2025-01-06,DDD,204.60,209.10,201.20,207.80,810000
2025-01-07,DDD,207.80,216.90,206.50,215.40,1030000
2025-01-08,DDD,215.40,218.20,209.40,211.10,970000
2025-01-09,DDD,211.10,214.80,204.30,206.20,1120000
2025-01-10,DDD,206.20,213.70,205.50,212.90,1010000
2025-01-13,DDD,212.90,220.60,211.70,219.10,1190000
2025-01-14,DDD,219.10,221.30,212.60,214.00,1250000
2025-01-15,DDD,214.00,217.50,208.90,210.50,1160000`;

const benchmarkSampleCsv = `date,ticker,open,high,low,close,volume
2025-01-02,模拟指数,3350.00,3388.20,3336.40,3376.10,286000000
2025-01-03,模拟指数,3376.10,3401.50,3360.20,3384.80,292000000
2025-01-06,模拟指数,3384.80,3392.70,3348.30,3362.40,318000000
2025-01-07,模拟指数,3362.40,3420.80,3357.10,3408.60,335000000
2025-01-08,模拟指数,3408.60,3427.20,3380.50,3391.20,301000000
2025-01-09,模拟指数,3391.20,3404.10,3346.90,3358.70,326000000
2025-01-10,模拟指数,3358.70,3428.60,3350.40,3416.80,344000000
2025-01-13,模拟指数,3416.80,3450.90,3406.30,3439.20,312000000
2025-01-14,模拟指数,3439.20,3446.70,3378.20,3390.50,351000000
2025-01-15,模拟指数,3390.50,3422.40,3368.90,3404.30,329000000`;

function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim() !== "");
  if (!lines.length) return { headers: [], rows: [] };
  const parsed = lines.map(parseCsvLine);
  const headers = parsed[0].map((h) => h.trim());
  const rows = parsed.slice(1).map((cells) => {
    const row = {};
    headers.forEach((header, index) => {
      row[header] = cells[index] ?? "";
    });
    return row;
  });
  return { headers, rows };
}

function parseCsvLine(line) {
  const cells = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
}

function setColumnOptions() {
  const options = state.headers.map((header) => `<option value="${escapeHtml(header)}">${escapeHtml(header)}</option>`).join("");
  [els.dateCol, els.closeCol, els.tickerCol].forEach((select) => {
    select.innerHTML = `<option value="">无</option>${options}`;
  });
  factorDefs.forEach((factor) => {
    els[factor.el].innerHTML = `<option value="">不使用</option>${options}`;
    els[factor.el].value = guessColumnFrom(state.headers, factor.candidates);
  });
  els.moneyCol.innerHTML = `<option value="">不使用</option>${options}`;
  els.moneyCol.value = guessColumnFrom(state.headers, ["money", "amount", "turnover_value", "成交额"]);
  els.dateCol.value = guessColumn(["date", "datetime", "trade_date", "交易日期", "日期"]);
  els.closeCol.value = guessColumn([
    "adjust_price_f",
    "adj_close",
    "adj close",
    "adjust_price",
    "复权收盘",
    "复权价",
    "close",
    "收盘",
    "收盘价",
  ]);
  els.tickerCol.value = guessColumn(["ticker", "symbol", "code", "股票代码", "证券代码", "标的"]);
}

function setBenchmarkColumnOptions() {
  const options = state.benchmarkHeaders.map((header) => `<option value="${escapeHtml(header)}">${escapeHtml(header)}</option>`).join("");
  [els.benchmarkDateCol, els.benchmarkCloseCol, els.benchmarkTickerCol].forEach((select) => {
    select.innerHTML = `<option value="">无</option>${options}`;
  });
  els.benchmarkDateCol.value = guessColumnFrom(state.benchmarkHeaders, ["date", "datetime", "trade_date", "交易日期", "日期"]);
  els.benchmarkCloseCol.value = guessColumnFrom(state.benchmarkHeaders, [
    "adjust_price_f",
    "adj_close",
    "adj close",
    "adjust_price",
    "复权收盘",
    "复权价",
    "close",
    "value",
    "收盘",
    "收盘价",
    "数值",
  ]);
  els.benchmarkTickerCol.value = guessColumnFrom(state.benchmarkHeaders, ["ticker", "symbol", "code", "index", "name", "股票代码", "证券代码", "指数代码", "名称", "标的"]);
}

function syncDateBounds(resetValues = false) {
  const dateCol = els.dateCol.value;
  if (!state.rows.length || !dateCol) {
    state.dateBounds = { min: "", max: "" };
    [els.startDate, els.endDate].forEach((input) => {
      input.value = "";
      input.min = "";
      input.max = "";
    });
    return;
  }

  const dates = state.rows.map((row) => parseDate(row[dateCol])).filter(Boolean).sort((a, b) => a - b);
  if (!dates.length) return;
  const min = formatDate(dates[0]);
  const max = formatDate(dates[dates.length - 1]);
  state.dateBounds = { min, max };
  [els.startDate, els.endDate].forEach((input) => {
    input.min = min;
    input.max = max;
  });
  if (resetValues || !els.startDate.value || !els.endDate.value) {
    els.startDate.value = min;
    els.endDate.value = max;
  }
}

function guessColumn(candidates) {
  return guessColumnFrom(state.headers, candidates);
}

function guessColumnFrom(headers, candidates) {
  const lowerHeaders = headers.map((header) => header.toLowerCase());
  for (const candidate of candidates) {
    const index = lowerHeaders.indexOf(candidate.toLowerCase());
    if (index >= 0) return headers[index];
  }
  return "";
}

function recompute() {
  const dateCol = els.dateCol.value;
  const closeCol = els.closeCol.value;
  const tickerCol = els.tickerCol.value;
  const startDate = parseDate(els.startDate.value || state.dateBounds.min);
  const endDate = parseDate(els.endDate.value || state.dateBounds.max);
  if (!state.rows.length || !dateCol || !closeCol) {
    if (state.qualityRows.length) {
      renderEmpty();
      state.qualityTrendScores = buildQualityTrendScoresFromFinancialRows(endDate);
      renderQualityTrendModel();
    } else {
      renderEmpty();
    }
    return;
  }

  const groups = new Map();
  const invalidRows = [];
  state.rows.forEach((row, index) => {
    const close = toNumber(row[closeCol]);
    const date = parseDate(row[dateCol]);
    const ticker = tickerCol ? String(row[tickerCol] || "未命名").trim() || "未命名" : "全部数据";
    if (!Number.isFinite(close) || close <= 0 || !date) {
      invalidRows.push(index + 2);
      return;
    }
    if ((startDate && date < startDate) || (endDate && date > endDate)) {
      return;
    }
    if (!groups.has(ticker)) groups.set(ticker, []);
    groups.get(ticker).push({ date, close, ticker, source: row });
  });

  const enrichedRows = [];
  const latestStockRows = [];
  for (const [ticker, records] of groups.entries()) {
    records.sort((a, b) => a.date - b.date);
    for (let i = 1; i < records.length; i += 1) {
      const previous = records[i - 1].close;
      const current = records[i].close;
      const ret = state.returnType === "log" ? Math.log(current / previous) : current / previous - 1;
      if (Number.isFinite(ret)) {
        enrichedRows.push({ ticker, date: records[i].date, return: ret });
      }
    }
    if (records.length) {
      const latest = records[records.length - 1];
      latestStockRows.push({ ticker, date: latest.date, source: latest.source, records });
    }
  }

  state.enrichedRows = enrichedRows;
  state.summaries = buildSummaries(enrichedRows, groups);
  state.overallSummary = enrichedRows.length ? summarize("All", enrichedRows.map((row) => row.return), overallPriceSeries(groups)) : null;
  state.longTermScores = buildLongTermScores(latestStockRows);
  state.qualityTrendScores = state.qualityRows.length ? buildQualityTrendScoresFromFinancialRows(endDate) : buildQualityTrendScores(latestStockRows);
  state.pairSsdResults = buildPairSsdResults(groups);
  applyMarketAlphaBetaToSummaries(enrichedRows);
  const externalBenchmarkRows = buildExternalBenchmarkReturns(startDate, endDate);
  updateBenchmarkOptions(uniqueTickers(externalBenchmarkRows));
  state.benchmarkStats = externalBenchmarkRows.length
    ? buildBenchmarkStats(enrichedRows, externalBenchmarkRows, els.benchmarkTicker.value)
    : [];
  renderAll(invalidRows, groups);
}

function buildSummaries(rows, groups) {
  const byTicker = new Map();
  rows.forEach((row) => {
    if (!byTicker.has(row.ticker)) byTicker.set(row.ticker, []);
    byTicker.get(row.ticker).push(row.return);
  });

  const summaries = [...byTicker.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ticker, returns]) => summarize(ticker, returns, groups.get(ticker)));

  return summaries;
}

function summarize(ticker, values, priceRecords = null) {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const mean = average(sorted);
  const variance = n > 1 ? sorted.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (n - 1) : 0;
  const std = Math.sqrt(variance);
  const tradingDays = Number(els.tradingDays.value) || 252;
  const var5 = percentile(sorted, 0.05);
  const cvarValues = sorted.filter((value) => value <= var5);
  const downsideRisk = Math.sqrt(average(sorted.map((value) => Math.min(value, 0) ** 2)));
  const positiveRate = n ? sorted.filter((value) => value > 0).length / n : 0;
  const annualReturn = annualizedCompoundReturn(values, priceRecords, tradingDays);
  const annualVol = std * Math.sqrt(tradingDays);
  const annualRiskFreeRate = (Number(els.riskFreeRate.value) || 0) / 100;
  const dailyRiskFreeRate = annualRiskFreeRate / tradingDays;
  const sharpe = std ? ((mean - dailyRiskFreeRate) / std) * Math.sqrt(tradingDays) : 0;
  return {
    ticker,
    observations: n,
    mean,
    median: percentile(sorted, 0.5),
    std,
    downsideRisk,
    min: sorted[0],
    max: sorted[n - 1],
    skew: moment(sorted, mean, std, 3),
    kurtosis: moment(sorted, mean, std, 4) - 3,
    var5,
    cvar5: average(cvarValues),
    positiveRate,
    annualReturn,
    annualVol,
    sharpe,
  };
}

function annualizedCompoundReturn(values, priceRecords, tradingDays) {
  const periods = values.length;
  if (!periods) return 0;
  let cumulativeReturn = null;
  if (priceRecords && priceRecords.length >= 2) {
    const first = priceRecords[0].close;
    const last = priceRecords[priceRecords.length - 1].close;
    if (first > 0 && last > 0) cumulativeReturn = last / first - 1;
  }
  if (cumulativeReturn === null) {
    const growth = state.returnType === "log"
      ? Math.exp(values.reduce((sum, value) => sum + value, 0))
      : values.reduce((product, value) => product * (1 + value), 1);
    cumulativeReturn = growth - 1;
  }
  if (!Number.isFinite(cumulativeReturn) || cumulativeReturn <= -1) return 0;
  return (1 + cumulativeReturn) ** (tradingDays / periods) - 1;
}

function overallPriceSeries(groups) {
  const all = [];
  groups.forEach((records) => {
    all.push(...records);
  });
  return all.sort((a, b) => a.date - b.date);
}

function moment(values, mean, std, power) {
  if (!values.length || !std) return 0;
  return average(values.map((value) => ((value - mean) / std) ** power));
}

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

function average(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function buildLongTermScores(latestRows) {
  return latestRows
    .map((row) => {
      const input = extractLongTermInput(row.records);
      if (!input.ok) {
        return { ticker: row.ticker, date: row.date, usable: false, reason: input.reason };
      }
      const growth = scoreFactorModel(longTermModel, longTermFactorDefs, input.values);
      const recovery = scoreFactorModel(recoveryModel, recoveryFactorDefs, input.values);
      const performance = buildHistoricalPerformance(row.records);
      const signalScore = Math.max(growth.score, recovery.score);
      const baseCompositeScore = performance ? 0.6 * signalScore + 0.4 * performance.score : signalScore;
      const compositeScore = adjustCompositeScore(baseCompositeScore, Math.max(growth.score, recovery.score), performance);
      const result = {
        ticker: row.ticker,
        date: row.date,
        usable: true,
        predictedReturn: growth.predictedReturn,
        factorScore: growth.score,
        growth,
        recovery,
        performance,
        compositeScore,
        rating: referenceRatingFromScore(compositeScore),
        diagnosis: diagnoseDualModel(growth.score, recovery.score, performance, compositeScore),
        topContributions: growth.topContributions,
      };
      result.explanation = buildLongTermExplanation(result);
      return result;
    })
    .sort((a, b) => {
      if (a.usable && b.usable) return b.compositeScore - a.compositeScore;
      if (a.usable) return -1;
      if (b.usable) return 1;
      return a.ticker.localeCompare(b.ticker);
    });
}

function buildQualityTrendScores(latestRows) {
  if (!qualityTrendModel) return [];
  return latestRows
    .map((row) => {
      const input = extractQualityTrendInput(row.records);
      if (!input.ok) {
        return { ticker: row.ticker, date: row.date, usable: false, reason: input.reason };
      }
      const prediction = scoreQualityTrendModel(input.values);
      return {
        ticker: row.ticker,
        date: input.latest.pubDate || input.latest.statDate || row.date,
        usable: true,
        currentQualityScore: input.currentQualityScore,
        predictedTrend: prediction.predictedTrend,
        predictedFutureQualityScore: input.currentQualityScore + prediction.predictedTrend,
        signalScore: scoreRange(prediction.predictedTrend, -20, 30),
        rating: qualityTrendRating(prediction.predictedTrend),
        topContributions: prediction.topContributions,
        explanation: buildQualityTrendExplanation(input.currentQualityScore, prediction),
      };
    })
    .sort((a, b) => {
      if (a.usable && b.usable) return b.predictedTrend - a.predictedTrend;
      if (a.usable) return -1;
      if (b.usable) return 1;
      return a.ticker.localeCompare(b.ticker);
    });
}

function buildQualityTrendScoresFromFinancialRows(endDate = null) {
  if (!qualityTrendModel || !state.qualityRows.length) return [];
  const codeCol = guessColumnFrom(state.qualityHeaders, ["code", "ticker", "symbol", "股票代码", "证券代码", "标的"]);
  const statCol = guessColumnFrom(state.qualityHeaders, ["statDate", "report_date", "reportDate", "报告期", "报告日期"]);
  const pubCol = guessColumnFrom(state.qualityHeaders, ["pubDate", "publish_date", "公告日期", "披露日期", "report_date"]);
  if (!codeCol || !statCol) {
    return [{ ticker: "财务数据", date: new Date(), usable: false, reason: "财务 CSV 需要 code 和 statDate/report_date 列" }];
  }

  const groups = new Map();
  state.qualityRows.forEach((row) => {
    const ticker = String(row[codeCol] || "").trim();
    const statDate = parseDate(row[statCol]);
    const pubDate = pubCol ? parseDate(row[pubCol]) : statDate;
    if (!ticker || !statDate) return;
    if (endDate && pubDate && pubDate > endDate) return;
    if (!groups.has(ticker)) groups.set(ticker, []);
    groups.get(ticker).push({ source: normalizeFinancialSource(row, statCol, pubCol), date: pubDate || statDate });
  });

  return [...groups.entries()]
    .map(([ticker, records]) => {
      const input = extractQualityTrendInput(records);
      if (!input.ok) return { ticker, date: records[records.length - 1]?.date || new Date(), usable: false, reason: input.reason };
      const prediction = scoreQualityTrendModel(input.values);
      return {
        ticker,
        date: input.latest.pubDate || input.latest.statDate || records[records.length - 1]?.date,
        usable: true,
        currentQualityScore: input.currentQualityScore,
        predictedTrend: prediction.predictedTrend,
        predictedFutureQualityScore: input.currentQualityScore + prediction.predictedTrend,
        signalScore: scoreRange(prediction.predictedTrend, -20, 30),
        rating: qualityTrendRating(prediction.predictedTrend),
        topContributions: prediction.topContributions,
        explanation: buildQualityTrendExplanation(input.currentQualityScore, prediction),
      };
    })
    .sort((a, b) => {
      if (a.usable && b.usable) return b.predictedTrend - a.predictedTrend;
      if (a.usable) return -1;
      if (b.usable) return 1;
      return a.ticker.localeCompare(b.ticker);
    });
}

function normalizeFinancialSource(row, statCol, pubCol) {
  const source = { ...row };
  source.statDate = row.statDate || row[statCol];
  source.pubDate = row.pubDate || (pubCol ? row[pubCol] : row[statCol]);
  return source;
}

function extractQualityTrendInput(records = []) {
  const required = Object.keys(qualityTrendModel.scoreSpecs || {});
  const sourceHeaders = records.length ? Object.keys(records[0].source || {}) : state.headers;
  const hasRequired = required.some((key) => sourceHeaders.includes(key));
  if (!hasRequired) return { ok: false, reason: "缺少财务质量因子列" };
  const quarterly = buildQuarterlyQualityRows(records);
  if (quarterly.length < 5) return { ok: false, reason: "至少需要 5 个季度财务数据" };

  quarterly.forEach((row, index) => {
    row.quality_score = computeQualityScore(row);
    if (index >= 4) row.quality_score_chg4q = row.quality_score - quarterly[index - 4].quality_score;
    const last4 = quarterly.slice(Math.max(0, index - 3), index + 1).map((item) => item.quality_score).filter(Number.isFinite);
    row.quality_score_avg4q = averageFinite(last4);
  });

  const latest = quarterly[quarterly.length - 1];
  const previous4 = quarterly[quarterly.length - 5];
  const values = {};
  for (const feature of qualityTrendModel.features || []) {
    if (feature.endsWith("_chg4q")) {
      const base = feature.replace(/_chg4q$/, "");
      values[feature] = toFiniteNumber(latest[base]) - toFiniteNumber(previous4[base]);
    } else if (feature.endsWith("_avg4q")) {
      const base = feature.replace(/_avg4q$/, "");
      values[feature] = averageFinite(quarterly.slice(-4).map((item) => toFiniteNumber(item[base])));
    } else {
      values[feature] = toFiniteNumber(latest[feature]);
    }
  }
  const missing = (qualityTrendModel.features || []).filter((feature) => !Number.isFinite(values[feature]));
  if (missing.length) return { ok: false, reason: `缺少${qualityFactorLabel(missing[0])}` };
  if (!Number.isFinite(latest.quality_score)) return { ok: false, reason: "财务质量分无法计算" };
  return { ok: true, values, latest, currentQualityScore: latest.quality_score };
}

function buildQuarterlyQualityRows(records) {
  const byQuarter = new Map();
  records.forEach((record) => {
    const source = record.source || {};
    const statDate = parseDate(source.statDate || source.report_type || source.report_date);
    const pubDate = parseDate(source.pubDate || source.report_date || source.statDate);
    if (!statDate) return;
    const key = formatDate(statDate);
    const row = byQuarter.get(key) || { statDate, pubDate };
    Object.keys(source).forEach((column) => {
      if (column.startsWith("quality_")) row[column] = toNumber(source[column]);
    });
    row.pubDate = pubDate || row.pubDate;
    byQuarter.set(key, row);
  });
  return [...byQuarter.values()].sort((a, b) => a.statDate - b.statDate);
}

function computeQualityScore(row) {
  const parts = [];
  Object.entries(qualityTrendModel.scoreSpecs || {}).forEach(([feature, direction]) => {
    const stats = qualityTrendModel.featureStats?.[feature];
    const value = toFiniteNumber(row[feature]);
    if (!stats || !Number.isFinite(value) || !stats.std) return;
    const z = ((value - stats.mean) / stats.std) * direction;
    parts.push(normalCdf(z) * 100);
  });
  return parts.length ? average(parts) : NaN;
}

function scoreQualityTrendModel(values) {
  let predictedTrend = qualityTrendModel.intercept || 0;
  const contributions = [];
  Object.entries(qualityTrendModel.coefficients || {}).forEach(([feature, coefficient]) => {
    const stats = qualityTrendModel.featureStats?.[feature];
    const value = values[feature];
    if (!stats || !Number.isFinite(value) || !stats.std) return;
    const z = clamp((value - stats.mean) / stats.std, -5, 5);
    const contribution = z * coefficient;
    predictedTrend += contribution;
    contributions.push({ key: feature, label: qualityFactorLabel(feature), z, contribution });
  });
  return {
    predictedTrend,
    topContributions: contributions.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution)).slice(0, 4),
  };
}

function buildQualityTrendExplanation(currentScore, prediction) {
  const direction =
    prediction.predictedTrend >= 10 ? "未来 4 个季度财务质量有明显改善倾向" : prediction.predictedTrend >= 3 ? "未来 4 个季度财务质量有改善倾向" : prediction.predictedTrend <= -10 ? "未来 4 个季度财务质量有走弱风险" : "未来 4 个季度财务质量大致稳定";
  const factors = prediction.topContributions
    .map((part) => `${part.label}${part.contribution >= 0 ? "+" : ""}${formatNumber(part.contribution, 1)}`)
    .join("；");
  return `当前质量分${formatNumber(currentScore, 1)}，预测改善${formatNumber(prediction.predictedTrend, 1)}分：${direction}。主要驱动：${factors || "--"}。`;
}

function qualityTrendRating(trend) {
  if (trend >= 10) return "明显改善";
  if (trend >= 3) return "改善";
  if (trend > -3) return "稳定";
  if (trend > -10) return "走弱";
  return "明显走弱";
}

function qualityFactorLabel(feature) {
  const base = feature.replace(/_chg4q$|_avg4q$/g, "");
  const suffix = feature.endsWith("_chg4q") ? "4季变化" : feature.endsWith("_avg4q") ? "4季均值" : "";
  return `${qualityFactorLabels[base] || base}${suffix}`;
}

function scoreFactorModel(model, factorDefs, values) {
  const contributions = {};
  let predictedReturn = model.coefficients.intercept;
  factorDefs.forEach((factor) => {
    const stats = model.featureStats[factor.key];
    const zRaw = stats?.std ? (values[factor.key] - stats.mean) / stats.std : 0;
    const z = clamp(zRaw, -model.zcap, model.zcap);
    const contribution = z * model.coefficients[factor.key];
    contributions[factor.key] = { key: factor.key, label: factor.label, z, contribution };
    predictedReturn += contribution;
  });
  const score = percentileFromQuantiles(predictedReturn, model.predictionQuantiles) * 100;
  return {
    predictedReturn,
    score,
    rating: ratingFromScore(score),
    topContributions: Object.values(contributions)
      .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
      .slice(0, 3),
  };
}

function buildHistoricalPerformance(records = []) {
  const clean = records.filter((row) => Number.isFinite(row.close) && row.close > 0).sort((a, b) => a.date - b.date);
  if (clean.length < 20) return null;
  const returns = [];
  for (let i = 1; i < clean.length; i += 1) {
    returns.push(clean[i].close / clean[i - 1].close - 1);
  }
  const tradingDays = Number(els.tradingDays.value) || 252;
  const first = clean[0].close;
  const latest = clean[clean.length - 1].close;
  const totalReturn = latest / first - 1;
  const annualReturn = annualizePeriodReturn(totalReturn, clean.length - 1, tradingDays);
  const vol = Math.sqrt(variance(returns)) * Math.sqrt(tradingDays);
  const mean = average(returns);
  const sharpe = vol ? (mean * tradingDays) / vol : 0;
  const drawdown = maxDrawdown(clean.map((row) => row.close));
  const positiveRate = returns.filter((value) => value > 0).length / returns.length;
  const maWindow = Math.min(250, clean.length);
  const movingAverage = average(clean.slice(-maWindow).map((row) => row.close));
  const trend = movingAverage ? latest / movingAverage - 1 : 0;
  const rawScore =
    0.32 * scoreRange(annualReturn, -0.2, 1.0) +
    0.24 * scoreRange(sharpe, -0.5, 2.5) +
    0.22 * (100 - scoreRange(drawdown, 0.05, 0.65)) +
    0.12 * scoreRange(positiveRate, 0.42, 0.58) +
    0.1 * scoreRange(trend, -0.2, 0.35);
  const coverage = clamp(returns.length / tradingDays, 0, 1);
  const score = rawScore * coverage + 50 * (1 - coverage);
  return { score, totalReturn, annualReturn, vol, sharpe, drawdown, positiveRate, trend, observations: returns.length };
}

function adjustCompositeScore(baseScore, factorScore, performance) {
  if (!performance) return baseScore;
  let adjusted = baseScore;
  if (performance.annualReturn >= 0.5 && performance.trend >= 0.2 && performance.sharpe >= 0.8) {
    adjusted = Math.max(adjusted, 55);
  }
  if (performance.annualReturn >= 0.8 && performance.trend >= 0.25 && performance.sharpe >= 1.1 && performance.drawdown <= 0.5) {
    adjusted = Math.max(adjusted, 70);
  }
  if (factorScore < 20 && performance.drawdown >= 0.6) {
    adjusted = Math.min(adjusted, 62);
  }
  return clamp(adjusted, 0, 100);
}

function annualizePeriodReturn(totalReturn, periods, tradingDays) {
  if (!Number.isFinite(totalReturn) || periods <= 0 || totalReturn <= -1) return 0;
  return (1 + totalReturn) ** (tradingDays / periods) - 1;
}

function maxDrawdown(values) {
  let peak = values[0] || 0;
  let maxDd = 0;
  values.forEach((value) => {
    peak = Math.max(peak, value);
    if (peak > 0) maxDd = Math.max(maxDd, 1 - value / peak);
  });
  return maxDd;
}

function scoreRange(value, low, high) {
  if (!Number.isFinite(value)) return 50;
  return clamp(((value - low) / (high - low)) * 100, 0, 100);
}

function diagnoseDualModel(growthScore, recoveryScore, performance, compositeScore) {
  if (growthScore >= 60 && recoveryScore >= 60) return "成长与修复信号同时较好，参考价值较高";
  if (growthScore >= 60 && recoveryScore < 40) return "成长趋势有参考价值，修复性价比一般";
  if (growthScore < 40 && recoveryScore >= 60) return "修复信号有参考价值，趋势仍待确认";
  if (performance && performance.score >= 70 && growthScore < 40) return "历史趋势较强，但模型因子仍谨慎";
  if (compositeScore >= 60) return "长期条件较好，可继续研究";
  if (compositeScore >= 40) return "长期条件一般，适合观察";
  return "当前参考价值有限";
}

function buildLongTermExplanation(item) {
  const parts = [];
  parts.push(`综合${formatNumber(item.compositeScore, 1)}，${item.rating}：${item.diagnosis}。`);
  if (item.performance) {
    parts.push(
      `历史表现分${formatNumber(item.performance.score, 1)}，年化复利率${formatPercent(item.performance.annualReturn)}，最大回撤${formatPercent(item.performance.drawdown)}。`,
    );
  }
  parts.push(`成长趋势分${formatNumber(item.growth.score, 1)}，成长收益代理${formatPercent(item.growth.predictedReturn)}。`);
  parts.push(`低估修复分${formatNumber(item.recovery.score, 1)}，修复收益代理${formatPercent(item.recovery.predictedReturn)}。`);
  const growthNotes = item.growth.topContributions.map((part) => explainContribution(part, "growth")).filter(Boolean);
  const recoveryNotes = item.recovery.topContributions.map((part) => explainContribution(part, "recovery")).filter(Boolean);
  if (growthNotes.length) parts.push(`成长解释：${growthNotes.join("；")}。`);
  if (recoveryNotes.length) parts.push(`修复解释：${recoveryNotes.join("；")}。`);
  return parts.join(" ");
}

function explainContribution(part, modelType = "growth") {
  const direction = part.contribution >= 0 ? "加分" : "扣分";
  const valueText = `${part.contribution >= 0 ? "+" : ""}${formatPercent(part.contribution)}`;
  const reason = contributionReason(part, modelType);
  return `${part.label}${valueText}，${reason}，${direction}`;
}

function contributionReason(part, modelType = "growth") {
  const high = part.z > 0;
  const absZ = Math.abs(part.z);
  const intensity = absZ >= 2 ? "显著" : absZ >= 1 ? "偏" : "略";
  const map = {
    log_money: high ? `${intensity}高成交，热度/拥挤度较高` : `${intensity}低成交，交易热度较低`,
    log_money_60d_mean: high ? `${intensity}高成交，资金关注度和拥挤度较高` : `${intensity}低成交，资金热度较低`,
    ma_gap_250d: high ? `股价${intensity}高于250日均线，涨幅可能已透支` : `股价${intensity}低于250日均线，趋势偏弱或回撤中`,
    ma_gap_60d: high ? `股价${intensity}高于60日均线，短期修复较明显` : `股价${intensity}低于60日均线，短期趋势尚未修复`,
    ma_gap_120d: high ? `股价${intensity}高于120日均线，中期修复较明显` : `股价${intensity}低于120日均线，中期趋势尚未修复`,
    drawdown_250d: high ? `距离250日高点回撤${intensity}大` : `距离250日高点回撤较小，趋势未明显破坏`,
    low_rebound_60d: high ? `较60日低点已有${intensity}明显反弹，企稳修复迹象较强` : `较60日低点反弹有限，企稳信号不足`,
    vol_ratio_60_250: high ? `近期波动高于长期波动，仍不稳定` : `近期波动低于长期波动，波动有收缩迹象`,
    mom_20d: high ? `近20日动量${intensity}强` : `近20日动量${intensity}弱`,
    mom_60d: high ? `近60日动量${intensity}强` : `近60日动量${intensity}弱`,
    mom_120d: high ? `近120日动量${intensity}强` : `近120日动量${intensity}弱`,
    mom_250d: high ? `近250日动量${intensity}强` : `近250日动量${intensity}弱`,
    vol_60d: high ? `近60日波动${intensity}高` : `近60日波动${intensity}低`,
    turnover: high ? `当日换手${intensity}高，短期交易较热` : `当日换手${intensity}低，交易不拥挤`,
    turnover_60d_mean: high ? `60日平均换手${intensity}高` : modelType === "recovery" ? `60日平均换手${intensity}低，市场关注度仍低` : `60日平均换手${intensity}低`,
    turnover_change_20_120: high ? `近期换手相对长期换手上升` : `近期换手相对长期换手下降`,
    PE_TTM: high ? `PE相对市场${intensity}高，估值压力较大` : `PE相对市场${intensity}低`,
    PS_TTM: high ? `PS相对市场${intensity}高，收入估值较贵` : `PS相对市场${intensity}低`,
    PC_TTM: high ? `PC相对市场${intensity}高` : `PC相对市场${intensity}低`,
    PB: high ? `PB相对市场${intensity}高，账面估值较贵` : `PB相对市场${intensity}低`,
    pe_change_250d: high ? `PE较一年前上升，估值扩张` : `PE较一年前下降，估值收缩`,
    ps_change_250d: high ? `PS较一年前上升，估值扩张` : `PS较一年前下降，估值收缩`,
    pb_change_250d: high ? `PB较一年前上升` : `PB较一年前下降`,
  };
  return map[part.key] || (high ? "该因子高于市场均值" : "该因子低于市场均值");
}

function extractLongTermInput(records = []) {
  const clean = records.filter((row) => Number.isFinite(row.close) && row.close > 0).sort((a, b) => a.date - b.date);
  if (clean.length < 251) return { ok: false, reason: "成长模型至少需要 251 个交易日" };
  const latest = clean[clean.length - 1];
  const values = {};
  for (const factor of longTermFactorDefs) {
    if (factor.transform === "derived") continue;
    const column = els[factor.columnEl].value;
    if (!column) return { ok: false, reason: `缺少${factor.label}列` };
    const raw = toNumber(latest.source[column]);
    if (!Number.isFinite(raw)) return { ok: false, reason: `${factor.label}不是有效数字` };
    if (["PE_TTM", "PS_TTM", "PC_TTM", "PB"].includes(factor.key) && raw <= 0) {
      return { ok: false, reason: `${factor.label}需为正值` };
    }
    if (factor.transform === "log1p") {
      if (raw <= 0) return { ok: false, reason: `${factor.label}需为正值` };
      values[factor.key] = Math.log1p(raw);
    } else {
      values[factor.key] = raw;
    }
  }
  const derived = buildGrowthDerivedFeatures(clean);
  for (const [key, value] of Object.entries(derived)) {
    if (!Number.isFinite(value)) return { ok: false, reason: `${growthFeatureLabel(key)}不足或无效` };
    values[key] = value;
  }
  return { ok: true, values };
}

function buildGrowthDerivedFeatures(records) {
  const closes = records.map((row) => row.close);
  const latestClose = closes[closes.length - 1];
  const returns = [];
  for (let i = 1; i < closes.length; i += 1) {
    returns.push(closes[i] / closes[i - 1] - 1);
  }
  const latest = records[records.length - 1].source;
  const values = {
    mom_20d: periodReturn(closes, 20),
    mom_60d: periodReturn(closes, 60),
    mom_120d: periodReturn(closes, 120),
    mom_250d: periodReturn(closes, 250),
    vol_60d: Math.sqrt(variance(returns.slice(-60))) * Math.sqrt(Number(els.tradingDays.value) || 252),
    vol_ratio_60_250: Math.sqrt(variance(returns.slice(-60))) / Math.sqrt(variance(returns.slice(-250))) - 1,
    drawdown_250d: latestClose ? 1 - latestClose / Math.max(...closes.slice(-250)) : NaN,
    low_rebound_60d: latestClose ? latestClose / Math.min(...closes.slice(-60)) - 1 : NaN,
    ma_gap_60d: latestClose / average(closes.slice(-60)) - 1,
    ma_gap_120d: latestClose / average(closes.slice(-120)) - 1,
    ma_gap_250d: latestClose / average(closes.slice(-250)) - 1,
  };

  const turnoverValues = records.map((row) => toNumber(row.source[els.turnoverCol.value]));
  values.turnover_60d_mean = averageFinite(turnoverValues.slice(-60));
  values.turnover_change_20_120 = averageFinite(turnoverValues.slice(-20)) / averageFinite(turnoverValues.slice(-120)) - 1;

  const moneyValues = records.map((row) => toNumber(row.source[els.moneyCol.value]));
  const money60 = averageFinite(moneyValues.slice(-60));
  values.log_money_60d_mean = money60 > 0 ? Math.log1p(money60) : NaN;

  values.pe_change_250d = ratioChangeFromColumn(records, els.peCol.value, 250);
  values.ps_change_250d = ratioChangeFromColumn(records, els.psCol.value, 250);
  values.pb_change_250d = ratioChangeFromColumn(records, els.pbCol.value, 250);
  return values;
}

function periodReturn(values, days) {
  if (values.length <= days) return NaN;
  const previous = values[values.length - 1 - days];
  const latest = values[values.length - 1];
  return previous > 0 ? latest / previous - 1 : NaN;
}

function averageFinite(values) {
  const clean = values.filter(Number.isFinite);
  return clean.length ? average(clean) : NaN;
}

function ratioChangeFromColumn(records, column, days) {
  if (!column || records.length <= days) return NaN;
  const current = toNumber(records[records.length - 1].source[column]);
  const previous = toNumber(records[records.length - 1 - days].source[column]);
  return current > 0 && previous > 0 ? current / previous - 1 : NaN;
}

function growthFeatureLabel(key) {
  const match = longTermFactorDefs.find((factor) => factor.key === key);
  return match ? match.label : key;
}

function percentileFromQuantiles(value, quantiles) {
  if (!Number.isFinite(value)) return 0;
  if (value <= quantiles[0][1]) return 0;
  const last = quantiles[quantiles.length - 1];
  if (value >= last[1]) return 1;
  for (let i = 1; i < quantiles.length; i += 1) {
    const [q1, v1] = quantiles[i - 1];
    const [q2, v2] = quantiles[i];
    if (value <= v2) {
      const weight = v2 === v1 ? 0 : (value - v1) / (v2 - v1);
      return q1 + (q2 - q1) * clamp(weight, 0, 1);
    }
  }
  return 1;
}

function ratingFromScore(score) {
  if (score >= 80) return "强";
  if (score >= 60) return "偏强";
  if (score >= 40) return "中性";
  if (score >= 20) return "偏弱";
  return "弱";
}

function referenceRatingFromScore(score) {
  if (score >= 80) return "高参考价值";
  if (score >= 60) return "较高参考价值";
  if (score >= 40) return "观察价值";
  if (score >= 20) return "谨慎观察";
  return "参考价值有限";
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function toFiniteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : NaN;
}

function normalCdf(value) {
  return 0.5 * (1 + erf(value / Math.SQRT2));
}

function erf(value) {
  const sign = value >= 0 ? 1 : -1;
  const x = Math.abs(value);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t) * Math.exp(-x * x);
  return sign * y;
}

function uniqueTickers(rows) {
  return [...new Set(rows.map((row) => row.ticker))];
}

function buildExternalBenchmarkReturns(startDate, endDate) {
  if (!state.benchmarkRows.length || !els.benchmarkDateCol.value || !els.benchmarkCloseCol.value) return [];
  const groups = new Map();
  const dateCol = els.benchmarkDateCol.value;
  const closeCol = els.benchmarkCloseCol.value;
  const tickerCol = els.benchmarkTickerCol.value;
  state.benchmarkRows.forEach((row) => {
    const close = toNumber(row[closeCol]);
    const date = parseDate(row[dateCol]);
    if (!Number.isFinite(close) || close <= 0 || !date) return;
    if ((startDate && date < startDate) || (endDate && date > endDate)) return;
    const ticker = tickerCol ? String(row[tickerCol] || "对照数据").trim() || "对照数据" : benchmarkFallbackName();
    if (!groups.has(ticker)) groups.set(ticker, []);
    groups.get(ticker).push({ date, close, ticker });
  });

  const returns = [];
  for (const [ticker, records] of groups.entries()) {
    records.sort((a, b) => a.date - b.date);
    for (let i = 1; i < records.length; i += 1) {
      const previous = records[i - 1].close;
      const current = records[i].close;
      const ret = state.returnType === "log" ? Math.log(current / previous) : current / previous - 1;
      if (Number.isFinite(ret)) returns.push({ ticker, date: records[i].date, return: ret });
    }
  }
  return returns;
}

function buildPairSsdResults(groups) {
  const pool = window.pairTradingPool;
  if (!pool?.dates?.length || !pool?.series?.length || !groups.size) return [];
  const minOverlap = clamp(Number(els.pairMinOverlap.value) || 120, 20, pool.dates.length);
  const topCount = clamp(Number(els.pairTopCount.value) || 10, 1, 50);
  const dateToIndex = new Map(pool.dates.map((date, index) => [date, index]));
  const results = [];

  for (const [targetTicker, records] of groups.entries()) {
    const targetByIndex = new Map();
    records
      .filter((record) => Number.isFinite(record.close) && record.close > 0)
      .sort((a, b) => a.date - b.date)
      .forEach((record) => {
        const index = dateToIndex.get(formatDate(record.date));
        if (index !== undefined) targetByIndex.set(index, record.close);
      });

    if (targetByIndex.size < minOverlap) {
      results.push({
        targetTicker,
        usable: false,
        reason: `重叠交易日少于 ${minOverlap} 天`,
        rows: [],
      });
      continue;
    }

    const ranking = pool.series
      .map((candidate) => scorePairDistance(targetByIndex, candidate, minOverlap, targetTicker))
      .filter(Boolean)
      .sort((a, b) => b.ssd - a.ssd)
      .slice(0, topCount);

    results.push({
      targetTicker,
      usable: ranking.length > 0,
      reason: ranking.length ? "" : `股票池中没有满足 ${minOverlap} 个重叠交易日的标的`,
      rows: ranking,
    });
  }

  return results;
}

function scorePairDistance(targetByIndex, candidate, minOverlap, targetTicker) {
  if (candidate.code === targetTicker) return null;
  const candidatePrices = candidate.p || [];
  const aligned = [];
  for (const [index, targetPrice] of targetByIndex.entries()) {
    const candidatePrice = candidatePrices[index];
    if (Number.isFinite(candidatePrice) && candidatePrice > 0) {
      aligned.push({ index, targetPrice, candidatePrice });
    }
  }
  if (aligned.length < minOverlap) return null;
  aligned.sort((a, b) => a.index - b.index);
  const targetBase = aligned[0].targetPrice;
  const candidateBase = aligned[0].candidatePrice;
  if (targetBase <= 0 || candidateBase <= 0) return null;

  let ssd = 0;
  for (const point of aligned) {
    const diff = point.targetPrice / targetBase - point.candidatePrice / candidateBase;
    ssd += diff * diff;
  }
  return {
    code: candidate.code,
    name: candidate.name || "",
    ssd,
    overlap: aligned.length,
    startDate: window.pairTradingPool.dates[aligned[0].index],
    endDate: window.pairTradingPool.dates[aligned[aligned.length - 1].index],
    targetEndNorm: aligned[aligned.length - 1].targetPrice / targetBase,
    candidateEndNorm: aligned[aligned.length - 1].candidatePrice / candidateBase,
  };
}

function loadMarketText(text) {
  const parsed = parseCsv(text);
  const dateCol = guessColumnFrom(parsed.headers, ["date", "datetime", "trade_date", "交易日期", "日期"]);
  const closeCol = guessColumnFrom(parsed.headers, ["adjust_price_f", "adj_close", "adj close", "adjust_price", "复权收盘", "复权价", "close", "收盘", "收盘价"]);
  const tickerCol = guessColumnFrom(parsed.headers, ["ticker", "symbol", "code", "index", "name", "股票代码", "证券代码", "指数代码", "名称", "标的"]);
  if (!dateCol || !closeCol) {
    state.marketRows = [];
    return;
  }
  state.marketRows = buildReturnsFromRows(parsed.rows, dateCol, closeCol, tickerCol, "上证指数");
}

function buildReturnsFromRows(rows, dateCol, closeCol, tickerCol = "", fallbackTicker = "对照数据", startDate = null, endDate = null) {
  const groups = new Map();
  rows.forEach((row) => {
    const close = toNumber(row[closeCol]);
    const date = parseDate(row[dateCol]);
    if (!Number.isFinite(close) || close <= 0 || !date) return;
    if ((startDate && date < startDate) || (endDate && date > endDate)) return;
    const ticker = tickerCol ? String(row[tickerCol] || fallbackTicker).trim() || fallbackTicker : fallbackTicker;
    if (!groups.has(ticker)) groups.set(ticker, []);
    groups.get(ticker).push({ date, close, ticker });
  });

  const returns = [];
  for (const [ticker, records] of groups.entries()) {
    records.sort((a, b) => a.date - b.date);
    for (let i = 1; i < records.length; i += 1) {
      const previous = records[i - 1].close;
      const current = records[i].close;
      const ret = state.returnType === "log" ? Math.log(current / previous) : current / previous - 1;
      if (Number.isFinite(ret)) returns.push({ ticker, date: records[i].date, return: ret });
    }
  }
  return returns;
}

function benchmarkFallbackName() {
  return (els.benchmarkFileName.textContent || "对照数据").replace(/\.csv$/i, "").trim() || "对照数据";
}

function updateBenchmarkOptions(tickers) {
  const sorted = [...tickers].sort((a, b) => a.localeCompare(b));
  const current = els.benchmarkTicker.value;
  if (!sorted.length) {
    els.benchmarkTicker.innerHTML = "";
    els.benchmarkTicker.value = "";
    return;
  }
  els.benchmarkTicker.innerHTML = sorted.map((ticker) => `<option value="${escapeHtml(ticker)}">${escapeHtml(ticker)}</option>`).join("");
  if (sorted.includes(current)) {
    els.benchmarkTicker.value = current;
    return;
  }
  els.benchmarkTicker.value = guessBenchmarkTicker(sorted);
}

function guessBenchmarkTicker(tickers) {
  const preferred = [
    "上证指数",
    "上证综指",
    "沪指",
    "SH000001",
    "sh000001",
    "000001.SH",
    "000001.sh",
    "SSE Composite",
    "Shanghai Composite",
    "SSE",
    "模拟指数",
    "沪深300",
    "中证500",
    "创业板指",
    "000300.SH",
    "CSI300",
  ];
  const normalized = tickers.map((ticker) => [ticker, ticker.toLowerCase()]);
  for (const name of preferred) {
    const match = normalized.find(([, lower]) => lower === name.toLowerCase());
    if (match) return match[0];
  }
  const fuzzy = normalized.find(([ticker]) => ticker.includes("上证") || ticker.includes("沪指") || ticker.includes("指数") || ticker.includes("沪深") || ticker.includes("中证"));
  return fuzzy ? fuzzy[0] : tickers[0] || "";
}

function buildBenchmarkStats(stockRows, benchmarkRows, benchmarkTicker, selectedStockTicker, excludedStockTicker = null) {
  if (!benchmarkTicker) return [];
  const stocksByTicker = new Map();
  stockRows.forEach((row) => {
    if (!stocksByTicker.has(row.ticker)) stocksByTicker.set(row.ticker, new Map());
    stocksByTicker.get(row.ticker).set(formatDate(row.date), row.return);
  });
  const benchmarkByTicker = new Map();
  benchmarkRows.forEach((row) => {
    if (!benchmarkByTicker.has(row.ticker)) benchmarkByTicker.set(row.ticker, new Map());
    benchmarkByTicker.get(row.ticker).set(formatDate(row.date), row.return);
  });

  const benchmarkMap = benchmarkByTicker.get(benchmarkTicker);
  if (!benchmarkMap) return [];
  const stockTickers = selectedStockTicker ? [selectedStockTicker] : [...stocksByTicker.keys()];
  return stockTickers
    .filter((ticker) => stocksByTicker.has(ticker) && ticker !== excludedStockTicker)
    .sort((a, b) => a.localeCompare(b))
    .map((ticker) => {
      const pair = alignReturnMaps(benchmarkMap, stocksByTicker.get(ticker));
      const corr = pair.x.length >= 2 ? correlation(pair.x, pair.y) : null;
      const beta = pair.x.length >= 2 ? covariance(pair.x, pair.y) / variance(pair.x) : null;
      const alpha = Number.isFinite(beta) ? average(pair.y) - beta * average(pair.x) : null;
      const tradingDays = Number(els.tradingDays.value) || 252;
      return {
        ticker,
        benchmark: benchmarkTicker,
        overlap: pair.x.length,
        correlation: corr,
        beta: Number.isFinite(beta) ? beta : null,
        alpha: Number.isFinite(alpha) ? alpha : null,
        rSquared: Number.isFinite(corr) ? corr ** 2 : null,
        model: Number.isFinite(alpha) && Number.isFinite(beta) ? `r = ${formatSignedPercent(alpha)} ${beta >= 0 ? "+" : "-"} ${formatNumber(Math.abs(beta), 3)} x` : "--",
        points: pair.x.map((benchmarkReturn, index) => ({ benchmarkReturn, stockReturn: pair.y[index] })),
      };
    });
}

function applyMarketAlphaBetaToSummaries(stockRows) {
  const marketTicker = guessBenchmarkTicker(uniqueTickers(state.marketRows));
  if (!marketTicker) {
    state.summaries.forEach((summary) => {
      summary.alphaFactor = null;
      summary.beta = null;
    });
    return;
  }
  const stockStats = buildMarketStats(stockRows, state.marketRows, marketTicker);
  const byTicker = new Map(stockStats.map((item) => [item.ticker, item]));
  state.summaries.forEach((summary) => {
    const stat = byTicker.get(summary.ticker);
    summary.alphaFactor = stat?.alphaFactor ?? null;
    summary.beta = stat?.beta ?? null;
  });
}

function buildMarketStats(stockRows, marketRows, marketTicker) {
  if (!marketTicker || !marketRows.length) return [];
  const stocksByTicker = new Map();
  stockRows.forEach((row) => {
    if (!stocksByTicker.has(row.ticker)) stocksByTicker.set(row.ticker, new Map());
    stocksByTicker.get(row.ticker).set(formatDate(row.date), row.return);
  });
  const marketMap = new Map();
  marketRows
    .filter((row) => row.ticker === marketTicker)
    .forEach((row) => marketMap.set(formatDate(row.date), row.return));
  if (!marketMap.size) return [];

  const annualRiskFreeRate = (Number(els.riskFreeRate.value) || 0) / 100;
  const tradingDays = Number(els.tradingDays.value) || 252;
  const dailyRiskFreeRate = annualRiskFreeRate / tradingDays;

  return [...stocksByTicker.keys()].map((ticker) => {
    const pair = alignReturnMaps(marketMap, stocksByTicker.get(ticker));
    const marketExcess = pair.x.map((value) => value - dailyRiskFreeRate);
    const stockExcess = pair.y.map((value) => value - dailyRiskFreeRate);
    const beta = pair.x.length >= 2 ? covariance(marketExcess, stockExcess) / variance(marketExcess) : null;
    const alphaFactor = Number.isFinite(beta)
      ? average(stockExcess.map((value, index) => value - beta * marketExcess[index]))
      : null;
    return {
      ticker,
      benchmark: marketTicker,
      beta: Number.isFinite(beta) ? beta : null,
      alphaFactor: Number.isFinite(alphaFactor) ? alphaFactor : null,
    };
  });
}

function alignReturnMaps(mapX, mapY) {
  const x = [];
  const y = [];
  for (const [date, valueX] of mapX.entries()) {
    if (mapY.has(date)) {
      x.push(valueX);
      y.push(mapY.get(date));
    }
  }
  return { x, y };
}

function correlation(x, y) {
  const cov = covariance(x, y);
  const denominator = Math.sqrt(variance(x) * variance(y));
  return denominator ? cov / denominator : null;
}

function covariance(x, y) {
  if (x.length < 2) return 0;
  const meanX = average(x);
  const meanY = average(y);
  return x.reduce((sum, value, index) => sum + (value - meanX) * (y[index] - meanY), 0) / (x.length - 1);
}

function variance(values) {
  if (values.length < 2) return 0;
  const mean = average(values);
  return values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);
}

function renderAll(invalidRows, groups) {
  els.exportBtn.disabled = !state.summaries.length;
  els.datasetTitle.textContent = `${state.rows.length.toLocaleString()} 行日线数据，${state.enrichedRows.length.toLocaleString()} 个收益率样本`;
  renderMetrics(state.overallSummary);
  renderTable();
  renderQuality(invalidRows, groups);
  renderDistributionCharts();
  renderPairSsdTable();
  renderBenchmarkAnalysis();
  renderQualityTrendModel();
  renderLongTermModel();
}

function renderMetrics(summary) {
  const metrics = summary
    ? [
        ["均值", formatPercent(summary.mean)],
        ["年化复利率", formatPercent(summary.annualReturn)],
        ["年化波动", formatPercent(summary.annualVol)],
        ["Sharpe", formatNumber(summary.sharpe, 2)],
      ]
    : [
        ["均值", "--"],
        ["年化复利率", "--"],
        ["年化波动", "--"],
        ["Sharpe", "--"],
      ];
  els.metricCards.innerHTML = metrics
    .map(([label, value]) => `<article class="metric-card"><span>${label}</span><strong>${value}</strong></article>`)
    .join("");
}

function renderTable() {
  els.summaryHead.innerHTML = `<tr>${summaryColumns.map(([, label]) => `<th>${label}</th>`).join("")}</tr>`;
  if (!state.summaries.length) {
    els.summaryBody.innerHTML = `<tr><td class="empty-state" colspan="${summaryColumns.length}">暂无可计算的收益率。</td></tr>`;
    return;
  }
  els.summaryBody.innerHTML = state.summaries
    .map((summary) => {
      const cells = summaryColumns
        .map(([key]) => {
          const value = key === "ticker" ? escapeHtml(summary[key]) : formatCell(key, summary[key]);
          return `<td>${value}</td>`;
        })
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");
}

function renderQuality(invalidRows, groups) {
  const tickers = [...groups.keys()];
  const dateValues = state.enrichedRows.map((row) => row.date.getTime());
  const minDate = dateValues.length ? new Date(Math.min(...dateValues)) : null;
  const maxDate = dateValues.length ? new Date(Math.max(...dateValues)) : null;
  els.qualityText.textContent = invalidRows.length ? `有 ${invalidRows.length} 行因日期或价格列无效被跳过。` : "数据字段可用于收益率计算。";
  const items = [
    ["股票数量", tickers.length.toLocaleString()],
    ["有效收益率样本", state.enrichedRows.length.toLocaleString()],
    ["日期范围", minDate && maxDate ? `${formatDate(minDate)} 至 ${formatDate(maxDate)}` : "--"],
    ["选择区间", els.startDate.value && els.endDate.value ? `${els.startDate.value} 至 ${els.endDate.value}` : "--"],
    ["跳过行数", invalidRows.length.toLocaleString()],
  ];
  els.qualityList.innerHTML = items
    .map(([label, value]) => `<div class="quality-row"><span>${label}</span><strong>${value}</strong></div>`)
    .join("");
}

function renderDistributionCharts() {
  const summaries = state.summaries;
  if (!summaries.length) {
    els.distributionCharts.innerHTML = '<div class="empty-state">暂无可计算的单股票收益率分布。</div>';
    els.chartSubtitle.textContent = "上传数据后按股票分别显示。";
    return;
  }

  els.distributionCharts.innerHTML = summaries
    .map(
      (summary) => `
        <article class="distribution-card">
          <h4>${escapeHtml(summary.ticker)}</h4>
          <p>${summary.observations.toLocaleString()} 个收益率样本，mean ${formatPercent(summary.mean)}，sigma ${formatPercent(summary.std)}</p>
          <canvas data-ticker="${escapeHtml(summary.ticker)}" width="760" height="360"></canvas>
        </article>
      `,
    )
    .join("");

  const canvases = els.distributionCharts.querySelectorAll("canvas");
  summaries.forEach((summary, index) => {
    const canvas = canvases[index];
    drawHistogram(returnsForTicker(summary.ticker), summary.ticker, canvas);
  });
  els.chartSubtitle.textContent = `${summaries.length} 只股票，各自生成一张收益率分布图。`;
}

function returnsForTicker(ticker) {
  return state.enrichedRows.filter((row) => row.ticker === ticker).map((row) => row.return);
}

function drawHistogram(values, ticker, canvas) {
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  if (!values.length) {
    ctx.fillStyle = "#6a707c";
    ctx.font = "18px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("暂无可计算的收益率分布", width / 2, height / 2);
    return;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const mean = average(sorted);
  const std = Math.sqrt(sorted.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(1, sorted.length - 1));
  let min = sorted[0];
  let max = sorted[sorted.length - 1];
  if (min === max) {
    min -= 0.01;
    max += 0.01;
  }

  const bins = Number(els.binCount.value) || 36;
  const binWidthValue = (max - min) / bins;
  const counts = Array.from({ length: bins }, () => 0);
  sorted.forEach((value) => {
    const index = Math.min(bins - 1, Math.max(0, Math.floor(((value - min) / (max - min)) * bins)));
    counts[index] += 1;
  });

  const densities = counts.map((count) => count / (values.length * binWidthValue));
  const normalPeak = std > 0 ? 1 / (std * Math.sqrt(2 * Math.PI)) : 0;
  const maxDensity = Math.max(...densities, normalPeak);
  const yMax = maxDensity > 0 ? maxDensity * 1.18 : 1;
  const margin = { top: 58, right: 26, bottom: 66, left: 74 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;
  const x = (value) => margin.left + ((value - min) / (max - min)) * plotW;
  const y = (density) => margin.top + plotH - (density / yMax) * plotH;

  ctx.strokeStyle = "#d8dde6";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i <= 5; i += 1) {
    const yy = margin.top + (plotH / 5) * i;
    ctx.moveTo(margin.left, yy);
    ctx.lineTo(width - margin.right, yy);
  }
  ctx.stroke();

  ctx.strokeStyle = "#eef1f5";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i <= 10; i += 1) {
    const value = min + ((max - min) * i) / 10;
    const xx = x(value);
    ctx.moveTo(xx, margin.top);
    ctx.lineTo(xx, margin.top + plotH);
  }
  ctx.stroke();

  if (min <= 0 && max >= 0) {
    const zeroX = x(0);
    ctx.strokeStyle = "#202124";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(zeroX, margin.top);
    ctx.lineTo(zeroX, margin.top + plotH);
    ctx.stroke();
  }

  const barW = plotW / bins;
  densities.forEach((density, index) => {
    const left = margin.left + index * barW + 1;
    const top = y(density);
    const fill = index % 2 === 0 ? "#0f766e" : "#2d6cdf";
    ctx.fillStyle = fill;
    ctx.globalAlpha = 0.82;
    ctx.fillRect(left, top, Math.max(1, barW - 2), margin.top + plotH - top);
  });
  ctx.globalAlpha = 1;

  if (std > 0) {
    ctx.strokeStyle = "#c65b4c";
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i <= 240; i += 1) {
      const value = min + ((max - min) * i) / 240;
      const density = (1 / (std * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * ((value - mean) / std) ** 2);
      const px = x(value);
      const py = y(density);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    ctx.strokeStyle = "#b78113";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.moveTo(x(mean), margin.top);
    ctx.lineTo(x(mean), margin.top + plotH);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.strokeStyle = "#243447";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(margin.left, margin.top + plotH);
  ctx.lineTo(width - margin.right, margin.top + plotH);
  ctx.moveTo(margin.left, margin.top);
  ctx.lineTo(margin.left, margin.top + plotH);
  ctx.stroke();

  ctx.fillStyle = "#3f4856";
  ctx.font = "13px system-ui";
  ctx.textAlign = "center";
  for (let i = 0; i <= 10; i += 1) {
    const value = min + ((max - min) * i) / 10;
    ctx.fillText(formatPercent(value), x(value), height - 26);
  }
  if (min <= 0 && max >= 0) {
    const zeroX = x(0);
    ctx.fillStyle = "#202124";
    ctx.font = "700 13px system-ui";
    ctx.fillText("0%", zeroX, height - 44);
  }
  ctx.textAlign = "right";
  for (let i = 0; i <= 5; i += 1) {
    const density = (yMax * i) / 5;
    ctx.fillText(formatNumber(density, 1), margin.left - 12, margin.top + plotH - (plotH * i) / 5 + 4);
  }

  ctx.save();
  ctx.translate(18, margin.top + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = "#3f4856";
  ctx.font = "12px system-ui";
  ctx.textAlign = "center";
  ctx.fillText("概率密度", 0, 0);
  ctx.restore();

  ctx.fillStyle = "#3f4856";
  ctx.font = "12px system-ui";
  ctx.textAlign = "center";
  ctx.fillText("日收益率", margin.left + plotW / 2, height - 5);

  ctx.fillStyle = "#202124";
  ctx.font = "12px system-ui";
  ctx.textAlign = "left";
  ctx.fillText(`mean ${formatPercent(mean)}  sigma ${formatPercent(std)}  n ${values.length}`, margin.left, 20);
  ctx.fillStyle = "#c65b4c";
  ctx.textAlign = "left";
  ctx.fillRect(margin.left, 34, 22, 4);
  ctx.fillText("正态参考曲线", margin.left + 30, 39);
  ctx.fillStyle = "#b78113";
  ctx.fillRect(margin.left + 132, 34, 22, 4);
  ctx.fillStyle = "#3f4856";
  ctx.fillText("mean", margin.left + 162, 39);
  ctx.fillStyle = "#202124";
  ctx.fillRect(margin.left + 210, 34, 22, 4);
  ctx.fillStyle = "#3f4856";
  ctx.fillText("0%", margin.left + 240, 39);
}

function renderBenchmarkAnalysis() {
  renderBenchmarkTable();
  renderBenchmarkCharts();
}

function renderPairSsdTable() {
  els.pairSsdHead.innerHTML = "<tr><th>目标股票</th><th>排名</th><th>股票池代码</th><th>名称</th><th>SSD</th><th>重叠天数</th><th>区间</th><th>目标归一终值</th><th>候选归一终值</th></tr>";
  const results = state.pairSsdResults || [];
  if (!window.pairTradingPool) {
    els.pairSsdBody.innerHTML = '<tr><td class="empty-state" colspan="9">未加载股票池数据，请确认 pair_pool_data.js 存在。</td></tr>';
    els.pairSsdSubtitle.textContent = "需要先加载代表性股票池价格序列。";
    return;
  }
  if (!results.length) {
    els.pairSsdBody.innerHTML = '<tr><td class="empty-state" colspan="9">上传股票后显示 SSD 最差匹配。</td></tr>';
    els.pairSsdSubtitle.textContent = `股票池已加载：${window.pairTradingPool.series.length.toLocaleString()} 只股票，${window.pairTradingPool.dates.length.toLocaleString()} 个交易日。`;
    return;
  }

  const rows = [];
  results.forEach((group) => {
    if (!group.usable) {
      rows.push(`<tr><td>${escapeHtml(group.targetTicker)}</td><td>--</td><td colspan="7" class="explain-cell">${escapeHtml(group.reason)}</td></tr>`);
      return;
    }
    group.rows.forEach((item, index) => {
      rows.push(
        `<tr><td>${escapeHtml(group.targetTicker)}</td><td>${index + 1}</td><td>${escapeHtml(item.code)}</td><td>${escapeHtml(item.name || "--")}</td><td>${formatNumber(item.ssd, 4)}</td><td>${item.overlap.toLocaleString()}</td><td>${item.startDate} 至 ${item.endDate}</td><td>${formatNumber(item.targetEndNorm, 3)}</td><td>${formatNumber(item.candidateEndNorm, 3)}</td></tr>`,
      );
    });
  });
  els.pairSsdBody.innerHTML = rows.join("");
  const totalRows = results.reduce((sum, group) => sum + group.rows.length, 0);
  els.pairSsdSubtitle.textContent = `按归一化价格路径计算 SSD，当前显示 ${totalRows.toLocaleString()} 条最差匹配结果。`;
}

function renderQualityTrendModel() {
  els.qualityTrendHead.innerHTML = "<tr><th>股票</th><th>财务日期</th><th>当前质量分</th><th>预测改善</th><th>趋势等级</th><th>收益验证</th><th>主要驱动</th><th>模型解读</th></tr>";
  const scores = state.qualityTrendScores || [];
  if (!scores.length) {
    els.qualityTrendBody.innerHTML = '<tr><td class="empty-state" colspan="8">暂无可评估数据。</td></tr>';
    els.qualityTrendSubtitle.textContent = "上传含 quality_ 财务因子、statDate/pubDate 的 CSV 后显示。";
    return;
  }
  const usableCount = scores.filter((item) => item.usable).length;
  els.qualityTrendSubtitle.textContent = usableCount
    ? `纯财务模型预测未来 4 个季度质量分改善；测试 R² ${formatNumber(qualityTrendModel.metrics.test_r2, 3)}，质量趋势 Rank IC ${formatNumber(qualityTrendModel.metrics.test_rank_ic_mean, 3)}。`
    : "需要含 quality_ 财务因子、statDate/pubDate 的 CSV；普通日线行情无法计算该板块。";

  els.qualityTrendBody.innerHTML = scores
    .map((item) => {
      if (!item.usable) {
        return `<tr><td>${escapeHtml(item.ticker)}</td><td>${formatDate(item.date)}</td><td>--</td><td>--</td><td>无法评估</td><td>--</td><td>--</td><td>${escapeHtml(item.reason)}</td></tr>`;
      }
      const drivers = item.topContributions
        .map((part) => `${escapeHtml(part.label)} ${part.contribution >= 0 ? "+" : ""}${formatNumber(part.contribution, 1)}`)
        .join("；");
      return `<tr><td>${escapeHtml(item.ticker)}</td><td>${formatDate(item.date)}</td><td>${formatNumber(item.currentQualityScore, 1)}</td><td>${item.predictedTrend >= 0 ? "+" : ""}${formatNumber(item.predictedTrend, 1)}</td><td>${escapeHtml(item.rating)}</td><td>500日验证更强；250日较弱</td><td>${drivers}</td><td class="explain-cell">${escapeHtml(item.explanation)}</td></tr>`;
    })
    .join("");
}

function renderBenchmarkTable() {
  els.benchmarkHead.innerHTML = "<tr><th>标的</th><th>对照序列</th><th>重叠样本</th><th>截距（日）</th><th>斜率</th><th>拟合模型</th><th>相关系数</th><th>R²</th></tr>";
  if (!state.benchmarkStats.length) {
    els.benchmarkBody.innerHTML = '<tr><td class="empty-state" colspan="8">上传对照 CSV 后显示关系拟合。</td></tr>';
    return;
  }
  els.benchmarkBody.innerHTML = state.benchmarkStats
    .map(
      (item) =>
        `<tr><td>${escapeHtml(item.ticker)}</td><td>${escapeHtml(item.benchmark)}</td><td>${item.overlap.toLocaleString()}</td><td>${formatPercent(item.alpha)}</td><td>${formatNumber(item.beta, 3)}</td><td>${escapeHtml(item.model)}</td><td>${formatNumber(item.correlation, 3)}</td><td>${formatNumber(item.rSquared, 3)}</td></tr>`,
    )
    .join("");
}

function renderBenchmarkCharts() {
  const stats = state.benchmarkStats.filter((item) => item.overlap >= 2);
  if (!stats.length) {
    els.benchmarkCharts.innerHTML = '<div class="empty-state">暂无可绘制的股票-对照数据散点图。</div>';
    els.benchmarkSubtitle.textContent = "上传对照 CSV 后显示关系拟合。";
    return;
  }
  els.benchmarkCharts.innerHTML = stats
    .map(
      (item) => `
        <article class="distribution-card">
          <h4>${escapeHtml(item.ticker)} vs ${escapeHtml(item.benchmark)}</h4>
          <p>截距 ${formatPercent(item.alpha)}，斜率 ${formatNumber(item.beta, 3)}，n ${item.overlap.toLocaleString()}</p>
          <canvas width="760" height="360"></canvas>
        </article>
      `,
    )
    .join("");

  const canvases = els.benchmarkCharts.querySelectorAll("canvas");
  stats.forEach((item, index) => drawScatter(item, canvases[index]));
  els.benchmarkSubtitle.textContent = `${stats.length} 个标的与 ${els.benchmarkTicker.value || "对照序列"} 的同日收益率线性拟合。`;
}

function drawScatter(item, canvas) {
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  const xs = item.points.map((point) => point.benchmarkReturn);
  const ys = item.points.map((point) => point.stockReturn);
  const minX = Math.min(...xs, 0);
  const maxX = Math.max(...xs, 0);
  const minY = Math.min(...ys, 0);
  const maxY = Math.max(...ys, 0);
  const paddedX = paddedRange(minX, maxX);
  const paddedY = paddedRange(minY, maxY);
  const margin = { top: 42, right: 24, bottom: 66, left: 72 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;
  const x = (value) => margin.left + ((value - paddedX.min) / (paddedX.max - paddedX.min)) * plotW;
  const y = (value) => margin.top + plotH - ((value - paddedY.min) / (paddedY.max - paddedY.min)) * plotH;

  ctx.strokeStyle = "#edf0f5";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i <= 6; i += 1) {
    const xx = margin.left + (plotW * i) / 6;
    const yy = margin.top + (plotH * i) / 6;
    ctx.moveTo(xx, margin.top);
    ctx.lineTo(xx, margin.top + plotH);
    ctx.moveTo(margin.left, yy);
    ctx.lineTo(margin.left + plotW, yy);
  }
  ctx.stroke();

  if (paddedX.min <= 0 && paddedX.max >= 0) {
    ctx.strokeStyle = "#202124";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x(0), margin.top);
    ctx.lineTo(x(0), margin.top + plotH);
    ctx.stroke();
  }
  if (paddedY.min <= 0 && paddedY.max >= 0) {
    ctx.strokeStyle = "#202124";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(margin.left, y(0));
    ctx.lineTo(margin.left + plotW, y(0));
    ctx.stroke();
  }

  ctx.fillStyle = "#2d6cdf";
  item.points.forEach((point) => {
    ctx.beginPath();
    ctx.arc(x(point.benchmarkReturn), y(point.stockReturn), 4.5, 0, Math.PI * 2);
    ctx.fill();
  });

  if (Number.isFinite(item.beta)) {
    const meanX = average(xs);
    const meanY = average(ys);
    const intercept = meanY - item.beta * meanX;
    const lineY1 = intercept + item.beta * paddedX.min;
    const lineY2 = intercept + item.beta * paddedX.max;
    ctx.strokeStyle = "#c65b4c";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x(paddedX.min), y(lineY1));
    ctx.lineTo(x(paddedX.max), y(lineY2));
    ctx.stroke();
  }

  ctx.strokeStyle = "#243447";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(margin.left, margin.top, plotW, plotH);

  ctx.fillStyle = "#3f4856";
  ctx.font = "12px system-ui";
  ctx.textAlign = "center";
  for (let i = 0; i <= 6; i += 1) {
    const value = paddedX.min + ((paddedX.max - paddedX.min) * i) / 6;
    ctx.fillText(formatPercent(value), x(value), height - 26);
  }
  ctx.textAlign = "right";
  for (let i = 0; i <= 6; i += 1) {
    const value = paddedY.min + ((paddedY.max - paddedY.min) * i) / 6;
    ctx.fillText(formatPercent(value), margin.left - 10, y(value) + 4);
  }

  ctx.textAlign = "center";
  ctx.fillText(`${item.benchmark} 日收益率`, margin.left + plotW / 2, height - 6);
  ctx.save();
  ctx.translate(18, margin.top + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(`${item.ticker} 日收益率`, 0, 0);
  ctx.restore();

  ctx.textAlign = "left";
  ctx.fillStyle = "#202124";
  ctx.fillText(`intercept ${formatPercent(item.alpha)}  slope ${formatNumber(item.beta, 3)}  R² ${formatNumber(item.rSquared, 3)}`, margin.left, 22);
}

function paddedRange(min, max) {
  if (min === max) {
    return { min: min - 0.01, max: max + 0.01 };
  }
  const pad = (max - min) * 0.12;
  return { min: min - pad, max: max + pad };
}

function renderLongTermModel() {
  els.longTermHead.innerHTML = "<tr><th>股票</th><th>因子日期</th><th>综合评分</th><th>参考等级</th><th>成长趋势分</th><th>低估修复分</th><th>历史表现分</th><th>诊断</th><th>成长主要因子</th><th>修复主要因子</th><th>模型解读</th></tr>";
  const scores = state.longTermScores || [];
  if (!scores.length) {
    els.longTermBody.innerHTML = '<tr><td class="empty-state" colspan="11">暂无可评估数据。</td></tr>';
    els.longTermSubtitle.textContent = "同时评估成长趋势模型与低估修复模型，目标为未来约 250 个交易日收益。";
    return;
  }
  const usableCount = scores.filter((item) => item.usable).length;
  els.longTermSubtitle.textContent = `综合评分 = 60% × max(成长趋势分, 低估修复分) + 40% × 历史表现分。成长 Rank IC ${formatNumber(longTermModel.rankIcMean, 3)}，修复 Rank IC ${formatNumber(recoveryModel.rankIcMean, 3)}。`;
  els.longTermBody.innerHTML = scores
    .map((item) => {
      if (!item.usable) {
        return `<tr><td>${escapeHtml(item.ticker)}</td><td>${formatDate(item.date)}</td><td>--</td><td>无法评估</td><td>--</td><td>--</td><td>--</td><td>${escapeHtml(item.reason)}</td><td>--</td><td>--</td><td>--</td></tr>`;
      }
      const growthText = item.growth.topContributions
        .map((part) => `${escapeHtml(part.label)} ${part.contribution >= 0 ? "+" : ""}${formatPercent(part.contribution)}`)
        .join("；");
      const recoveryText = item.recovery.topContributions
        .map((part) => `${escapeHtml(part.label)} ${part.contribution >= 0 ? "+" : ""}${formatPercent(part.contribution)}`)
        .join("；");
      const historyText = item.performance ? `${formatNumber(item.performance.score, 1)} / 年化复利率 ${formatPercent(item.performance.annualReturn)} / 回撤 ${formatPercent(item.performance.drawdown)}` : "--";
      return `<tr><td>${escapeHtml(item.ticker)}</td><td>${formatDate(item.date)}</td><td>${formatNumber(item.compositeScore, 1)}</td><td>${escapeHtml(item.rating)}</td><td>${formatNumber(item.growth.score, 1)}</td><td>${formatNumber(item.recovery.score, 1)}</td><td>${historyText}</td><td>${escapeHtml(item.diagnosis)}</td><td>${growthText}</td><td>${recoveryText}</td><td class="explain-cell">${escapeHtml(item.explanation)}</td></tr>`;
    })
    .join("");
  if (!usableCount) {
    els.longTermSubtitle.textContent = "双模型需要换手率、PE、PS、PC、PB、成交额列，并至少有 251 个交易日。";
  }
}

function clearCanvas(ctx, width, height) {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
}

function drawCanvasMessage(ctx, width, height, message) {
  ctx.fillStyle = "#6a707c";
  ctx.font = "18px system-ui";
  ctx.textAlign = "center";
  ctx.fillText(message, width / 2, height / 2);
}

function drawGrid(ctx, margin, plotW, plotH, steps) {
  ctx.strokeStyle = "#edf0f5";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i <= steps; i += 1) {
    const xx = margin.left + (plotW * i) / steps;
    const yy = margin.top + (plotH * i) / steps;
    ctx.moveTo(xx, margin.top);
    ctx.lineTo(xx, margin.top + plotH);
    ctx.moveTo(margin.left, yy);
    ctx.lineTo(margin.left + plotW, yy);
  }
  ctx.stroke();
}

function drawAxes(ctx, margin, plotW, plotH) {
  ctx.strokeStyle = "#243447";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(margin.left, margin.top, plotW, plotH);
}

function renderEmpty() {
  els.exportBtn.disabled = true;
  els.datasetTitle.textContent = "等待导入数据";
  els.qualityText.textContent = "尚未读取数据。";
  els.qualityList.innerHTML = "";
  els.distributionCharts.innerHTML = "";
  els.benchmarkCharts.innerHTML = "";
  els.benchmarkHead.innerHTML = "";
  els.benchmarkBody.innerHTML = "";
  els.benchmarkSubtitle.textContent = "上传或选择比较基准后显示同日收益率散点图。";
  els.pairSsdHead.innerHTML = "";
  els.pairSsdBody.innerHTML = "";
  els.pairSsdSubtitle.textContent = "上传股票后，按最小距离法找出股票池中匹配程度最差的标的。";
  els.longTermHead.innerHTML = "";
  els.longTermBody.innerHTML = "";
  els.longTermSubtitle.textContent = "内置全 A 股长期成长线性模型，目标为未来约 250 个交易日收益。";
  els.qualityTrendHead.innerHTML = "";
  els.qualityTrendBody.innerHTML = "";
  els.qualityTrendSubtitle.textContent = "上传含财务质量因子的 CSV 后，评估未来 4 个季度基本面改善倾向。";
  els.chartSubtitle.textContent = "上传数据后按股票分别显示。";
  state.overallSummary = null;
  state.benchmarkStats = [];
  state.pairSsdResults = [];
  state.longTermScores = [];
  state.qualityTrendScores = [];
  renderMetrics(null);
  renderTable();
  renderPairSsdTable();
}

function formatCell(key, value) {
  if (key === "observations") return Number(value).toLocaleString();
  if (["mean", "median", "std", "downsideRisk", "min", "max", "var5", "cvar5", "positiveRate", "alpha", "alphaFactor", "annualReturn", "annualVol"].includes(key)) {
    return formatPercent(value);
  }
  return formatNumber(value, 3);
}

function formatPercent(value) {
  if (!Number.isFinite(value)) return "--";
  return `${(value * 100).toFixed(2)}%`;
}

function formatSignedPercent(value) {
  if (!Number.isFinite(value)) return "--";
  return `${value >= 0 ? "+" : "-"}${Math.abs(value * 100).toFixed(2)}%`;
}

function formatNumber(value, digits = 2) {
  if (!Number.isFinite(value)) return "--";
  return value.toFixed(digits);
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function toNumber(value) {
  if (typeof value === "number") return value;
  return Number(String(value).replace(/,/g, "").trim());
}

function parseDate(value) {
  const text = String(value).trim();
  if (!text) return null;
  const compact = text.match(/^(\d{4})(\d{2})(\d{2})$/);
  const normalized = compact ? `${compact[1]}-${compact[2]}-${compact[3]}` : text.replace(/\//g, "-");
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function addSyntheticFactorsToCsv(csv) {
  const lines = csv.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return csv;
  const headers = parseCsvLine(lines[0]);
  const needed = ["turnover", "pe", "ps", "pc", "pb", "market_value", "money"];
  const outputHeaders = [...headers];
  needed.forEach((name) => {
    if (!outputHeaders.includes(name)) outputHeaders.push(name);
  });
  const tickerIndex = headers.indexOf("ticker");
  const closeIndex = headers.indexOf("close");
  const rows = lines.slice(1).map((line, rowIndex) => {
    const cells = parseCsvLine(line);
    if (needed.every((name) => headers.includes(name)) && cells.length >= outputHeaders.length) return line;
    const ticker = cells[tickerIndex] || "T";
    const close = toNumber(cells[closeIndex]);
    const seed = ticker.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const t = rowIndex % 10;
    const base = Number.isFinite(close) ? close : 100;
    const factors = {
      turnover: (1.1 + (seed % 7) * 0.18 + Math.sin(t * 0.9 + seed) * 0.35 + t * 0.03).toFixed(2),
      pe: (12 + (seed % 11) * 1.15 + Math.cos(t * 0.7 + seed / 5) * 2.2 + base / 260).toFixed(2),
      ps: (1.5 + (seed % 5) * 0.28 + Math.sin(t * 1.3 + seed / 9) * 0.45).toFixed(2),
      pc: (7 + (seed % 9) * 0.55 + Math.cos(t * 0.5 + seed / 7) * 1.5 + t * 0.06).toFixed(2),
      pb: (1.0 + (seed % 6) * 0.22 + Math.sin(t * 1.1 + seed / 11) * 0.24 + base / 900).toFixed(2),
      market_value: Math.round((42 + (seed % 15) * 18 + base * 0.9) * 100000000),
      money: Math.round((0.8 + (seed % 9) * 0.18 + t * 0.05) * 100000000),
    };
    const byName = Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
    needed.forEach((name) => {
      if (!byName[name]) byName[name] = factors[name];
    });
    return outputHeaders.map((header) => byName[header] ?? "").join(",");
  });
  return [outputHeaders.join(","), ...rows].join("\n");
}

function loadCsvText(text, label) {
  const parsed = parseCsv(text);
  state.rows = parsed.rows;
  state.headers = parsed.headers;
  els.fileName.textContent = label;
  setColumnOptions();
  syncDateBounds(true);
  recompute();
}

function loadBenchmarkText(text, label) {
  const parsed = parseCsv(text);
  state.benchmarkRows = parsed.rows;
  state.benchmarkHeaders = parsed.headers;
  els.benchmarkFileName.textContent = label;
  setBenchmarkColumnOptions();
  recompute();
}

function loadQualityText(text, label) {
  const parsed = parseCsv(text);
  state.qualityRows = parsed.rows;
  state.qualityHeaders = parsed.headers;
  els.qualityFileName.textContent = label;
  recompute();
}

function exportSummaryCsv() {
  const header = summaryColumns.map(([, label]) => label).join(",");
  const rows = state.summaries.map((summary) =>
    summaryColumns
      .map(([key]) => {
        const raw = key === "ticker" ? summary[key] : formatCell(key, summary[key]);
        return `"${String(raw ?? "").replace(/"/g, '""')}"`;
      })
      .join(","),
  );
  const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "return_summary.csv";
  link.click();
  URL.revokeObjectURL(url);
}

els.fileInput.addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => loadCsvText(String(reader.result || ""), file.name);
  reader.readAsText(file);
});

els.benchmarkFileInput.addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => loadBenchmarkText(String(reader.result || ""), file.name);
  reader.readAsText(file);
});

els.qualityFileInput.addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => loadQualityText(String(reader.result || ""), file.name);
  reader.readAsText(file);
});

[els.closeCol, els.tickerCol, els.tradingDays, els.riskFreeRate, els.startDate, els.endDate, els.pairMinOverlap, els.pairTopCount, els.benchmarkTicker, els.benchmarkDateCol, els.benchmarkCloseCol, els.benchmarkTickerCol, els.moneyCol, ...factorDefs.map((factor) => els[factor.el])].forEach((el) => {
  el.addEventListener("change", recompute);
});

[els.tradingDays, els.riskFreeRate, els.pairMinOverlap, els.pairTopCount].forEach((el) => {
  el.addEventListener("input", recompute);
});

els.dateCol.addEventListener("change", () => {
  syncDateBounds(true);
  recompute();
});

els.resetDateBtn.addEventListener("click", () => {
  syncDateBounds(true);
  recompute();
});

els.binCount.addEventListener("input", () => {
  els.binValue.textContent = els.binCount.value;
  renderDistributionCharts();
});

els.simpleReturnBtn.addEventListener("click", () => {
  state.returnType = "simple";
  els.simpleReturnBtn.classList.add("active");
  els.logReturnBtn.classList.remove("active");
  if (window.builtinShanghaiIndexCsv) loadMarketText(window.builtinShanghaiIndexCsv);
  recompute();
});

els.logReturnBtn.addEventListener("click", () => {
  state.returnType = "log";
  els.logReturnBtn.classList.add("active");
  els.simpleReturnBtn.classList.remove("active");
  if (window.builtinShanghaiIndexCsv) loadMarketText(window.builtinShanghaiIndexCsv);
  recompute();
});

els.sampleBtn.addEventListener("click", () => {
  loadBenchmarkText(benchmarkSampleCsv, "benchmark_sample.csv");
  loadCsvText(addSyntheticFactorsToCsv(sampleCsv), "示例数据已载入");
});
els.exportBtn.addEventListener("click", exportSummaryCsv);

window.__loadCsvTextForTest = loadCsvText;
window.__loadBenchmarkTextForTest = loadBenchmarkText;
window.__loadQualityTextForTest = loadQualityText;
renderEmpty();

if (window.builtinShanghaiIndexCsv) {
  loadMarketText(window.builtinShanghaiIndexCsv);
}

const sampleMode = new URLSearchParams(window.location.search).get("sample");
if (sampleMode === "quality") {
  fetch("quality_trend_sample.csv")
    .then((response) => response.text())
    .then((text) => loadCsvText(text, "quality_trend_sample.csv"))
    .catch(() => {});
}
if (sampleMode === "finance") {
  fetch("quality_financial_sample.csv")
    .then((response) => response.text())
    .then((text) => loadQualityText(text, "quality_financial_sample.csv"))
    .catch(() => {});
}
