const fetch = require("node-fetch");

const cache = new Map();
const CACHE_MS = 5 * 60 * 1000;

async function getPriceUsd(coingeckoId) {
  const cached = cache.get(coingeckoId);
  if (cached && Date.now() - cached.fetchedAt < CACHE_MS) {
    return cached.price;
  }

  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coingeckoId}&vs_currencies=usd`;
  const res = await fetch(url);
  const data = await res.json();
  const price = data?.[coingeckoId]?.usd;

  if (typeof price !== "number") {
    if (cached) return cached.price;
    throw new Error(`Could not fetch price for ${coingeckoId}`);
  }

  cache.set(coingeckoId, { price, fetchedAt: Date.now() });
  return price;
}

module.exports = { getPriceUsd };
