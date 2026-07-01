const exchangeSelect = document.querySelector("#exchangeSelect");
const marketTypeSelect = document.querySelector("#marketTypeSelect");
const searchInput = document.querySelector("#searchInput");
const searchStatus = document.querySelector("#searchStatus");
const searchResults = document.querySelector("#searchResults");
const tickerList = document.querySelector("#tickerList");
const limitText = document.querySelector("#limitText");
const summary = document.querySelector("#summary");
const toast = document.querySelector("#toast");
const priceTabButton = document.querySelector("#priceTabButton");
const alertsTabButton = document.querySelector("#alertsTabButton");
const priceTabPanel = document.querySelector("#priceTabPanel");
const alertsTabPanel = document.querySelector("#alertsTabPanel");
const refreshButton = document.querySelector("#refreshButton");
const addPanelButton = document.querySelector("#addPanelButton");
const settingsPanelButton = document.querySelector("#settingsPanelButton");
const orderPanelButton = document.querySelector("#orderPanelButton");
const closeAddPanelButton = document.querySelector("#closeAddPanelButton");
const closeSettingsButton = document.querySelector("#closeSettingsButton");
const addTickerPanel = document.querySelector("#addTickerPanel");
const settingsPanel = document.querySelector("#settingsPanel");
const orderPanel = document.querySelector("#orderPanel");
const closeOrderButton = document.querySelector("#closeOrderButton");
const saveOrderButton = document.querySelector("#saveOrderButton");
const cancelOrderButton = document.querySelector("#cancelOrderButton");
const orderList = document.querySelector("#orderList");
const orderStatus = document.querySelector("#orderStatus");
const updateIntervalSelect = document.querySelector("#updateIntervalSelect");
const changeBasisSelect = document.querySelector("#changeBasisSelect");
const changeWindowSelect = document.querySelector("#changeWindowSelect");
const settingsStatus = document.querySelector("#settingsStatus");
const alertPanel = document.querySelector("#alertPanel");
const closeAlertButton = document.querySelector("#closeAlertButton");
const alertTickerTitle = document.querySelector("#alertTickerTitle");
const alertTickerSelect = document.querySelector("#alertTickerSelect");
const alertList = document.querySelector("#alertList");
const alertCountText = document.querySelector("#alertCountText");
const alertDirectionSelect = document.querySelector("#alertDirectionSelect");
const alertTargetInput = document.querySelector("#alertTargetInput");
const alertRepeatSelect = document.querySelector("#alertRepeatSelect");
const alertStatus = document.querySelector("#alertStatus");
const saveAlertButton = document.querySelector("#saveAlertButton");
const cancelAlertButton = document.querySelector("#cancelAlertButton");
const showAlertFormButton = document.querySelector("#showAlertFormButton");

let state = {
  trackedTickers: [],
  badgeTickerId: null,
  priceCache: {},
  alertRules: {},
  maxTrackedTickers: 10,
  maxAlertsPerTicker: 20,
  lastUpdatedAt: null,
  updateIntervalMinutes: 1,
  changeBasis: "window",
  changeWindow: "update_interval",
  updateIntervalOptions: [1, 3, 5, 15, 30],
  changeBasisOptions: ["window", "added"],
  changeWindowOptions: ["update_interval", 1, 3, 5, 15, 30, 60, 240, 1440]
};

let searchTimer = null;
let lastSearchRequestId = 0;
let isApplyingState = false;
var isBackfillingWindowReferences = false;
let selectedAlertTickerId = null;
let activeTabName = "prices";
let orderDraftTickers = [];
let draggedOrderTickerId = null;
const MANUAL_REFRESH_COOLDOWN_MS = 5000;
const ONE_MINUTE_MS = 60 * 1000;
const CANDLE_REFERENCE_STALE_GRACE_MS = 2 * ONE_MINUTE_MS;
let nextManualRefreshAt = 0;
let toastTimer = null;

function sendMessage(message) {
  return chrome.runtime.sendMessage(message).then((response) => {
    if (!response?.ok) {
      throw new Error(response?.error || "Request failed");
    }

    return response;
  });
}

function formatExchange(exchange) {
  const value = String(exchange || "").toLowerCase();
  if (value === "okx") return "OKX";
  if (value === "binance") return "Binance";
  return String(exchange || "");
}

function formatMarketType(marketType) {
  return marketType === "spot" ? "현물" : "선물";
}

function toFiniteNumber(value) {
  if (value === null || value === undefined || value === "") return null;

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function formatPrice(price) {
  const value = toFiniteNumber(price);

  if (value === null) return "-";

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: value >= 100 ? 2 : 6
  }).format(value);
}

function formatTime(timestamp) {
  if (!timestamp) return "아직 업데이트 없음";

  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(new Date(timestamp));
}

function isSameSecond(first, second) {
  const a = Number(first);
  const b = Number(second);

  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;

  return Math.floor(a / 1000) === Math.floor(b / 1000);
}

function shouldShowTickerUpdateTime(cached) {
  if (cached?.error) return true;
  if (!cached?.updatedAt || !state?.lastUpdatedAt) return true;

  return !isSameSecond(cached.updatedAt, state.lastUpdatedAt);
}

function escapeText(value) {
  return String(value ?? "");
}

function setLoading(isLoading) {
  document.body.classList.toggle("loading", isLoading);
}

function showToast(message) {
  if (!toast) return;

  toast.textContent = message;
  toast.classList.remove("hidden");

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.add("hidden");
  }, 2200);
}

function setRefreshButtonCooldown() {
  nextManualRefreshAt = Date.now() + MANUAL_REFRESH_COOLDOWN_MS;
  refreshButton.classList.add("is-cooling");
  refreshButton.title = "원활한 API 통신을 위해 잠시 후 다시 시도해주세요.";

  setTimeout(() => {
    if (Date.now() >= nextManualRefreshAt) {
      refreshButton.classList.remove("is-cooling");
      refreshButton.title = "새로고침";
    }
  }, MANUAL_REFRESH_COOLDOWN_MS);
}

function setSettingsStatus(message, isError = false) {
  settingsStatus.textContent = message;
  settingsStatus.classList.toggle("error-text", isError);
}

function renderSummary() {
  summary.replaceChildren();

  if (!state.lastUpdatedAt) {
    summary.textContent = "가격을 불러오는 중...";
    summary.classList.remove("summary-pill");
    return;
  }

  summary.classList.add("summary-pill");

  const label = document.createElement("span");
  label.className = "summary-label";
  label.textContent = "업데이트";

  const time = document.createElement("strong");
  time.textContent = formatTime(state.lastUpdatedAt);

  const interval = document.createElement("span");
  interval.className = "summary-interval";
  interval.textContent = `${state.updateIntervalMinutes}분 주기`;

  summary.append(label, time, interval);
}

function switchTab(tabName, options = {}) {
  activeTabName = tabName === "alerts" ? "alerts" : "prices";
  const isAlerts = activeTabName === "alerts";

  priceTabButton?.classList.toggle("is-active", !isAlerts);
  alertsTabButton?.classList.toggle("is-active", isAlerts);
  priceTabPanel?.classList.toggle("hidden", isAlerts);
  alertsTabPanel?.classList.toggle("hidden", !isAlerts);

  closePanels();

  if (isAlerts) {
    renderAlertManager();
    if (options.openAlertForm) {
      showAlertForm(options.tickerId);
    }
  }
}

function getAlertRules(tickerId) {
  const rawRules = state.alertRules?.[tickerId];
  const list = Array.isArray(rawRules) ? rawRules : (rawRules ? [rawRules] : []);

  return list
    .filter((rule) => Number.isFinite(Number(rule?.targetPrice)))
    .sort((a, b) => Number(a.createdAt || a.updatedAt || 0) - Number(b.createdAt || b.updatedAt || 0));
}

function getEnabledAlertRules(tickerId) {
  return getAlertRules(tickerId).filter((rule) => rule.enabled);
}

function applyState(nextState) {
  state = {
    ...state,
    ...nextState
  };

  render();
}

function render() {
  isApplyingState = true;
  updateIntervalSelect.value = String(state.updateIntervalMinutes || 1);
  changeBasisSelect.value = makeChangeBasisSelectValue();
  if (!changeBasisSelect.value) {
    changeBasisSelect.value = "window:update_interval";
  }
  if (changeWindowSelect) {
    changeWindowSelect.value = String(state.changeWindow || "update_interval");
  }
  isApplyingState = false;

  const count = state.trackedTickers.length;
  limitText.textContent = `${count}/${state.maxTrackedTickers}`;
  if (addPanelButton) {
    addPanelButton.disabled = count >= state.maxTrackedTickers;
    addPanelButton.title = count >= state.maxTrackedTickers ? "최대 10개까지 추가할 수 있습니다." : "티커 추가";
  }

  if (orderPanelButton) {
    orderPanelButton.disabled = count < 2;
    orderPanelButton.title = count < 2 ? "티커가 2개 이상일 때 순서를 편집할 수 있습니다." : "티커 순서 편집";
  }

  renderSummary();

  if (!state.trackedTickers.length) {
    tickerList.innerHTML = `<div class="empty">상단의 [+] 버튼으로 티커를 추가하세요.</div>`;
    return;
  }

  tickerList.replaceChildren(
    ...state.trackedTickers.map((ticker, index) => createTickerRow(ticker, index))
  );

  renderAlertManager();
}

function togglePanel(panelName) {
  switchTab("prices");
  const shouldShowAdd = panelName === "add" && addTickerPanel.classList.contains("hidden");
  const shouldShowSettings = panelName === "settings" && settingsPanel.classList.contains("hidden");
  const shouldShowOrder = panelName === "order" && orderPanel.classList.contains("hidden");

  addTickerPanel.classList.toggle("hidden", !shouldShowAdd);
  settingsPanel.classList.toggle("hidden", !shouldShowSettings);
  orderPanel.classList.toggle("hidden", !shouldShowOrder);
  alertPanel.classList.add("hidden");

  if (shouldShowAdd) {
    searchInput.focus();
    performSearch();
  }

  if (shouldShowOrder) {
    startOrderEdit();
  }
}

function closePanels() {
  addTickerPanel.classList.add("hidden");
  settingsPanel.classList.add("hidden");
  orderPanel.classList.add("hidden");
  alertPanel.classList.add("hidden");
}

function formatMinutesLabel(minutes) {
  const value = Number(minutes);
  if (!Number.isFinite(value)) return "-";
  if (value === 60) return "1시간";
  if (value === 240) return "4시간";
  if (value === 1440) return "24시간";
  return `${value}분`;
}

function makeChangeBasisSelectValue() {
  if (state.changeBasis === "window") {
    return `window:${state.changeWindow || "update_interval"}`;
  }

  return state.changeBasis || "window:update_interval";
}

function parseChangeBasisSelection(value) {
  const selected = String(value || "window:update_interval");

  if (selected.startsWith("window:")) {
    const [, rawWindow = "update_interval"] = selected.split(":");
    return {
      changeBasis: "window",
      changeWindow: rawWindow === "update_interval" ? "update_interval" : Number(rawWindow)
    };
  }

  return {
    changeBasis: selected,
    changeWindow: state.changeWindow || "update_interval"
  };
}

function getWindowMinutes() {
  if (state.changeWindow === "update_interval") {
    return Number(state.updateIntervalMinutes || 1);
  }

  return Number(state.changeWindow || 1);
}

function getChangeBasisLabel() {
  switch (state.changeBasis) {
    case "24h":
      return "24시간";
    case "added":
      return "추가 대비";
    case "window":
    default:
      return `${formatMinutesLabel(getWindowMinutes())}봉`;
  }
}

function calculateChangePercent(currentPrice, referencePrice) {
  const current = toFiniteNumber(currentPrice);
  const reference = toFiniteNumber(referencePrice);

  if (!Number.isFinite(current) || !Number.isFinite(reference) || reference === 0) {
    return null;
  }

  return ((current - reference) / reference) * 100;
}

function getLatestPriceSample(cached) {
  const history = Array.isArray(cached.priceHistory) ? cached.priceHistory : [];
  const samples = history
    .map((sample) => ({
      price: Number(sample?.price),
      updatedAt: Number(sample?.updatedAt)
    }))
    .filter((sample) => Number.isFinite(sample.price) && Number.isFinite(sample.updatedAt))
    .sort((a, b) => a.updatedAt - b.updatedAt);

  return samples[samples.length - 1] || {
    price: toFiniteNumber(cached.price),
    updatedAt: toFiniteNumber(cached.updatedAt)
  };
}

function getStoredWindowReference(cached, minutes) {
  const reference = cached.windowReferences?.[String(minutes)];
  const referencePrice = toFiniteNumber(reference?.price);
  const referenceUpdatedAt = toFiniteNumber(reference?.candleClosedAt || reference?.updatedAt);

  if (referencePrice === null || referenceUpdatedAt === null) return null;

  return {
    price: referencePrice,
    updatedAt: referenceUpdatedAt,
    source: reference?.source || "previous_candle",
    candleOpenAt: toFiniteNumber(reference?.candleOpenAt)
  };
}

function isFreshWindowReference(reference, latestUpdatedAt, minutes) {
  const latest = toFiniteNumber(latestUpdatedAt);
  const windowMinutes = Number(minutes);

  if (!reference || latest === null || !Number.isFinite(windowMinutes)) return false;

  const ageMs = latest - reference.updatedAt;
  return ageMs >= -5 * 1000 && ageMs <= windowMinutes * ONE_MINUTE_MS + CANDLE_REFERENCE_STALE_GRACE_MS;
}

function findLocalHistoryReferenceSample(cached, latestUpdatedAt, minutes) {
  const latest = toFiniteNumber(latestUpdatedAt);
  const windowMinutes = Number(minutes);
  const history = Array.isArray(cached.priceHistory) ? cached.priceHistory : [];

  if (latest === null || !Number.isFinite(windowMinutes)) return null;

  const targetTime = latest - windowMinutes * ONE_MINUTE_MS;
  const samples = history
    .map((sample) => ({
      price: Number(sample?.price),
      updatedAt: Number(sample?.updatedAt)
    }))
    .filter((sample) => Number.isFinite(sample.price) && Number.isFinite(sample.updatedAt))
    .sort((a, b) => a.updatedAt - b.updatedAt);

  if (!samples.length) return null;

  let nearest = null;
  for (const sample of samples) {
    if (sample.updatedAt <= targetTime) {
      nearest = sample;
    } else {
      break;
    }
  }

  if (!nearest) return null;

  const maxDistanceMs = Math.max(2 * ONE_MINUTE_MS, Math.min(5 * ONE_MINUTE_MS, windowMinutes * ONE_MINUTE_MS));
  return Math.abs(nearest.updatedAt - targetTime) <= maxDistanceMs ? nearest : null;
}

function calculateWindowChangeMetrics(cached, minutes) {
  const windowMinutes = Number(minutes);
  const latest = getLatestPriceSample(cached);

  if (!Number.isFinite(latest.price) || !Number.isFinite(latest.updatedAt) || !Number.isFinite(windowMinutes)) {
    return { percent: null, referencePrice: null, referenceUpdatedAt: null };
  }

  const storedReference = getStoredWindowReference(cached, windowMinutes);

  if (isFreshWindowReference(storedReference, latest.updatedAt, windowMinutes)) {
    return {
      percent: calculateChangePercent(latest.price, storedReference.price),
      referencePrice: storedReference.price,
      referenceUpdatedAt: storedReference.updatedAt,
      referenceSource: storedReference.source,
      referenceCandleOpenAt: storedReference.candleOpenAt
    };
  }

  const fallbackReference = findLocalHistoryReferenceSample(cached, latest.updatedAt, windowMinutes);
  if (fallbackReference) {
    return {
      percent: calculateChangePercent(latest.price, fallbackReference.price),
      referencePrice: fallbackReference.price,
      referenceUpdatedAt: fallbackReference.updatedAt,
      referenceSource: "local_history"
    };
  }

  return { percent: null, referencePrice: null, referenceUpdatedAt: null };
}

function getReferencePriceFromPercent(currentPrice, changePercent) {
  const current = toFiniteNumber(currentPrice);
  const percent = toFiniteNumber(changePercent);

  if (!Number.isFinite(current) || !Number.isFinite(percent) || percent === -100) {
    return null;
  }

  const referencePrice = current / (1 + percent / 100);
  return Number.isFinite(referencePrice) ? referencePrice : null;
}

function getSelectedChangeMetrics(cached) {
  const latest = getLatestPriceSample(cached);

  switch (state.changeBasis) {
    case "24h": {
      const percent = toFiniteNumber(cached.changePercent24h);
      const directReferencePrice = toFiniteNumber(cached.referencePrice24h);
      const referencePrice = directReferencePrice !== null
        ? directReferencePrice
        : getReferencePriceFromPercent(latest.price, percent);

      return {
        percent,
        referencePrice,
        referenceUpdatedAt: toFiniteNumber(cached.referenceUpdatedAt24h),
        referenceSource: "24h"
      };
    }
    case "added":
      return {
        percent: toFiniteNumber(cached.changePercentSinceAdded),
        referencePrice: toFiniteNumber(cached.addedPrice),
        referenceUpdatedAt: toFiniteNumber(cached.addedAt),
        referenceSource: "added"
      };
    case "window":
    default:
      return calculateWindowChangeMetrics(cached, getWindowMinutes());
  }
}

function formatChangePercent(value) {
  const number = toFiniteNumber(value);

  if (number === null) return null;
  if (number > 0) return `▲ ${number.toFixed(2)}%`;
  if (number < 0) return `▼ ${Math.abs(number).toFixed(2)}%`;
  return "0.00%";
}

function createChangeElement(cached) {
  const metrics = getSelectedChangeMetrics(cached);
  const changePercent = toFiniteNumber(metrics.percent);
  const changeText = formatChangePercent(changePercent);
  const referencePrice = toFiniteNumber(metrics.referencePrice);

  const span = document.createElement("span");
  span.className = "change-inline";
  span.textContent = changeText ? `(${changeText})` : `(${getChangeBasisLabel()} 조회중)`;

  const referenceSourceLabel = metrics.referenceSource === "local_history" ? " · 임시 기준" : "";

  span.title = referencePrice !== null
    ? `${getChangeBasisLabel()} 기준 가격: ${formatPrice(referencePrice)}${metrics.referenceUpdatedAt ? ` · 기준시각 ${formatTime(metrics.referenceUpdatedAt)}` : ""}${referenceSourceLabel}`
    : `${getChangeBasisLabel()} 기준 가격을 조회하는 중입니다.`;
  span.classList.toggle("is-up", changePercent !== null && changePercent > 0);
  span.classList.toggle("is-down", changePercent !== null && changePercent < 0);
  span.classList.toggle("is-neutral", changePercent === null || changePercent === 0);
  return span;
}

function getAlertRule(tickerId) {
  return getEnabledAlertRules(tickerId)[0] || null;
}

function getAlertDirectionLabel(direction) {
  return direction === "below" ? "이하" : "이상";
}

function getAlertDirectionSymbol(direction) {
  return direction === "below" ? "≤" : "≥";
}

function getAlertRepeatLabel(repeat) {
  return repeat === "repeat" ? "반복" : "1회";
}

function createAlertSummaryElement(_ticker) {
  return null;
}

function setAlertStatus(message, isError = false) {
  alertStatus.textContent = message;
  alertStatus.classList.toggle("error-text", isError);
}

function getTickerById(tickerId) {
  return state.trackedTickers.find((ticker) => ticker.id === tickerId) || null;
}

function showAlertForm(tickerId) {
  const selectedTickerId = tickerId || alertTickerSelect?.value || selectedAlertTickerId || state.trackedTickers[0]?.id;
  const ticker = getTickerById(selectedTickerId);

  if (!ticker) {
    setAlertStatus("먼저 가격 탭에서 티커를 추가하세요.", true);
    return;
  }

  selectedAlertTickerId = ticker.id;
  if (alertTickerSelect) {
    alertTickerSelect.value = ticker.id;
  }

  const cached = state.priceCache[ticker.id] || {};
  alertTickerTitle.textContent = getTickerLabel(ticker);
  alertDirectionSelect.value = "above";
  alertTargetInput.value = Number.isFinite(Number(cached.price)) ? String(cached.price) : "";
  alertRepeatSelect.value = "once";
  setAlertStatus("목표 가격을 입력한 뒤 알림을 추가하세요.");
  alertPanel.classList.remove("hidden");
  alertTargetInput.focus();
  alertTargetInput.select();
}

function openAlertPanel(tickerId) {
  switchTab("alerts", {
    openAlertForm: true,
    tickerId
  });
}

function createMetaLine(ticker) {
  const meta = document.createElement("div");
  meta.className = "meta-line";

  const exchange = document.createElement("span");
  exchange.className = "exchange-pill";
  exchange.textContent = formatExchange(ticker.exchange);

  const market = document.createElement("span");
  market.className = "market-pill";
  market.textContent = formatMarketType(ticker.marketType);

  const symbol = document.createElement("span");
  symbol.className = "symbol";
  symbol.textContent = escapeText(ticker.symbol);

  meta.append(exchange, market, symbol);
  return meta;
}

function createTickerRow(ticker, index) {
  const cached = state.priceCache[ticker.id] || {};
  const row = document.createElement("div");
  row.className = "ticker-row";

  const info = document.createElement("div");
  const price = document.createElement("div");
  price.className = "price";

  const priceValue = document.createElement("span");
  priceValue.className = "price-value";
  priceValue.textContent = `${formatPrice(cached.price)} ${ticker.quoteAsset || ""}`.trim();
  price.append(priceValue);

  if (!cached.error) {
    price.append(document.createTextNode(" "), createChangeElement(cached));
  }

  const detail = document.createElement("div");
  detail.className = "price-detail";
  const showTickerUpdateTime = shouldShowTickerUpdateTime(cached);

  if (cached.error) {
    detail.classList.add("error-text");
    detail.textContent = cached.price
      ? `오류: ${cached.error} · 이전값 ${formatTime(cached.updatedAt)}`
      : `오류: ${cached.error}`;
  } else if (showTickerUpdateTime) {
    detail.textContent = `업데이트 ${formatTime(cached.updatedAt)}`;
  }

  const alertSummary = createAlertSummaryElement(ticker);
  info.append(createMetaLine(ticker), price);
  if (cached.error || showTickerUpdateTime) {
    info.append(detail);
  }
  if (alertSummary) info.append(alertSummary);

  const actions = document.createElement("div");
  actions.className = "row-actions";

  const isBadgeTicker = state.badgeTickerId === ticker.id;
  const isAlertEnabled = getEnabledAlertRules(ticker.id).length > 0;

  const badgeButton = document.createElement("button");
  badgeButton.className = "badge-button icon-action-button";
  badgeButton.type = "button";
  badgeButton.textContent = "📌";
  badgeButton.title = isBadgeTicker ? "현재 배지 티커" : "배지 티커로 설정";
  badgeButton.setAttribute("aria-label", badgeButton.title);
  badgeButton.classList.toggle("is-active", isBadgeTicker);
  badgeButton.addEventListener("click", () => setBadgeTicker(ticker.id));

  const alertButton = document.createElement("button");
  alertButton.className = "alert-button icon-action-button";
  alertButton.type = "button";
  alertButton.textContent = "🔔";
  alertButton.title = isAlertEnabled ? `가격 알림 ${getEnabledAlertRules(ticker.id).length}개` : "가격 알림 추가";
  alertButton.setAttribute("aria-label", alertButton.title);
  alertButton.classList.toggle("is-active", isAlertEnabled);
  alertButton.addEventListener("click", () => openAlertPanel(ticker.id));

  const removeButton = document.createElement("button");
  removeButton.className = "remove-button icon-action-button";
  removeButton.type = "button";
  removeButton.textContent = "🗑️";
  removeButton.title = "티커 삭제";
  removeButton.setAttribute("aria-label", removeButton.title);
  removeButton.addEventListener("click", () => removeTicker(ticker.id));

  actions.append(badgeButton, alertButton, removeButton);
  row.append(info, actions);

  return row;
}

function renderSearchResults(items) {
  const isFull = state.trackedTickers.length >= state.maxTrackedTickers;
  const trackedIds = new Set(state.trackedTickers.map((ticker) => ticker.id));

  if (!items.length) {
    searchResults.innerHTML = "";
    searchStatus.textContent = "검색 결과가 없습니다.";
    return;
  }

  searchStatus.textContent = `${items.length}개 결과`;
  searchResults.replaceChildren(
    ...items.map((item) => {
      const row = document.createElement("div");
      row.className = "search-result";

      const info = document.createElement("div");
      const detail = document.createElement("div");
      detail.className = "price-detail";
      detail.textContent = `${item.baseAsset || ""}/${item.quoteAsset || ""}`.replace(/\/$/, "");

      info.append(createMetaLine(item), detail);

      const button = document.createElement("button");
      button.className = "add-button";
      button.type = "button";
      button.textContent = trackedIds.has(item.id) ? "✓" : "+";
      button.title = trackedIds.has(item.id) ? "이미 추가됨" : "티커 추가";
      button.disabled = trackedIds.has(item.id) || isFull;
      button.addEventListener("click", () => addTicker(item));

      row.append(info, button);
      return row;
    })
  );
}

function needsActiveWindowBackfill() {
  if (state.changeBasis !== "window") return false;

  const minutes = getWindowMinutes();
  if (!Number.isFinite(minutes)) return false;

  return state.trackedTickers.some((ticker) => {
    const cached = state.priceCache?.[ticker.id];
    if (!cached || !Number.isFinite(Number(cached.price))) return false;

    const latest = getLatestPriceSample(cached);
    const reference = getStoredWindowReference(cached, minutes);
    return !isFreshWindowReference(reference, latest.updatedAt, minutes);
  });
}

async function backfillWindowReferencesIfNeeded() {
  if (isBackfillingWindowReferences || !needsActiveWindowBackfill()) return;

  isBackfillingWindowReferences = true;
  try {
    const response = await sendMessage({ type: "BACKFILL_WINDOW_REFERENCES" });
    applyState(response);
  } catch (error) {
    console.warn("Window reference backfill failed", error);
  } finally {
    isBackfillingWindowReferences = false;
  }
}

async function loadState() {
  setLoading(true);

  try {
    const response = await sendMessage({ type: "GET_STATE" });
    applyState(response);
    setSettingsStatus("저장됨");
    backfillWindowReferencesIfNeeded();
  } catch (error) {
    summary.textContent = error.message;
  } finally {
    setLoading(false);
  }
}

async function refreshPrices() {
  const remainingMs = nextManualRefreshAt - Date.now();
  if (remainingMs > 0) {
    const seconds = Math.ceil(remainingMs / 1000);
    showToast(`원활한 API 통신을 위해 ${seconds}초 후 다시 시도해주세요.`);
    refreshButton.title = `원활한 API 통신을 위해 ${seconds}초 후 다시 시도해주세요.`;
    return;
  }

  setRefreshButtonCooldown();
  setLoading(true);

  try {
    const response = await sendMessage({ type: "REFRESH_PRICES" });
    applyState(response);
    backfillWindowReferencesIfNeeded();
  } catch (error) {
    summary.textContent = error.message;
  } finally {
    setLoading(false);
  }
}

async function saveSettings() {
  if (isApplyingState) return;

  setSettingsStatus("저장 중...");

  try {
    const response = await sendMessage({
      type: "UPDATE_SETTINGS",
      settings: {
        updateIntervalMinutes: Number(updateIntervalSelect.value),
        ...parseChangeBasisSelection(changeBasisSelect.value)
      }
    });

    applyState(response);
    setSettingsStatus("저장됨");
    backfillWindowReferencesIfNeeded();
  } catch (error) {
    setSettingsStatus(error.message, true);
  }
}

function getTickerLabel(ticker) {
  return `${formatExchange(ticker.exchange)} ${formatMarketType(ticker.marketType)} ${ticker.symbol}`;
}

function renderAlertTickerOptions() {
  if (!alertTickerSelect) return;

  const currentValue = alertTickerSelect.value || selectedAlertTickerId || state.trackedTickers[0]?.id || "";
  alertTickerSelect.replaceChildren(
    ...state.trackedTickers.map((ticker) => {
      const option = document.createElement("option");
      option.value = ticker.id;
      option.textContent = getTickerLabel(ticker);
      return option;
    })
  );

  if (state.trackedTickers.some((ticker) => ticker.id === currentValue)) {
    alertTickerSelect.value = currentValue;
  } else if (state.trackedTickers[0]) {
    alertTickerSelect.value = state.trackedTickers[0].id;
  }

  selectedAlertTickerId = alertTickerSelect.value || null;

  const selectedTicker = getTickerById(selectedAlertTickerId);
  if (selectedTicker) {
    alertTickerTitle.textContent = getTickerLabel(selectedTicker);
  }
}

function getAllAlertItems() {
  return state.trackedTickers.flatMap((ticker) => (
    getAlertRules(ticker.id).map((rule) => ({ ticker, rule }))
  ));
}

function createAlertListRow(ticker, rule) {
  const row = document.createElement("div");
  row.className = "alert-list-row";

  const info = document.createElement("div");
  const title = document.createElement("div");
  title.className = "alert-list-title";
  title.textContent = `${getTickerLabel(ticker)} · ${getAlertDirectionSymbol(rule.direction)} ${formatPrice(rule.targetPrice)}`;

  const meta = document.createElement("div");
  meta.className = "price-detail";
  const status = rule.enabled ? "켜짐" : "꺼짐";
  const notified = rule.lastNotifiedAt ? ` · 최근 알림 ${formatTime(rule.lastNotifiedAt)}` : "";
  meta.textContent = `${getAlertRepeatLabel(rule.repeat)} · ${status}${notified}`;

  info.append(title, meta);

  const actions = document.createElement("div");
  actions.className = "alert-list-actions";

  const toggleButton = document.createElement("button");
  toggleButton.className = rule.enabled ? "neutral-button compact-button" : "save-button compact-button";
  toggleButton.type = "button";
  toggleButton.textContent = rule.enabled ? "끄기" : "켜기";
  toggleButton.addEventListener("click", () => toggleAlertRule(ticker.id, rule));

  const deleteButton = document.createElement("button");
  deleteButton.className = "remove-button icon-action-button";
  deleteButton.type = "button";
  deleteButton.textContent = "🗑️";
  deleteButton.title = "알림 삭제";
  deleteButton.addEventListener("click", () => deleteAlertRule(ticker.id, rule.id));

  actions.append(toggleButton, deleteButton);
  row.append(info, actions);

  return row;
}

function renderAlertManager() {
  renderAlertTickerOptions();

  const allAlerts = getAllAlertItems();
  if (alertCountText) {
    alertCountText.textContent = `${allAlerts.length}개`;
  }

  if (!alertList) return;

  if (!state.trackedTickers.length) {
    alertList.innerHTML = `<div class="empty">먼저 가격 탭에서 티커를 추가하세요.</div>`;
    return;
  }

  if (!allAlerts.length) {
    alertList.innerHTML = `<div class="empty">등록된 알림이 없습니다.</div>`;
    return;
  }

  alertList.replaceChildren(
    ...allAlerts.map(({ ticker, rule }) => createAlertListRow(ticker, rule))
  );
}

async function saveAlertRule() {
  const tickerId = alertTickerSelect?.value || selectedAlertTickerId;
  if (!tickerId) {
    setAlertStatus("알림을 추가할 티커를 선택하세요.", true);
    return;
  }

  const currentRules = getAlertRules(tickerId);
  if (currentRules.length >= Number(state.maxAlertsPerTicker || 20)) {
    setAlertStatus(`티커당 최대 ${state.maxAlertsPerTicker || 20}개까지 등록할 수 있습니다.`, true);
    return;
  }

  setAlertStatus("저장 중...");
  setLoading(true);

  try {
    const response = await sendMessage({
      type: "UPDATE_ALERT_RULE",
      tickerId,
      rule: {
        enabled: true,
        direction: alertDirectionSelect.value,
        targetPrice: Number(alertTargetInput.value),
        repeat: alertRepeatSelect.value
      }
    });

    applyState(response);
    selectedAlertTickerId = tickerId;
    if (alertTickerSelect) {
      alertTickerSelect.value = tickerId;
    }
    alertTargetInput.value = "";
    alertPanel.classList.add("hidden");
    renderAlertManager();
    showToast("알림이 추가되었습니다.");
    setAlertStatus("알림 추가됨");
  } catch (error) {
    setAlertStatus(error.message, true);
  } finally {
    setLoading(false);
  }
}

async function toggleAlertRule(tickerId, rule) {
  setLoading(true);

  try {
    const response = await sendMessage({
      type: "UPDATE_ALERT_RULE",
      tickerId,
      rule: {
        ...rule,
        enabled: !rule.enabled
      }
    });

    applyState(response);
    setAlertStatus(rule.enabled ? "알림 꺼짐" : "알림 켜짐");
  } catch (error) {
    setAlertStatus(error.message, true);
  } finally {
    setLoading(false);
  }
}

async function deleteAlertRule(tickerId, alertId) {
  setLoading(true);

  try {
    const response = await sendMessage({
      type: "DELETE_ALERT_RULE",
      tickerId,
      alertId
    });

    applyState(response);
    setAlertStatus("알림 삭제됨");
  } catch (error) {
    setAlertStatus(error.message, true);
  } finally {
    setLoading(false);
  }
}

async function disableAlertRule() {
  const tickerId = alertTickerSelect?.value || selectedAlertTickerId;
  const firstRule = getAlertRules(tickerId)[0];
  if (!tickerId || !firstRule) return;
  await toggleAlertRule(tickerId, firstRule);
}

async function performSearch() {
  const query = searchInput.value.trim();
  const exchange = exchangeSelect.value;
  const marketType = marketTypeSelect.value;

  if (!query) {
    searchResults.innerHTML = "";
    searchStatus.textContent = "검색어를 입력하면 추가 가능한 티커가 표시됩니다.";
    return;
  }

  const requestId = ++lastSearchRequestId;
  searchStatus.textContent = "검색 중...";

  try {
    const response = await sendMessage({
      type: "SEARCH_TICKERS",
      exchange,
      marketType,
      query
    });

    if (requestId !== lastSearchRequestId) return;
    renderSearchResults(response.items || []);
  } catch (error) {
    if (requestId !== lastSearchRequestId) return;
    searchResults.innerHTML = "";
    searchStatus.textContent = error.message;
  }
}

function scheduleSearch() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(performSearch, 250);
}


function startOrderEdit() {
  orderDraftTickers = state.trackedTickers.map((ticker) => ({ ...ticker }));
  draggedOrderTickerId = null;
  setOrderStatus("드래그해서 순서를 바꾼 뒤 확인을 누르면 저장됩니다.");
  renderOrderList();
}

function setOrderStatus(message, isError = false) {
  orderStatus.textContent = message;
  orderStatus.classList.toggle("error-text", isError);
}

function renderOrderList() {
  if (!orderDraftTickers.length) {
    orderList.innerHTML = `<div class="empty">정렬할 티커가 없습니다.</div>`;
    return;
  }

  orderList.replaceChildren(
    ...orderDraftTickers.map((ticker, index) => {
      const row = document.createElement("div");
      row.className = "order-edit-row";
      row.draggable = true;
      row.dataset.tickerId = ticker.id;

      const indexBadge = document.createElement("span");
      indexBadge.className = "order-index";
      indexBadge.textContent = String(index + 1);

      const info = document.createElement("div");
      info.append(createMetaLine(ticker));

      const dragHandle = document.createElement("span");
      dragHandle.className = "order-drag-handle";
      dragHandle.textContent = "☰";
      dragHandle.title = "드래그해서 순서 변경";
      dragHandle.setAttribute("aria-label", "드래그해서 순서 변경");

      row.addEventListener("dragstart", (event) => {
        draggedOrderTickerId = ticker.id;
        row.classList.add("is-dragging");

        if (event.dataTransfer) {
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", ticker.id);
        }
      });

      row.addEventListener("dragend", () => {
        draggedOrderTickerId = null;
        orderList.querySelectorAll(".order-edit-row").forEach((item) => {
          item.classList.remove("is-dragging", "is-drop-target");
        });
      });

      row.addEventListener("dragover", (event) => {
        event.preventDefault();
        if (ticker.id !== draggedOrderTickerId) {
          row.classList.add("is-drop-target");
        }
        if (event.dataTransfer) {
          event.dataTransfer.dropEffect = "move";
        }
      });

      row.addEventListener("dragleave", () => {
        row.classList.remove("is-drop-target");
      });

      row.addEventListener("drop", (event) => {
        event.preventDefault();
        row.classList.remove("is-drop-target");

        const draggedId = event.dataTransfer?.getData("text/plain") || draggedOrderTickerId;
        const rect = row.getBoundingClientRect();
        const placeAfter = event.clientY > rect.top + rect.height / 2;
        moveDraggedOrderTicker(draggedId, ticker.id, placeAfter);
      });

      row.append(indexBadge, info, dragHandle);
      return row;
    })
  );
}

function moveDraggedOrderTicker(draggedId, targetId, placeAfter = false) {
  if (!draggedId || !targetId || draggedId === targetId) return;

  const fromIndex = orderDraftTickers.findIndex((ticker) => ticker.id === draggedId);
  const targetIndex = orderDraftTickers.findIndex((ticker) => ticker.id === targetId);

  if (fromIndex === -1 || targetIndex === -1) return;

  const nextOrder = [...orderDraftTickers];
  const [draggedTicker] = nextOrder.splice(fromIndex, 1);
  let insertIndex = targetIndex + (placeAfter ? 1 : 0);

  if (fromIndex < insertIndex) {
    insertIndex -= 1;
  }

  nextOrder.splice(insertIndex, 0, draggedTicker);
  orderDraftTickers = nextOrder;

  setOrderStatus("변경 사항이 아직 저장되지 않았습니다.");
  renderOrderList();
}

async function saveTickerOrder() {
  setLoading(true);

  try {
    const response = await sendMessage({
      type: "REORDER_TICKERS",
      tickerIds: orderDraftTickers.map((ticker) => ticker.id)
    });
    applyState(response);
    closePanels();
  } catch (error) {
    setOrderStatus(
      error.message === "Unknown message type"
        ? "백그라운드가 이전 버전입니다. 확장 프로그램을 Reload한 뒤 다시 시도하세요."
        : error.message,
      true
    );
  } finally {
    setLoading(false);
  }
}

function cancelOrderEdit() {
  orderDraftTickers = [];
  closePanels();
}

async function addTicker(item) {
  setLoading(true);

  try {
    const response = await sendMessage({
      type: "ADD_TICKER",
      ticker: item
    });
    applyState(response);
    await performSearch();
  } catch (error) {
    searchStatus.textContent = error.message;
  } finally {
    setLoading(false);
  }
}

async function removeTicker(tickerId) {
  setLoading(true);

  try {
    const response = await sendMessage({
      type: "REMOVE_TICKER",
      tickerId
    });
    applyState(response);
    await performSearch();
  } catch (error) {
    summary.textContent = error.message;
  } finally {
    setLoading(false);
  }
}

async function setBadgeTicker(tickerId) {
  setLoading(true);

  try {
    const response = await sendMessage({
      type: "SET_BADGE_TICKER",
      tickerId
    });
    applyState(response);
  } catch (error) {
    summary.textContent = error.message;
  } finally {
    setLoading(false);
  }
}

async function moveTicker(tickerId, direction) {
  setLoading(true);

  try {
    const response = await sendMessage({
      type: "MOVE_TICKER",
      tickerId,
      direction
    });
    applyState(response);
  } catch (error) {
    summary.textContent = error.message;
  } finally {
    setLoading(false);
  }
}

searchInput.addEventListener("input", scheduleSearch);
exchangeSelect.addEventListener("change", performSearch);
marketTypeSelect.addEventListener("change", performSearch);
refreshButton.addEventListener("click", refreshPrices);
addPanelButton?.addEventListener("click", () => togglePanel("add"));
settingsPanelButton.addEventListener("click", () => togglePanel("settings"));
orderPanelButton.addEventListener("click", () => togglePanel("order"));
closeAddPanelButton.addEventListener("click", closePanels);
closeSettingsButton.addEventListener("click", closePanels);
closeOrderButton.addEventListener("click", cancelOrderEdit);
saveOrderButton.addEventListener("click", saveTickerOrder);
cancelOrderButton.addEventListener("click", cancelOrderEdit);
closeAlertButton?.addEventListener("click", () => alertPanel.classList.add("hidden"));
updateIntervalSelect.addEventListener("change", saveSettings);
changeBasisSelect.addEventListener("change", saveSettings);
changeWindowSelect?.addEventListener("change", saveSettings);
saveAlertButton.addEventListener("click", saveAlertRule);
priceTabButton?.addEventListener("click", () => switchTab("prices"));
alertsTabButton?.addEventListener("click", () => switchTab("alerts"));
showAlertFormButton?.addEventListener("click", () => {
  switchTab("alerts", {
    openAlertForm: true,
    tickerId: alertTickerSelect?.value || selectedAlertTickerId || state.trackedTickers[0]?.id
  });
});
cancelAlertButton?.addEventListener("click", () => alertPanel.classList.add("hidden"));
alertTickerSelect?.addEventListener("change", () => {
  selectedAlertTickerId = alertTickerSelect.value;
  const ticker = getTickerById(selectedAlertTickerId);
  const cached = state.priceCache[selectedAlertTickerId] || {};
  alertTickerTitle.textContent = ticker ? getTickerLabel(ticker) : "티커별 목표 가격을 설정합니다.";
  if (!alertTargetInput.value && Number.isFinite(Number(cached.price))) {
    alertTargetInput.value = String(cached.price);
  }
});

document.addEventListener("DOMContentLoaded", loadState);
