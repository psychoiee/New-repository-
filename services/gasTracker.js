const fetch = require("node-fetch");

const ETHERSCAN_API_BASE = "https://api.etherscan.io/v2/api";
const REFRESH_MS = 60 * 1000; // refresh every 60 seconds

let cache = null; // { safe, propose, fast, timestamp }

async function refresh() {
  console.log("[gasTracker] refresh() called");
  try {
    const apiKey = process.env.ETHERSCAN_API_KEY;
    if (!apiKey) {
      console.log("[gasTracker] no ETHERSCAN_API_KEY set, skipping");
      return;
    }
    const url = new URL(ETHERSCAN_API_BASE);
    url.searchParams.set("chainid", "1");
    url.searchParams.set("module", "gastracker");
    url.searchParams.set("action", "gasoracle");
    url.searchParams.set("apikey", apiKey);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url.toString(), { signal: controller.signal });
    clearTimeout(timeout);
    const data = await res.json();
    if (data.status !== "1" || !data.result) {
      console.log("[gasTracker] unexpected response:", JSON.stringify(data).slice(0, 200));
      return;
    }
    cache = {
      safe: Number(data.result.SafeGasPrice),
      propose: Number(data.result.ProposeGasPrice),
      fast: Number(data.result.FastGasPrice),
      timestamp: Date.now(),
    };
    console.log("[gasTracker] updated:", cache.propose, "gwei");
  } catch (e) {
    console.warn("[gasTracker] refresh failed:", e.message);
  }
}

function start() {
  console.log("[gasTracker] start() called");
  setTimeout(refresh, 3000); // delay first call so it doesn't compete with startup
  setInterval(refresh, REFRESH_MS);
}

function getGas() {
  return cache;
}

module.exports = { start, getGas };
