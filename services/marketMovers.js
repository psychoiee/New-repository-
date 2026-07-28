const fetch = require("node-fetch");

const REFRESH_MS = 10 * 60 * 1000; // refresh every 10 minutes
const URL = "https://api.binance.com/api/v3/ticker/24hr";

let cache = { gainers: [], losers: [] };

async function refresh() {
  console.log("[marketMovers] refresh() called");
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(URL, { signal: controller.signal });
    clearTimeout(timeout);
    const data = await res.json();
    if (!Array.isArray(data)) {
      console.log("[marketMovers] unexpected response:", JSON.stringify(data).slice(0, 200));
      return;
    }
    // Only USDT pairs, with meaningful volume, to avoid obscure/illiquid symbols
    const usdtPairs = data.filter(
      (t) => t.symbol.endsWith("USDT") && parseFloat(t.quoteVolume) > 5_000_000
    );
    const sorted = [...usdtPairs].sort(
      (a, b) => parseFloat(b.priceChangePercent) - parseFloat(a.priceChangePercent)
    );
    const toEntry = (t) => ({
      symbol: t.symbol.replace("USDT", ""),
      price: parseFloat(t.lastPrice),
      change: parseFloat(t.priceChangePercent),
    });
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
