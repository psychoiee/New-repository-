const fetch = require("node-fetch");

const REFRESH_MS = 5 * 60 * 1000; // refresh every 5 minutes (avoid CoinGecko rate limits)
const URL = "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&price_change_percentage=24h";

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
    const withChange = data.filter((c) => typeof c.price_change_percentage_24h === "number");
    const sorted = [...withChange].sort((a, b) => b.price_change_percentage_24h - a.price_change_percentage_24h);
    cache = {
      gainers: sorted.slice(0, 5).map((c) => ({
        symbol: c.symbol.toUpperCase(),
        name: c.name,
        price: c.current_price,
        change: c.price_change_percentage_24h,
        icon: c.image,
      })),
      losers: sorted.slice(-5).reverse().map((c) => ({
        symbol: c.symbol.toUpperCase(),
        name: c.name,
        price: c.current_price,
        change: c.price_change_percentage_24h,
        icon: c.image,
      })),
    };
    console.log("[marketMovers] updated, top gainer:", cache.gainers[0] && cache.gainers[0].symbol);
  } catch (e) {
    console.warn("[marketMovers] refresh failed:", e.message);
  }
}

function start() {
  console.log("[marketMovers] start() called");
  setTimeout(refresh, 5000);
  setInterval(refresh, REFRESH_MS);
}

function getMovers() {
  return cache;
}

module.exports = { start, getMovers };
