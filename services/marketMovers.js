const fetch = require("node-fetch");

const REFRESH_MS = 10 * 60 * 1000;
const URL = "https://api.binance.com/api/v3/ticker/24hr";
const CMC_MAP_URL = "https://pro-api.coinmarketcap.com/v1/cryptocurrency/map";

let cache = { gainers: [], losers: [] };
let symbolToId = {};
let mapLoadedAt = 0;
const MAP_CACHE_MS = 24 * 60 * 60 * 1000;

async function loadSymbolMap() {
  const apiKey = process.env.CMC_API_KEY;
  if (!apiKey) {
    console.log("[marketMovers] no CMC_API_KEY set, icons will be unavailable");
    return;
  }
  if (Date.now() - mapLoadedAt < MAP_CACHE_MS && Object.keys(symbolToId).length) return;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(`${CMC_MAP_URL}?limit=2000`, {
      headers: { "X-CMC_PRO_API_KEY": apiKey },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const data = await res.json();
    if (!Array.isArray(data.data)) {
      console.log("[marketMovers] unexpected CMC map response:", JSON.stringify(data).slice(0, 200));
      return;
    }
    const map = {};
    for (const c of data.data) {
      if (!map[c.symbol]) map[c.symbol] = c.id; // keep first (highest rank) match
    }
    symbolToId = map;
    mapLoadedAt = Date.now();
    console.log(`[marketMovers] loaded CMC symbol map with ${Object.keys(map).length} entries`);
  } catch (e) {
    console.warn("[marketMovers] loadSymbolMap failed:", e.message);
  }
}

function iconFor(symbol) {
  const id = symbolToId[symbol];
  return id ? `https://s2.coinmarketcap.com/static/img/coins/64x64/${id}.png` : null;
}

async function refresh() {
  console.log("[marketMovers] refresh() called");
  try {
    await loadSymbolMap();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(URL, { signal: controller.signal });
    clearTimeout(timeout);
    const data = await res.json();
    if (!Array.isArray(data)) {
      console.log("[marketMovers] unexpected response:", JSON.stringify(data).slice(0, 200));
      return;
    }
    const usdtPairs = data.filter(
      (t) => t.symbol.endsWith("USDT") && parseFloat(t.quoteVolume) > 5_000_000
    );
    const sorted = [...usdtPairs].sort(
      (a, b) => parseFloat(b.priceChangePercent) - parseFloat(a.priceChangePercent)
    );
    const toEntry = (t) => {
      const symbol = t.symbol.replace("USDT", "");
      return {
        symbol,
        price: parseFloat(t.lastPrice),
        change: parseFloat(t.priceChangePercent),
        icon: iconFor(symbol),
      };
    };
    cache = {
      gainers: sorted.slice(0, 5).map(toEntry),
      losers: sorted.slice(-5).reverse().map(toEntry),
    };
    console.log("[marketMovers] updated, top gainer:", cache.gainers[0] && cache.gainers[0].symbol);
  } catch (e) {
    console.warn("[marketMovers] refresh failed:", e.message);
  }
}

function start() {
  console.log("[marketMovers] start() called");
  setTimeout(refresh, 15000);
  setInterval(refresh, REFRESH_MS);
}

function getMovers() {
  return cache;
}

module.exports = { start, getMovers };
