const MAX_TRACKED_TICKERS = 10;
const MAX_ALERTS_PER_TICKER = 20;
const PRICE_ALARM_NAME = "update-crypto-prices";
const INSTRUMENT_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const PRICE_HISTORY_RETENTION_MS = 25 * 60 * 60 * 1000;
const PRICE_HISTORY_MAX_POINTS = 300;
const ALERT_REPEAT_OPTIONS = ["once", "repeat"];
const ALERT_DIRECTION_OPTIONS = ["above", "below"];

const DEFAULT_UPDATE_INTERVAL_MINUTES = 1;
const UPDATE_INTERVAL_OPTIONS = [1, 3, 5, 15, 30];

const DEFAULT_CHANGE_BASIS = "window";
const CHANGE_BASIS_OPTIONS = ["window", "added"];
const DEFAULT_CHANGE_WINDOW = "update_interval";
const CHANGE_WINDOW_OPTIONS = ["update_interval", 1, 3, 5, 15, 30, 60, 240, 1440];
const CANDLE_WINDOW_OPTIONS = [1, 3, 5, 15, 30, 60, 240, 1440];
const ONE_MINUTE_MS = 60 * 1000;
const CANDLE_REFERENCE_STALE_GRACE_MS = 2 * ONE_MINUTE_MS;

const DEFAULT_TICKERS = [
  {
    id: "okx:futures:ETH-USDT-SWAP",
    exchange: "okx",
    marketType: "futures",
    symbol: "ETH-USDT-SWAP",
    label: "ETH-USDT-SWAP",
    market: "Futures",
    baseAsset: "ETH",
    quoteAsset: "USDT"
  }
];

const DEFAULT_BADGE_TICKER_ID = DEFAULT_TICKERS[0].id;

function normalizeExchange(exchange) {
  const value = String(exchange || "").toLowerCase();
  if (value !== "okx" && value !== "binance") {
    throw new Error("Unsupported exchange");
  }
  return value;
}

function normalizeSearchMarketType(value) {
  const normalized = String(value || "all").toLowerCase();
  return ["all", "spot", "futures"].includes(normalized) ? normalized : "all";
}

function normalizeMarketType(value) {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "spot") return "spot";
  if (normalized === "future" || normalized === "futures" || normalized === "swap") return "futures";
  throw new Error("Unsupported market type");
}

function inferMarketType(exchange, symbol, extra = {}) {
  try {
    return normalizeMarketType(extra.marketType);
  } catch (_) {
    // Continue with legacy fields.
  }

  const market = String(extra.market || "").toLowerCase();
  if (market.includes("spot") || market.includes("현물")) return "spot";
  if (market.includes("future") || market.includes("swap") || market.includes("선물")) return "futures";

  const normalizedSymbol = normalizeSymbol(symbol);
  if (exchange === "okx" && normalizedSymbol.endsWith("-SWAP")) return "futures";

  // v0.3.x only supported OKX swap and Binance futures, so legacy entries default to futures.
  return "futures";
}

function normalizeSymbol(symbol) {
  return String(symbol || "").trim().toUpperCase();
}

function normalizeUpdateIntervalMinutes(value) {
  const interval = Number(value);
  return UPDATE_INTERVAL_OPTIONS.includes(interval)
    ? interval
    : DEFAULT_UPDATE_INTERVAL_MINUTES;
}

function normalizeChangeBasis(value) {
  if (["update_interval", "last_update", "24h", "1m", "3m", "5m", "15m", "30m", "1h", "4h", "1d", "60m", "240m", "1440m"].includes(String(value).toLowerCase())) {
    return "window";
  }

  return CHANGE_BASIS_OPTIONS.includes(value) ? value : DEFAULT_CHANGE_BASIS;
}

function getLegacyChangeWindowMinutes(legacyChangeBasis) {
  const legacy = String(legacyChangeBasis || "").toLowerCase();

  if (legacy === "24h" || legacy === "1d") return 1440;
  if (legacy === "1h") return 60;
  if (legacy === "4h") return 240;

  const match = legacy.match(/^(\d+)m$/);
  if (match) {
    const legacyMinutes = Number(match[1]);
    return CHANGE_WINDOW_OPTIONS.includes(legacyMinutes) ? legacyMinutes : null;
  }

  return null;
}

function normalizeChangeWindow(value, legacyChangeBasis) {
  const legacyWindowMinutes = getLegacyChangeWindowMinutes(legacyChangeBasis);

  // Older versions stored the concrete candle basis in changeBasis, while
  // changeWindow often stayed as "update_interval". Preserve the concrete
  // legacy candle selection during migration.
  if (legacyWindowMinutes !== null && (value === undefined || value === null || value === "" || value === "update_interval")) {
    return legacyWindowMinutes;
  }

  if (value === "update_interval") return "update_interval";

  const numericValue = Number(value);
  if (CHANGE_WINDOW_OPTIONS.includes(numericValue)) return numericValue;

  const legacy = String(legacyChangeBasis || "").toLowerCase();

  if (legacy === "update_interval" || legacy === "last_update") {
    return "update_interval";
  }

  return legacyWindowMinutes ?? DEFAULT_CHANGE_WINDOW;
}

function makeTickerId(exchange, marketType, symbol) {
  return `${normalizeExchange(exchange)}:${normalizeMarketType(marketType)}:${normalizeSymbol(symbol)}`;
}

function buildTicker(exchange, symbol, extra = {}) {
  const normalizedExchange = normalizeExchange(exchange);
  const normalizedSymbol = normalizeSymbol(symbol);
  const marketType = inferMarketType(normalizedExchange, normalizedSymbol, extra);

  if (!normalizedSymbol) {
    throw new Error("Ticker symbol is required");
  }

  return {
    id: makeTickerId(normalizedExchange, marketType, normalizedSymbol),
    exchange: normalizedExchange,
    marketType,
    symbol: normalizedSymbol,
    label: extra.label || normalizedSymbol,
    market: marketType === "spot" ? "Spot" : "Futures",
    baseAsset: extra.baseAsset || inferBaseAsset(normalizedExchange, normalizedSymbol, marketType),
    quoteAsset: extra.quoteAsset || inferQuoteAsset(normalizedExchange, normalizedSymbol, marketType)
  };
}

function inferBaseAsset(exchange, symbol, marketType) {
  if (exchange === "okx") {
    return symbol.split("-")[0] || "";
  }

  const quoteAsset = inferQuoteAsset(exchange, symbol, marketType);
  return quoteAsset && symbol.endsWith(quoteAsset)
    ? symbol.slice(0, -quoteAsset.length)
    : "";
}

function inferQuoteAsset(exchange, symbol) {
  if (exchange === "okx") {
    const parts = symbol.split("-");
    return parts[1] || "";
  }

  const knownQuotes = ["USDT", "USDC", "FDUSD", "BUSD", "BTC", "ETH", "BNB", "TRY", "EUR"];
  return knownQuotes.find((quote) => symbol.endsWith(quote)) || "";
}

function normalizeStoredTickers(tickers) {
  const seen = new Set();
  const result = [];
  const idMap = new Map();

  for (const ticker of tickers || []) {
    try {
      const normalized = buildTicker(ticker.exchange, ticker.symbol, ticker);
      if (seen.has(normalized.id)) continue;
      seen.add(normalized.id);
      result.push(normalized);
      if (ticker.id && ticker.id !== normalized.id) {
        idMap.set(ticker.id, normalized.id);
      }
    } catch (_) {
      // Ignore malformed stored entries.
    }
  }

  return {
    tickers: result.slice(0, MAX_TRACKED_TICKERS),
    idMap
  };
}

function migratePriceCache(priceCache = {}, idMap = new Map()) {
  const migrated = { ...priceCache };

  for (const [oldId, newId] of idMap.entries()) {
    if (migrated[oldId] && !migrated[newId]) {
      migrated[newId] = {
        ...migrated[oldId],
        id: newId
      };
    }
    delete migrated[oldId];
  }

  return migrated;
}

function createAlertRuleId() {
  return `alert:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeAlertRule(rule = {}) {
  const targetPrice = Number(rule.targetPrice);
  const direction = ALERT_DIRECTION_OPTIONS.includes(rule.direction)
    ? rule.direction
    : "above";
  const repeat = ALERT_REPEAT_OPTIONS.includes(rule.repeat)
    ? rule.repeat
    : "once";
  const enabled = Boolean(rule.enabled) && Number.isFinite(targetPrice) && targetPrice > 0;

  return {
    id: rule.id || createAlertRuleId(),
    enabled,
    direction,
    targetPrice: Number.isFinite(targetPrice) && targetPrice > 0 ? targetPrice : null,
    repeat,
    triggered: Boolean(rule.triggered),
    lastConditionMet: typeof rule.lastConditionMet === "boolean" ? rule.lastConditionMet : false,
    lastNotifiedAt: Number.isFinite(Number(rule.lastNotifiedAt)) ? Number(rule.lastNotifiedAt) : null,
    createdAt: Number.isFinite(Number(rule.createdAt)) ? Number(rule.createdAt) : Date.now(),
    updatedAt: Number.isFinite(Number(rule.updatedAt)) ? Number(rule.updatedAt) : Date.now()
  };
}

function normalizeAlertRuleList(rawRules = []) {
  const list = Array.isArray(rawRules)
    ? rawRules
    : (rawRules && typeof rawRules === "object" && (
        Object.prototype.hasOwnProperty.call(rawRules, "targetPrice") ||
        Object.prototype.hasOwnProperty.call(rawRules, "enabled") ||
        Object.prototype.hasOwnProperty.call(rawRules, "direction")
      )
        ? [rawRules]
        : []);

  const seen = new Set();
  const normalized = [];

  for (const rawRule of list) {
    const rule = normalizeAlertRule(rawRule);
    if (seen.has(rule.id)) continue;
    if (rule.targetPrice === null && !rule.enabled) continue;
    seen.add(rule.id);
    normalized.push(rule);
  }

  return normalized.slice(0, MAX_ALERTS_PER_TICKER);
}

function normalizeAlertRules(alertRules = {}, trackedTickers = [], idMap = new Map()) {
  const allowedIds = new Set(trackedTickers.map((ticker) => ticker.id));
  const normalized = {};

  for (const [rawId, rawRules] of Object.entries(alertRules || {})) {
    const tickerId = idMap.get(rawId) || rawId;
    if (!allowedIds.has(tickerId)) continue;

    const ruleList = normalizeAlertRuleList(rawRules);
    if (ruleList.length) {
      normalized[tickerId] = ruleList;
    }
  }

  return normalized;
}

function buildUpdatedAlertRule(input = {}, previousRule = {}) {
  const now = Date.now();
  const previous = previousRule ? normalizeAlertRule(previousRule) : {};
  const direction = ALERT_DIRECTION_OPTIONS.includes(input.direction)
    ? input.direction
    : (previous.direction || "above");
  const repeat = ALERT_REPEAT_OPTIONS.includes(input.repeat)
    ? input.repeat
    : (previous.repeat || "once");
  const targetPrice = Number(input.targetPrice);
  const enabled = Boolean(input.enabled);

  if (enabled && (!Number.isFinite(targetPrice) || targetPrice <= 0)) {
    throw new Error("Alert target price must be greater than 0");
  }

  const previousTargetPrice = Number(previous.targetPrice);
  const thresholdChanged = (
    Number(previousTargetPrice) !== targetPrice ||
    previous.direction !== direction ||
    previous.repeat !== repeat
  );

  if (!enabled) {
    return {
      ...previous,
      id: input.id || previous.id || createAlertRuleId(),
      enabled: false,
      direction,
      targetPrice: Number.isFinite(targetPrice) && targetPrice > 0 ? targetPrice : previous.targetPrice,
      repeat,
      updatedAt: now
    };
  }

  return {
    id: input.id || previous.id || createAlertRuleId(),
    enabled: true,
    direction,
    targetPrice,
    repeat,
    triggered: thresholdChanged ? false : Boolean(previous.triggered),
    lastConditionMet: thresholdChanged ? false : Boolean(previous.lastConditionMet),
    lastNotifiedAt: thresholdChanged ? null : (previous.lastNotifiedAt || null),
    createdAt: previous.createdAt || now,
    updatedAt: now
  };
}

function buildNextAlertRuleList(input = {}, previousRules = []) {
  const previousList = normalizeAlertRuleList(previousRules);
  const targetId = input.id || null;
  const previousIndex = targetId
    ? previousList.findIndex((rule) => rule.id === targetId)
    : -1;

  if (previousIndex === -1 && previousList.length >= MAX_ALERTS_PER_TICKER) {
    throw new Error(`A ticker can have up to ${MAX_ALERTS_PER_TICKER} alerts`);
  }

  const previousRule = previousIndex >= 0 ? previousList[previousIndex] : {};
  const nextRule = buildUpdatedAlertRule(input, previousRule);

  if (previousIndex >= 0) {
    return previousList.map((rule, index) => index === previousIndex ? nextRule : rule);
  }

  return [...previousList, nextRule];
}

async function getStoredState() {
  const stored = await chrome.storage.local.get([
    "trackedTickers",
    "badgeTickerId",
    "priceCache",
    "lastUpdatedAt",
    "updateIntervalMinutes",
    "changeBasis",
    "changeWindow",
    "alertRules"
  ]);

  let { tickers: trackedTickers, idMap } = normalizeStoredTickers(stored.trackedTickers);
  let priceCache = migratePriceCache(stored.priceCache || {}, idMap);
  let badgeTickerId = idMap.get(stored.badgeTickerId) || stored.badgeTickerId;
  const updateIntervalMinutes = normalizeUpdateIntervalMinutes(stored.updateIntervalMinutes);
  const changeBasis = normalizeChangeBasis(stored.changeBasis);
  const changeWindow = normalizeChangeWindow(stored.changeWindow, stored.changeBasis);

  if (!trackedTickers.length) {
    trackedTickers = DEFAULT_TICKERS;
  }

  if (!trackedTickers.some((ticker) => ticker.id === badgeTickerId)) {
    badgeTickerId = trackedTickers[0]?.id || DEFAULT_BADGE_TICKER_ID;
  }

  const alertRules = normalizeAlertRules(stored.alertRules || {}, trackedTickers, idMap);

  await chrome.storage.local.set({
    trackedTickers,
    badgeTickerId,
    priceCache,
    updateIntervalMinutes,
    changeBasis,
    changeWindow,
    alertRules
  });

  return {
    trackedTickers,
    badgeTickerId,
    priceCache,
    alertRules,
    lastUpdatedAt: stored.lastUpdatedAt || null,
    updateIntervalMinutes,
    changeBasis,
    changeWindow
  };
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    const error = new Error(`HTTP ${response.status}`);
    error.status = response.status;
    error.url = url;
    throw error;
  }

  return response.json();
}

function isRateLimitError(error) {
  return Number(error?.status) === 429 || String(error?.message || "").includes("HTTP 429");
}

function hasUsableCachedPrice(entry) {
  return Number.isFinite(Number(entry?.price)) && Number.isFinite(Number(entry?.updatedAt));
}

function preserveCachedEntryOnRateLimit(ticker, previousEntry, error) {
  if (!hasUsableCachedPrice(previousEntry)) return null;

  return {
    ...ticker,
    ...previousEntry,
    error: null,
    rateLimitedAt: Date.now(),
    lastRateLimitMessage: error?.message || "HTTP 429"
  };
}

function assertFinitePrice(value, label) {
  const price = Number(value);

  if (!Number.isFinite(price)) {
    throw new Error(`Invalid price response: ${label}`);
  }

  return price;
}

function calculateChangePercent(currentPrice, referencePrice) {
  const current = Number(currentPrice);
  const reference = Number(referencePrice);

  if (!Number.isFinite(current) || !Number.isFinite(reference) || reference === 0) {
    return null;
  }

  return ((current - reference) / reference) * 100;
}

function getKlineInterval(exchange, minutes) {
  const value = Number(minutes);

  if (!CANDLE_WINDOW_OPTIONS.includes(value)) {
    throw new Error(`Unsupported candle window: ${minutes}`);
  }

  if (value < 60) return `${value}m`;

  const normalizedExchange = normalizeExchange(exchange);

  if (normalizedExchange === "okx") {
    if (value === 60) return "1H";
    if (value === 240) return "4H";
    if (value === 1440) return "1D";
  }

  if (value === 60) return "1h";
  if (value === 240) return "4h";
  if (value === 1440) return "1d";

  throw new Error(`Unsupported candle window: ${minutes}`);
}

function getActiveChangeWindowMinutes(state) {
  if (state.changeBasis !== "window") return null;

  if (state.changeWindow === "update_interval") {
    return normalizeUpdateIntervalMinutes(state.updateIntervalMinutes);
  }

  const minutes = Number(state.changeWindow);
  return CANDLE_WINDOW_OPTIONS.includes(minutes) ? minutes : null;
}

function findWindowReferenceSample(entry, latestUpdatedAt, minutes) {
  const history = Array.isArray(entry?.priceHistory) ? entry.priceHistory : [];
  const latest = Number(latestUpdatedAt);
  const windowMinutes = Number(minutes);

  if (!Number.isFinite(latest) || !CANDLE_WINDOW_OPTIONS.includes(windowMinutes)) {
    return null;
  }

  const storedReference = normalizeWindowReferences(entry?.windowReferences || {})[String(windowMinutes)];
  if (storedReference) {
    return storedReference;
  }

  const targetTime = latest - windowMinutes * ONE_MINUTE_MS;
  const futureToleranceMs = 30 * 1000;
  const pastToleranceMs = Math.max(2 * ONE_MINUTE_MS, Math.min(5 * ONE_MINUTE_MS, windowMinutes * ONE_MINUTE_MS));
  let reference = null;

  for (const sample of history
    .map((item) => ({
      price: Number(item?.price),
      updatedAt: Number(item?.updatedAt)
    }))
    .filter((item) => Number.isFinite(item.price) && Number.isFinite(item.updatedAt))
    .sort((a, b) => a.updatedAt - b.updatedAt)) {
    if (sample.updatedAt > targetTime + futureToleranceMs) {
      break;
    }

    if (sample.updatedAt >= targetTime - pastToleranceMs) {
      reference = sample;
    }
  }

  return reference;
}

function hasFreshStoredWindowReference(entry, latestUpdatedAt, minutes) {
  const windowMinutes = Number(minutes);
  const latest = Number(latestUpdatedAt);

  if (!Number.isFinite(latest) || !CANDLE_WINDOW_OPTIONS.includes(windowMinutes)) {
    return false;
  }

  const storedReference = normalizeWindowReferences(entry?.windowReferences || {})[String(windowMinutes)];
  if (!storedReference) return false;

  const referenceTime = Number(storedReference.candleClosedAt || storedReference.updatedAt);
  if (!Number.isFinite(referenceTime)) return false;

  const ageMs = latest - referenceTime;
  const windowMs = windowMinutes * ONE_MINUTE_MS;

  // The exchange can confirm a new candle a little after the exact boundary.
  // Keep the latest completed-candle reference usable during that short delay,
  // but force a refresh once it is clearly older than the selected window.
  return ageMs >= -5 * 1000 && ageMs <= windowMs + CANDLE_REFERENCE_STALE_GRACE_MS;
}

function parseOkxCandles(rows, minutes) {
  const candleMs = Number(minutes) * ONE_MINUTE_MS;

  return rows
    .map((row) => {
      const openTime = Number(row?.[0]);
      const close = Number(row?.[4]);
      const closeTime = openTime + candleMs;

      return {
        openTime,
        closeTime,
        close,
        confirmed: String(row?.[8] ?? "") === "1"
      };
    })
    .filter((candle) => (
      Number.isFinite(candle.openTime) &&
      Number.isFinite(candle.close) &&
      Number.isFinite(candle.closeTime)
    ))
    .sort((a, b) => b.openTime - a.openTime);
}

function pickPreviousClosedCandle(candles, minutes, now = Date.now()) {
  const candleMs = Number(minutes) * ONE_MINUTE_MS;
  const activeCandleOpenAt = Math.floor(now / candleMs) * candleMs;

  return candles.find((candle) => (
    candle.confirmed &&
    candle.openTime < activeCandleOpenAt &&
    candle.closeTime <= now
  )) || candles.find((candle) => (
    candle.openTime < activeCandleOpenAt &&
    candle.closeTime <= now - 1000
  ));
}

async function fetchOkxPreviousCandleClose(symbol, minutes) {
  const interval = getKlineInterval("okx", minutes);
  const requestUrl = `https://www.okx.com/api/v5/market/candles?instId=${encodeURIComponent(symbol)}&bar=${encodeURIComponent(interval)}&limit=10`;
  const json = await fetchJson(requestUrl);

  if (json.code !== "0" || !Array.isArray(json.data) || !json.data.length) {
    throw new Error(`OKX candle not found: ${symbol}`);
  }

  const candles = parseOkxCandles(json.data, minutes);
  const previousClosed = pickPreviousClosedCandle(candles, minutes);

  if (!previousClosed) {
    throw new Error(`OKX closed candle not found: ${symbol}`);
  }

  return previousClosed;
}

async function fetchBinancePreviousCandleClose(ticker, minutes) {
  const interval = getKlineInterval("binance", minutes);
  const baseUrl = ticker.marketType === "spot"
    ? "https://api.binance.com/api/v3/klines"
    : "https://fapi.binance.com/fapi/v1/klines";
  const rows = await fetchJson(
    `${baseUrl}?symbol=${encodeURIComponent(ticker.symbol)}&interval=${encodeURIComponent(interval)}&limit=5`
  );

  if (!Array.isArray(rows) || !rows.length) {
    throw new Error(`Binance candle not found: ${ticker.symbol}`);
  }

  const now = Date.now();
  const candles = rows
    .map((row) => ({
      openTime: Number(row?.[0]),
      closeTime: Number(row?.[6]),
      close: Number(row?.[4])
    }))
    .filter((candle) => Number.isFinite(candle.openTime) && Number.isFinite(candle.closeTime) && Number.isFinite(candle.close))
    .sort((a, b) => b.openTime - a.openTime);

  const previousClosed = candles.find((candle) => candle.closeTime <= now - 1000);

  if (!previousClosed) {
    throw new Error(`Binance closed candle not found: ${ticker.symbol}`);
  }

  return previousClosed;
}

async function fetchPreviousCandleClose(ticker, minutes) {
  if (ticker.exchange === "okx") {
    return fetchOkxPreviousCandleClose(ticker.symbol, minutes);
  }

  return fetchBinancePreviousCandleClose(ticker, minutes);
}

async function buildWindowReferenceSample(ticker, minutes, latestUpdatedAt) {
  const windowMinutes = Number(minutes);
  const candle = await fetchPreviousCandleClose(ticker, windowMinutes);
  const latest = Number(latestUpdatedAt) || Date.now();

  return {
    price: candle.close,
    // The reference price is a previous candle close, so keep the actual candle
    // close timestamp instead of pretending it was sampled exactly N minutes ago.
    updatedAt: Number.isFinite(Number(candle.closeTime)) ? Number(candle.closeTime) : latest - windowMinutes * ONE_MINUTE_MS,
    windowMinutes,
    source: "previous_candle",
    candleClosedAt: candle.closeTime,
    candleOpenAt: candle.openTime,
    fetchedAt: Date.now()
  };
}

function normalizeWindowReferences(windowReferences = {}) {
  const normalized = {};

  for (const minutes of CANDLE_WINDOW_OPTIONS) {
    const reference = windowReferences[String(minutes)] || windowReferences[minutes];
    const price = Number(reference?.price);
    const updatedAt = Number(reference?.updatedAt);

    if (!Number.isFinite(price) || !Number.isFinite(updatedAt)) continue;

    normalized[String(minutes)] = {
      price,
      updatedAt,
      windowMinutes: minutes,
      source: reference.source || "previous_candle",
      candleClosedAt: Number.isFinite(Number(reference.candleClosedAt)) ? Number(reference.candleClosedAt) : null,
      candleOpenAt: Number.isFinite(Number(reference.candleOpenAt)) ? Number(reference.candleOpenAt) : null,
      fetchedAt: Number.isFinite(Number(reference.fetchedAt)) ? Number(reference.fetchedAt) : null
    };
  }

  return normalized;
}

async function fetchOkxPrice(symbol) {
  const url = `https://www.okx.com/api/v5/market/ticker?instId=${encodeURIComponent(symbol)}`;
  const json = await fetchJson(url);

  if (json.code !== "0" || !Array.isArray(json.data) || !json.data.length) {
    throw new Error(`OKX price not found: ${symbol}`);
  }

  const ticker = json.data[0];
  const price = assertFinitePrice(ticker.last, symbol);
  const open24h = Number(ticker.open24h);

  return {
    price,
    referencePrice24h: Number.isFinite(open24h) ? open24h : null,
    referenceUpdatedAt24h: Number(ticker.ts) ? Number(ticker.ts) - 24 * 60 * 60 * 1000 : null,
    changePercent24h: calculateChangePercent(price, open24h),
    exchangeTimestamp: Number(ticker.ts) || null
  };
}

async function fetchBinanceFuturesPrice(symbol) {
  const url = `https://fapi.binance.com/fapi/v1/ticker/24hr?symbol=${encodeURIComponent(symbol)}`;
  const ticker = await fetchJson(url);

  return {
    price: assertFinitePrice(ticker.lastPrice, symbol),
    referencePrice24h: Number.isFinite(Number(ticker.openPrice)) ? Number(ticker.openPrice) : null,
    referenceUpdatedAt24h: Number(ticker.openTime) || null,
    changePercent24h: Number.isFinite(Number(ticker.priceChangePercent))
      ? Number(ticker.priceChangePercent)
      : null,
    exchangeTimestamp: Number(ticker.closeTime) || null
  };
}

async function fetchBinanceSpotPrice(symbol) {
  const url = `https://api.binance.com/api/v3/ticker/24hr?symbol=${encodeURIComponent(symbol)}`;
  const ticker = await fetchJson(url);

  return {
    price: assertFinitePrice(ticker.lastPrice, symbol),
    referencePrice24h: Number.isFinite(Number(ticker.openPrice)) ? Number(ticker.openPrice) : null,
    referenceUpdatedAt24h: Number(ticker.openTime) || null,
    changePercent24h: Number.isFinite(Number(ticker.priceChangePercent))
      ? Number(ticker.priceChangePercent)
      : null,
    exchangeTimestamp: Number(ticker.closeTime) || null
  };
}

async function fetchTickerPrice(ticker) {
  let fetched;

  if (ticker.exchange === "okx") {
    fetched = await fetchOkxPrice(ticker.symbol);
  } else if (ticker.marketType === "spot") {
    fetched = await fetchBinanceSpotPrice(ticker.symbol);
  } else {
    fetched = await fetchBinanceFuturesPrice(ticker.symbol);
  }

  return {
    ...ticker,
    ...fetched,
    updatedAt: Date.now(),
    error: null
  };
}

function formatBadgePrice(price) {
  if (!Number.isFinite(Number(price))) return "ERR";

  const value = Number(price);

  if (value >= 1_000_000) return `${Math.floor(value / 1_000_000)}M`.slice(0, 4);
  if (value >= 10_000) return `${Math.floor(value / 1_000)}K`.slice(0, 4);
  if (value >= 1_000) return String(Math.floor(value)).slice(0, 4);
  if (value >= 100) return String(Math.floor(value));
  if (value >= 10) return value.toFixed(1).replace(/\.0$/, "").slice(0, 4);
  if (value >= 1) return value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "").slice(0, 4);
  if (value >= 0.01) return value.toFixed(2).slice(0, 4);

  return "<.01";
}

async function updateBadgeFromCache(priceCache, badgeTickerId) {
  const badgeEntry = priceCache?.[badgeTickerId];

  if (!badgeEntry || badgeEntry.error || !Number.isFinite(Number(badgeEntry.price))) {
    await chrome.action.setBadgeText({ text: "ERR" });
    await chrome.action.setBadgeBackgroundColor({ color: "#cc0000" });
    return;
  }

  await chrome.action.setBadgeText({ text: formatBadgePrice(badgeEntry.price) });
  await chrome.action.setBadgeBackgroundColor({ color: "#333333" });
  await chrome.action.setTitle({
    title: `${badgeEntry.exchange} ${badgeEntry.marketType} ${badgeEntry.symbol}: ${badgeEntry.price}`
  });
}

function formatNotificationPrice(price) {
  const value = Number(price);
  if (!Number.isFinite(value)) return "-";

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: value >= 100 ? 2 : 6
  }).format(value);
}

function getAlertConditionText(rule) {
  return rule.direction === "above" ? "이상" : "이하";
}

async function showPriceAlertNotification(ticker, rule, currentPrice) {
  if (!chrome.notifications?.create) return;

  const targetText = formatNotificationPrice(rule.targetPrice);
  const priceText = formatNotificationPrice(currentPrice);
  const marketText = ticker.marketType === "spot" ? "현물" : "선물";

  await chrome.notifications.create(`price-alert:${ticker.id}:${rule.id || "rule"}:${Date.now()}`, {
    type: "basic",
    iconUrl: "icons/icon-128.png",
    title: "가격 도달 알림",
    message: `${ticker.exchange} ${marketText} ${ticker.symbol} 현재가 ${priceText} · 목표 ${getAlertConditionText(rule)} ${targetText}`,
    priority: 2
  });
}

async function evaluatePriceAlerts(state, priceCache) {
  const nextAlertRules = { ...(state.alertRules || {}) };
  let changed = false;

  for (const ticker of state.trackedTickers) {
    const rawRules = nextAlertRules[ticker.id];
    const rules = normalizeAlertRuleList(rawRules);
    if (!rules.length) continue;

    const currentPrice = Number(priceCache?.[ticker.id]?.price);
    const hasValidPrice = Number.isFinite(currentPrice);
    const nextRules = [];

    for (const rule of rules) {
      if (!rule.enabled || !Number.isFinite(Number(rule.targetPrice))) {
        nextRules.push(rule);
        continue;
      }

      const conditionMet = hasValidPrice
        ? (rule.direction === "above" ? currentPrice >= rule.targetPrice : currentPrice <= rule.targetPrice)
        : false;
      const wasConditionMet = rule.lastConditionMet === true;
      const shouldNotify = conditionMet && (
        rule.repeat === "repeat"
          ? !wasConditionMet
          : !rule.triggered
      );

      if (shouldNotify) {
        await showPriceAlertNotification(ticker, rule, currentPrice);
      }

      nextRules.push({
        ...rule,
        lastConditionMet: conditionMet,
        triggered: shouldNotify || rule.triggered,
        lastNotifiedAt: shouldNotify ? Date.now() : rule.lastNotifiedAt
      });
    }

    if (nextRules.length) {
      nextAlertRules[ticker.id] = nextRules;
    } else {
      delete nextAlertRules[ticker.id];
    }

    if (JSON.stringify(nextRules) !== JSON.stringify(rules)) {
      changed = true;
    }
  }

  return changed ? nextAlertRules : state.alertRules;
}

function mergeFetchedPriceWithHistory(fetchedEntry, previousEntry, prefillSamples = [], prefillWindowReferences = {}) {
  const previousPrice = Number(previousEntry?.price);
  const previousUpdatedAt = Number(previousEntry?.updatedAt);
  const previousHistory = Array.isArray(previousEntry?.priceHistory)
    ? previousEntry.priceHistory
    : (Number.isFinite(previousPrice) && Number.isFinite(previousUpdatedAt)
      ? [{ price: previousPrice, updatedAt: previousUpdatedAt }]
      : []);
  const addedPrice = Number(previousEntry?.addedPrice);
  const nextAddedPrice = Number.isFinite(addedPrice)
    ? addedPrice
    : fetchedEntry.price;
  const windowReferences = normalizeWindowReferences({
    ...previousEntry?.windowReferences,
    ...prefillWindowReferences
  });

  return {
    ...fetchedEntry,
    previousPrice: Number.isFinite(previousPrice) ? previousPrice : null,
    previousUpdatedAt: previousEntry?.updatedAt || null,
    addedPrice: nextAddedPrice,
    addedAt: previousEntry?.addedAt || fetchedEntry.updatedAt,
    changePercentSinceLastUpdate: Number.isFinite(previousPrice)
      ? calculateChangePercent(fetchedEntry.price, previousPrice)
      : null,
    changePercentSinceAdded: calculateChangePercent(fetchedEntry.price, nextAddedPrice),
    windowReferences,
    windowReferenceErrors: Object.fromEntries(
      Object.entries({
        ...(previousEntry?.windowReferenceErrors || {}),
        ...Object.fromEntries(
          Object.entries(prefillWindowReferences)
            .filter(([key]) => key.startsWith("error:"))
            .map(([key, value]) => [key.replace("error:", ""), value])
        )
      }).filter(([, value]) => value !== null)
    ),
    priceHistory: buildPriceHistory(previousHistory, [
      {
        price: fetchedEntry.price,
        updatedAt: fetchedEntry.updatedAt
      }
    ])
  };
}

function buildPriceHistory(previousHistory, nextSampleOrSamples) {
  const now = Date.now();
  const history = Array.isArray(previousHistory) ? previousHistory : [];
  const nextSamples = Array.isArray(nextSampleOrSamples)
    ? nextSampleOrSamples
    : (nextSampleOrSamples ? [nextSampleOrSamples] : []);

  const normalized = history
    .concat(nextSamples)
    .map((sample) => ({
      price: Number(sample?.price),
      updatedAt: Number(sample?.updatedAt)
    }))
    .filter((sample) => (
      Number.isFinite(sample.price) &&
      Number.isFinite(sample.updatedAt) &&
      now - sample.updatedAt <= PRICE_HISTORY_RETENTION_MS
    ))
    .sort((a, b) => a.updatedAt - b.updatedAt);

  const deduped = [];
  for (const sample of normalized) {
    const last = deduped[deduped.length - 1];
    if (last && last.updatedAt === sample.updatedAt) {
      deduped[deduped.length - 1] = sample;
    } else {
      deduped.push(sample);
    }
  }

  return deduped.slice(-PRICE_HISTORY_MAX_POINTS);
}


async function backfillActiveWindowReferences(force = false) {
  const state = await getStoredState();
  const activeChangeWindowMinutes = getActiveChangeWindowMinutes(state);

  if (!activeChangeWindowMinutes) {
    return state;
  }

  const nextPriceCache = { ...state.priceCache };
  let changed = false;

  for (const ticker of state.trackedTickers) {
    const previousEntry = nextPriceCache[ticker.id];
    const latestUpdatedAt = Number(previousEntry?.updatedAt) || Date.now();

    if (!previousEntry || !Number.isFinite(Number(previousEntry.price))) {
      continue;
    }

    if (!force && hasFreshStoredWindowReference(previousEntry, latestUpdatedAt, activeChangeWindowMinutes)) {
      continue;
    }

    try {
      const referenceSample = await buildWindowReferenceSample(
        ticker,
        activeChangeWindowMinutes,
        latestUpdatedAt
      );

      nextPriceCache[ticker.id] = {
        ...previousEntry,
        windowReferences: normalizeWindowReferences({
          ...previousEntry.windowReferences,
          [String(activeChangeWindowMinutes)]: referenceSample
        }),
        windowReferenceErrors: {
          ...(previousEntry.windowReferenceErrors || {}),
          [String(activeChangeWindowMinutes)]: null
        }
      };
      changed = true;
    } catch (error) {
      console.warn("Candle reference backfill failed", ticker.id, error);
      nextPriceCache[ticker.id] = {
        ...previousEntry,
        windowReferenceErrors: {
          ...(previousEntry.windowReferenceErrors || {}),
          [String(activeChangeWindowMinutes)]: {
            message: error?.message || "Candle reference backfill failed",
            at: Date.now()
          }
        }
      };
      changed = true;
    }
  }

  if (changed) {
    await chrome.storage.local.set({ priceCache: nextPriceCache });
    return {
      ...state,
      priceCache: nextPriceCache
    };
  }

  return state;
}

async function updateTrackedPrices() {
  const state = await getStoredState();
  const nextPriceCache = { ...state.priceCache };
  const activeChangeWindowMinutes = getActiveChangeWindowMinutes(state);

  const results = await Promise.allSettled(
    state.trackedTickers.map(async (ticker) => fetchTickerPrice(ticker))
  );

  let successfulUpdateCount = 0;
  let preservedRateLimitCount = 0;

  for (let index = 0; index < results.length; index += 1) {
    const ticker = state.trackedTickers[index];
    const result = results[index];
    const previousEntry = nextPriceCache[ticker.id];

    if (result.status === "fulfilled") {
      successfulUpdateCount += 1;
      const prefillSamples = [];
      const prefillWindowReferences = {};

      if (
        activeChangeWindowMinutes &&
        !hasFreshStoredWindowReference(previousEntry, result.value.updatedAt, activeChangeWindowMinutes)
      ) {
        try {
          const referenceSample = await buildWindowReferenceSample(
            ticker,
            activeChangeWindowMinutes,
            result.value.updatedAt
          );
          prefillSamples.push(referenceSample);
          prefillWindowReferences[String(activeChangeWindowMinutes)] = referenceSample;
        } catch (error) {
          console.warn("Candle reference backfill failed", ticker.id, error);
          prefillWindowReferences[`error:${activeChangeWindowMinutes}`] = {
            message: error?.message || "Candle reference backfill failed",
            at: Date.now()
          };
        }
      }

      nextPriceCache[ticker.id] = mergeFetchedPriceWithHistory(
        result.value,
        previousEntry,
        prefillSamples,
        prefillWindowReferences
      );
    } else {
      const preservedEntry = isRateLimitError(result.reason)
        ? preserveCachedEntryOnRateLimit(ticker, previousEntry, result.reason)
        : null;

      if (preservedEntry) {
        preservedRateLimitCount += 1;
        nextPriceCache[ticker.id] = preservedEntry;
      } else {
        nextPriceCache[ticker.id] = {
          ...ticker,
          price: previousEntry?.price ?? null,
          previousPrice: previousEntry?.previousPrice ?? null,
          previousUpdatedAt: previousEntry?.previousUpdatedAt ?? null,
          addedPrice: previousEntry?.addedPrice ?? null,
          addedAt: previousEntry?.addedAt ?? null,
          referencePrice24h: previousEntry?.referencePrice24h ?? null,
          referenceUpdatedAt24h: previousEntry?.referenceUpdatedAt24h ?? null,
          changePercent24h: previousEntry?.changePercent24h ?? null,
          changePercentSinceLastUpdate: previousEntry?.changePercentSinceLastUpdate ?? null,
          changePercentSinceAdded: previousEntry?.changePercentSinceAdded ?? null,
          windowReferences: normalizeWindowReferences(previousEntry?.windowReferences || {}),
          windowReferenceErrors: previousEntry?.windowReferenceErrors || {},
          priceHistory: Array.isArray(previousEntry?.priceHistory)
            ? previousEntry.priceHistory
            : (Number.isFinite(Number(previousEntry?.price)) && Number.isFinite(Number(previousEntry?.updatedAt))
              ? [{ price: Number(previousEntry.price), updatedAt: Number(previousEntry.updatedAt) }]
              : []),
          exchangeTimestamp: previousEntry?.exchangeTimestamp ?? null,
          updatedAt: previousEntry?.updatedAt ?? null,
          error: result.reason?.message || "Price update failed"
        };
      }
    }
  }

  const lastUpdatedAt = successfulUpdateCount > 0 ? Date.now() : (state.lastUpdatedAt || Date.now());
  const nextAlertRules = await evaluatePriceAlerts(state, nextPriceCache);

  await chrome.storage.local.set({
    priceCache: nextPriceCache,
    lastUpdatedAt,
    alertRules: nextAlertRules
  });

  await updateBadgeFromCache(nextPriceCache, state.badgeTickerId);

  return {
    ok: true,
    trackedTickers: state.trackedTickers,
    badgeTickerId: state.badgeTickerId,
    priceCache: nextPriceCache,
    alertRules: nextAlertRules,
    lastUpdatedAt,
    updateIntervalMinutes: state.updateIntervalMinutes,
    changeBasis: state.changeBasis,
    changeWindow: state.changeWindow,
    updateIntervalOptions: UPDATE_INTERVAL_OPTIONS,
    changeBasisOptions: CHANGE_BASIS_OPTIONS,
    changeWindowOptions: CHANGE_WINDOW_OPTIONS,
    updateMeta: {
      successfulUpdateCount,
      preservedRateLimitCount
    }
  };
}

async function ensureAlarm() {
  const state = await getStoredState();
  const interval = state.updateIntervalMinutes;
  const alarm = await chrome.alarms.get(PRICE_ALARM_NAME);

  if (!alarm || Number(alarm.periodInMinutes) !== interval) {
    await chrome.alarms.clear(PRICE_ALARM_NAME);
    await chrome.alarms.create(PRICE_ALARM_NAME, {
      periodInMinutes: interval
    });
  }
}

async function getCachedInstrumentList(exchange, marketType) {
  const normalizedExchange = normalizeExchange(exchange);
  const normalizedMarketType = normalizeMarketType(marketType);
  const cacheKey = `instrumentCache:${normalizedExchange}:${normalizedMarketType}`;
  const stored = await chrome.storage.local.get(cacheKey);
  const cached = stored[cacheKey];

  if (
    cached &&
    Array.isArray(cached.items) &&
    cached.items.length &&
    Number.isFinite(cached.cachedAt) &&
    Date.now() - cached.cachedAt < INSTRUMENT_CACHE_TTL_MS
  ) {
    return cached.items;
  }

  const items = await fetchInstrumentList(normalizedExchange, normalizedMarketType);

  await chrome.storage.local.set({
    [cacheKey]: {
      cachedAt: Date.now(),
      items
    }
  });

  return items;
}

async function fetchInstrumentList(exchange, marketType) {
  if (exchange === "okx") {
    return fetchOkxInstruments(marketType);
  }

  return marketType === "spot"
    ? fetchBinanceSpotInstruments()
    : fetchBinanceFuturesInstruments();
}

async function fetchOkxInstruments(marketType) {
  const instType = marketType === "spot" ? "SPOT" : "SWAP";
  const json = await fetchJson(`https://www.okx.com/api/v5/public/instruments?instType=${instType}`);

  if (json.code !== "0" || !Array.isArray(json.data)) {
    throw new Error("OKX ticker list not available");
  }

  return json.data
    .filter((item) => item.state === "live" && item.instId)
    .map((item) => buildSearchItem({
      exchange: "okx",
      marketType,
      symbol: item.instId,
      baseAsset: item.baseCcy || item.ctValCcy || item.instFamily?.split("-")?.[0] || "",
      quoteAsset: item.quoteCcy || item.settleCcy || item.instFamily?.split("-")?.[1] || "",
      extraSearch: [item.instFamily, item.ctValCcy, item.settleCcy]
    }))
    .sort(sortInstrument);
}

async function fetchBinanceSpotInstruments() {
  const json = await fetchJson("https://api.binance.com/api/v3/exchangeInfo");

  if (!Array.isArray(json.symbols)) {
    throw new Error("Binance spot ticker list not available");
  }

  return json.symbols
    .filter((item) => item.status === "TRADING" && item.symbol)
    .map((item) => buildSearchItem({
      exchange: "binance",
      marketType: "spot",
      symbol: item.symbol,
      baseAsset: item.baseAsset || "",
      quoteAsset: item.quoteAsset || "",
      extraSearch: [item.baseAsset, item.quoteAsset]
    }))
    .sort(sortInstrument);
}

async function fetchBinanceFuturesInstruments() {
  const json = await fetchJson("https://fapi.binance.com/fapi/v1/exchangeInfo");

  if (!Array.isArray(json.symbols)) {
    throw new Error("Binance futures ticker list not available");
  }

  return json.symbols
    .filter((item) => item.status === "TRADING" && item.contractType === "PERPETUAL" && item.symbol)
    .map((item) => buildSearchItem({
      exchange: "binance",
      marketType: "futures",
      symbol: item.symbol,
      baseAsset: item.baseAsset || "",
      quoteAsset: item.quoteAsset || "",
      extraSearch: [item.pair, item.baseAsset, item.quoteAsset]
    }))
    .sort(sortInstrument);
}

function buildSearchItem({ exchange, marketType, symbol, baseAsset, quoteAsset, extraSearch = [] }) {
  const ticker = buildTicker(exchange, symbol, {
    marketType,
    baseAsset,
    quoteAsset
  });

  return {
    ...ticker,
    searchText: [symbol, baseAsset, quoteAsset, ...extraSearch]
      .filter(Boolean)
      .join(" ")
      .toUpperCase()
  };
}

function sortInstrument(a, b) {
  return a.symbol.localeCompare(b.symbol);
}

function rankSearchResult(item, query) {
  if (!query) return 0;
  if (item.symbol === query) return 0;
  if (item.symbol.startsWith(query)) return 1;
  if (item.baseAsset === query) return 2;
  if (item.searchText.includes(query)) return 3;
  return 99;
}

async function searchTickers(exchange, marketType, query) {
  const normalizedExchange = normalizeExchange(exchange);
  const normalizedMarketType = normalizeSearchMarketType(marketType);
  const marketTypes = normalizedMarketType === "all" ? ["spot", "futures"] : [normalizedMarketType];
  const normalizedQuery = String(query || "").trim().toUpperCase();
  const compactQuery = normalizedQuery.replace(/[^A-Z0-9]/g, "");
  const lists = await Promise.all(marketTypes.map((type) => getCachedInstrumentList(normalizedExchange, type)));
  const items = lists.flat();

  return items
    .filter((item) => {
      if (!normalizedQuery) return true;
      return (
        item.searchText.includes(normalizedQuery) ||
        item.searchText.replace(/[^A-Z0-9]/g, "").includes(compactQuery)
      );
    })
    .sort((a, b) => {
      const rankDiff = rankSearchResult(a, normalizedQuery) - rankSearchResult(b, normalizedQuery);
      if (rankDiff !== 0) return rankDiff;
      if (a.marketType !== b.marketType) return a.marketType === "spot" ? -1 : 1;
      return a.symbol.localeCompare(b.symbol);
    })
    .slice(0, 30);
}

async function addTicker(payload) {
  const state = await getStoredState();
  const ticker = buildTicker(payload.exchange, payload.symbol, payload);

  if (state.trackedTickers.some((item) => item.id === ticker.id)) {
    return getStateResponse();
  }

  if (state.trackedTickers.length >= MAX_TRACKED_TICKERS) {
    throw new Error(`You can track up to ${MAX_TRACKED_TICKERS} tickers`);
  }

  const trackedTickers = [...state.trackedTickers, ticker];

  await chrome.storage.local.set({ trackedTickers });

  return updateTrackedPrices();
}

async function removeTicker(tickerId) {
  const state = await getStoredState();
  const trackedTickers = state.trackedTickers.filter((item) => item.id !== tickerId);
  const priceCache = { ...state.priceCache };
  const alertRules = { ...(state.alertRules || {}) };
  delete priceCache[tickerId];
  delete alertRules[tickerId];

  const badgeTickerId = state.badgeTickerId === tickerId
    ? trackedTickers[0]?.id || DEFAULT_BADGE_TICKER_ID
    : state.badgeTickerId;

  await chrome.storage.local.set({ trackedTickers, priceCache, alertRules, badgeTickerId });

  if (!trackedTickers.length) {
    await chrome.storage.local.set({
      trackedTickers: DEFAULT_TICKERS,
      badgeTickerId: DEFAULT_BADGE_TICKER_ID
    });
  }

  return updateTrackedPrices();
}

async function setBadgeTicker(tickerId) {
  const state = await getStoredState();

  if (!state.trackedTickers.some((item) => item.id === tickerId)) {
    throw new Error("Badge ticker must be one of tracked tickers");
  }

  await chrome.storage.local.set({ badgeTickerId: tickerId });
  await updateBadgeFromCache(state.priceCache, tickerId);

  return getStateResponse();
}

async function moveTicker(tickerId, direction) {
  const state = await getStoredState();
  const currentIndex = state.trackedTickers.findIndex((item) => item.id === tickerId);

  if (currentIndex === -1) {
    throw new Error("Ticker not found");
  }

  const offset = direction === "up" ? -1 : direction === "down" ? 1 : 0;
  if (!offset) {
    throw new Error("Invalid move direction");
  }

  const nextIndex = currentIndex + offset;
  if (nextIndex < 0 || nextIndex >= state.trackedTickers.length) {
    return getStateResponse();
  }

  const trackedTickers = [...state.trackedTickers];
  [trackedTickers[currentIndex], trackedTickers[nextIndex]] = [
    trackedTickers[nextIndex],
    trackedTickers[currentIndex]
  ];

  await chrome.storage.local.set({ trackedTickers });

  return getStateResponse();
}

async function reorderTickers(tickerIds = []) {
  const state = await getStoredState();

  if (!Array.isArray(tickerIds)) {
    throw new Error("Ticker order must be an array");
  }

  const currentIds = state.trackedTickers.map((ticker) => ticker.id);
  const currentIdSet = new Set(currentIds);
  const nextIdSet = new Set(tickerIds);

  if (tickerIds.length !== currentIds.length || nextIdSet.size !== currentIdSet.size) {
    throw new Error("Ticker order does not match tracked tickers");
  }

  for (const tickerId of tickerIds) {
    if (!currentIdSet.has(tickerId)) {
      throw new Error("Ticker order contains unknown ticker");
    }
  }

  const tickerMap = new Map(state.trackedTickers.map((ticker) => [ticker.id, ticker]));
  const trackedTickers = tickerIds.map((tickerId) => tickerMap.get(tickerId));

  await chrome.storage.local.set({ trackedTickers });

  return getStateResponse();
}

async function updateAlertRule(tickerId, ruleInput = {}) {
  const state = await getStoredState();

  if (!state.trackedTickers.some((item) => item.id === tickerId)) {
    throw new Error("Alert ticker must be one of tracked tickers");
  }

  const alertRules = { ...(state.alertRules || {}) };
  alertRules[tickerId] = buildNextAlertRuleList(ruleInput, alertRules[tickerId] || []);

  await chrome.storage.local.set({ alertRules });

  return getStateResponse();
}

async function deleteAlertRule(tickerId, alertId) {
  const state = await getStoredState();

  if (!state.trackedTickers.some((item) => item.id === tickerId)) {
    throw new Error("Alert ticker must be one of tracked tickers");
  }

  const alertRules = { ...(state.alertRules || {}) };
  const nextRules = normalizeAlertRuleList(alertRules[tickerId] || [])
    .filter((rule) => rule.id !== alertId);

  if (nextRules.length) {
    alertRules[tickerId] = nextRules;
  } else {
    delete alertRules[tickerId];
  }

  await chrome.storage.local.set({ alertRules });

  return getStateResponse();
}

async function updateSettings(settings = {}) {
  const currentState = await getStoredState();
  const nextUpdateIntervalMinutes = Object.prototype.hasOwnProperty.call(settings, "updateIntervalMinutes")
    ? normalizeUpdateIntervalMinutes(settings.updateIntervalMinutes)
    : currentState.updateIntervalMinutes;
  const nextChangeBasis = Object.prototype.hasOwnProperty.call(settings, "changeBasis")
    ? normalizeChangeBasis(settings.changeBasis)
    : currentState.changeBasis;
  const nextChangeWindow = Object.prototype.hasOwnProperty.call(settings, "changeWindow")
    ? normalizeChangeWindow(settings.changeWindow, nextChangeBasis)
    : normalizeChangeWindow(currentState.changeWindow, nextChangeBasis);

  await chrome.storage.local.set({
    updateIntervalMinutes: nextUpdateIntervalMinutes,
    changeBasis: nextChangeBasis,
    changeWindow: nextChangeWindow
  });

  await ensureAlarm();

  if (nextChangeBasis === "window") {
    return updateTrackedPrices();
  }

  return getStateResponse();
}

async function getStateResponse() {
  const state = await getStoredState();

  return {
    ok: true,
    maxTrackedTickers: MAX_TRACKED_TICKERS,
    maxAlertsPerTicker: MAX_ALERTS_PER_TICKER,
    updateIntervalOptions: UPDATE_INTERVAL_OPTIONS,
    changeBasisOptions: CHANGE_BASIS_OPTIONS,
    changeWindowOptions: CHANGE_WINDOW_OPTIONS,
    alertDirectionOptions: ALERT_DIRECTION_OPTIONS,
    alertRepeatOptions: ALERT_REPEAT_OPTIONS,
    ...state
  };
}

chrome.runtime.onInstalled.addListener(async () => {
  await getStoredState();
  await ensureAlarm();
  await updateTrackedPrices();
});

chrome.runtime.onStartup.addListener(async () => {
  await ensureAlarm();
  await updateTrackedPrices();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === PRICE_ALARM_NAME) {
    updateTrackedPrices();
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    switch (message?.type) {
      case "GET_STATE":
        await ensureAlarm();
        await backfillActiveWindowReferences(false);
        return getStateResponse();
      case "REFRESH_PRICES":
        return updateTrackedPrices();
      case "BACKFILL_WINDOW_REFERENCES":
        await backfillActiveWindowReferences(true);
        return getStateResponse();
      case "SEARCH_TICKERS":
        return {
          ok: true,
          items: await searchTickers(message.exchange, message.marketType, message.query)
        };
      case "ADD_TICKER":
        return addTicker(message.ticker || {});
      case "REMOVE_TICKER":
        return removeTicker(message.tickerId);
      case "SET_BADGE_TICKER":
        return setBadgeTicker(message.tickerId);
      case "MOVE_TICKER":
        return moveTicker(message.tickerId, message.direction);
      case "REORDER_TICKERS":
      case "SAVE_TICKER_ORDER":
      case "UPDATE_TICKER_ORDER":
        return reorderTickers(message.tickerIds || []);
      case "UPDATE_SETTINGS":
        return updateSettings(message.settings || {});
      case "UPDATE_ALERT_RULE":
        return updateAlertRule(message.tickerId, message.rule || {});
      case "DELETE_ALERT_RULE":
        return deleteAlertRule(message.tickerId, message.alertId);
      default:
        throw new Error("Unknown message type");
    }
  })()
    .then((response) => sendResponse(response))
    .catch((error) => {
      console.error(error);
      sendResponse({ ok: false, error: error.message || "Unexpected error" });
    });

  return true;
});

ensureAlarm().then(updateTrackedPrices).catch((error) => {
  console.error("Initial price update failed", error);
  chrome.action.setBadgeText({ text: "ERR" });
  chrome.action.setBadgeBackgroundColor({ color: "#cc0000" });
});
