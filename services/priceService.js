const fetch = require("node-fetch");

// Fetch ALL needed coin prices in a single CoinGecko request instead of one
// request per chain - this avoids hitting CoinGecko's free-tier rate limit
// when several chains poll around the same time.

const ALL_IDS = [
  "bitcoin", "ethereum", "binancecoin", "solana",
  "polygon-ecosystem-token", "tron",
];

let cache = {}; // id -> price
let lastFetch = 0;
const CACHE_MS = 5 * 60 * 1000;
let inFlight = null;

async function refreshAll() {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ALL_IDS.join(",")}&vs_currencies=usd`;
    const res = await fetch(url);
    const data = await res.json();
    for (const id of ALL_IDS) {
      if (data[id] && typeof data[id].usd === "number") {
        cache[id] = data[id].usd;
      }
    }
    lastFetch = Date.now();
  })();
  try {
    await inFlight;
  } finally {
    inFlight = null;
  }
}

async function getPriceUsd(coingeckoId) {
  const stale = Date.now() - lastFetch > CACHE_MS;
  if (stale || !(coingeckoId in cache)) {
    try {
      await refreshAll();
    } catch (e) {
      // ignore fetch failure here - fall through to cache/fallback below
    }
  }
  if (typeof cache[coingeckoId] === "number") return cache[coingeckoId];
  throw new Error(`Could not fetch price for ${coingeckoId}`);
}

module.exports = { getPriceUsd };
