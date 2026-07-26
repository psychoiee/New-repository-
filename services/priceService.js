const fetch = require("node-fetch");

const ALL_IDS = [
  "bitcoin", "ethereum", "binancecoin", "solana",
  "polygon-ecosystem-token", "tron", "tether",
];

let cache = {}; // id -> price
let lastSuccessAt = 0;
let lastAttemptAt = 0;
const CACHE_MS = 5 * 60 * 1000;      // treat a price as "fresh enough" for 5 minutes
const RETRY_COOLDOWN_MS = 60 * 1000; // never re-hit CoinGecko more than once a minute,
                                      // even if some ids are still missing from the cache
let inFlight = null;

async function refreshAll() {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ALL_IDS.join(",")}&vs_currencies=usd`;
    const res = await fetch(url);
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`CoinGecko HTTP ${res.status}: ${body.slice(0, 200)}`);
    }
    const data = await res.json();
    for (const id of ALL_IDS) {
      if (data[id] && typeof data[id].usd === "number") {
        cache[id] = data[id].usd;
      }
    }
    lastSuccessAt = Date.now();
  })();
  try {
    await inFlight;
  } catch (e) {
    console.warn("[price] refreshAll failed:", e.message);
    throw e;
  } finally {
    inFlight = null;
  }
}

async function getPriceUsd(coingeckoId) {
  const stale = Date.now() - lastSuccessAt > CACHE_MS;
  const missing = !(coingeckoId in cache);
  const cooledDown = Date.now() - lastAttemptAt > RETRY_COOLDOWN_MS;

  if ((stale || missing) && cooledDown) {
    lastAttemptAt = Date.now();
    try {
      await refreshAll();
    } catch (e) {
      // leave cache as-is; we'll try again after the cooldown
    }
  }

  if (typeof cache[coingeckoId] === "number") return cache[coingeckoId];
  throw new Error(`Could not fetch price for ${coingeckoId}`);
}

module.exports = { getPriceUsd };
