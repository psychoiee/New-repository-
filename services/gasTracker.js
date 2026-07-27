const fetch = require("node-fetch");

const ETHERSCAN_API_BASE = "https://api.etherscan.io/v2/api";
const REFRESH_MS = 60 * 1000; // refresh every 60 seconds

let cache = null; // { safe, propose, fast, timestamp }
let lastFetchAt = 0;

async function refresh() {
  try {
    const apiKey = process.env.ETHERSCAN_API_KEY;
    if (!apiKey) return;
    const url = new URL(ETHERSCAN_API_BASE);
    url.searchParams.set("chainid", "1");
    url.searchParams.set("module", "gastracker");
    url.searchParams.set("action", "gasoracle");
    url.searchParams.set("apikey", apiKey);
    const res = await fetch(url.toString());
    const data = await res.json();
    if (data.status !== "1" || !data.result) return;
    cache = {
      safe: Number(data.result.SafeGasPrice),
      propose: Number(data.result.ProposeGasPrice),
      fast: Number(data.result.FastGasPrice),
      timestamp: Date.now(),
    };
    lastFetchAt = Date.now();
  } catch (e) {
    console.warn("[gasTracker] refresh failed:", e.message);
  }
}

function start() {
  refresh();
  setInterval(refresh, REFRESH_MS);
}

function getGas() {
  return cache;
}

module.exports = { start, getGas };
