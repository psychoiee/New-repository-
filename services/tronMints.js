const fetch = require("node-fetch");

const USDT_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
const NULL_ADDRESS_HEX = "0000000000000000000000000000000000000000";
const REFRESH_MS = 60 * 1000;
const MAX_ITEMS = 30;

let feed = [];
let seenSince = null;

async function refresh() {
  console.log("[tronMints] refresh() called");
  try {
    const apiKey = process.env.TRONGRID_API_KEY;
    if (!apiKey || apiKey.includes("your_")) {
      console.log("[tronMints] no TRONGRID_API_KEY set, skipping");
      return;
    }
    const now = Date.now();
    const since = seenSince || now - 60000; // first run: look back 60 seconds only
    const url = `https://api.trongrid.io/v1/contracts/${USDT_CONTRACT}/events?event_name=Transfer&min_timestamp=${since}&max_timestamp=${now}&limit=50&order_by=block_timestamp,asc`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(url, { headers: { "TRON-PRO-API-KEY": apiKey }, signal: controller.signal });
    clearTimeout(timeout);
    const data = await res.json();
    if (!Array.isArray(data.data)) {
      console.log("[tronMints] unexpected response:", JSON.stringify(data).slice(0, 200));
      seenSince = now;
      return;
    }
    for (const ev of data.data) {
      const r = ev.result;
      if (!r) continue;
      const from = (r.from || "").toLowerCase();
      const to = (r.to || "").toLowerCase();
      const isMint = from === NULL_ADDRESS_HEX;
      const isBurn = to === NULL_ADDRESS_HEX;
      if (!isMint && !isBurn) continue;
      const amount = Number(r.value) / 1e6;
      if (amount < 1000) continue;
      const entry = {
        type: isMint ? "mint" : "burn",
        amount,
        hash: ev.transaction_id,
        timestamp: ev.block_timestamp || Date.now(),
      };
      feed = [entry, ...feed].slice(0, MAX_ITEMS);
      console.log(`[tronMints] ${entry.type} ${amount} USDT`);
    }
    seenSince = now;
  } catch (e) {
    console.warn("[tronMints] refresh failed:", e.message);
  }
}

function start() {
  console.log("[tronMints] start() called");
  setTimeout(refresh, 25000);
  setInterval(refresh, REFRESH_MS);
}

function getFeed() {
  return feed;
}

module.exports = { start, getFeed };
