const fetch = require("node-fetch");

const USDT_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
const NULL_ADDRESS_HEX = "0000000000000000000000000000000000000000";
const REFRESH_MS = 60 * 1000;
const MAX_ITEMS = 50;
const REDIS_KEY = "whale:mints:tron";

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

let feed = [];

// Seed the known $1B mint from Aug 10 2026 so it shows immediately
const SEED_MINT = {
  type: "mint",
  amount: 1000000000,
  hash: "dab215a82d0c6e98b89ffadc0b0bd1c5b1b328174ba23208633745b02e4d3129",
  timestamp: 1754806899000  // approx Aug 10 2026 07:41 UTC
};

let seenSince = null;
let loaded = false;

async function redisCommand(command) {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return null;
  try {
    const res = await fetch(UPSTASH_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${UPSTASH_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(command),
    });
    const data = await res.json();
    return data.result;
  } catch (e) {
    console.warn("[tronMints] redis error:", e.message);
    return null;
  }
}

async function loadFromRedis() {
  if (loaded) return;
  loaded = true;
  try {
    const raw = await redisCommand(["LRANGE", REDIS_KEY, "0", String(MAX_ITEMS - 1)]);
    if (Array.isArray(raw) && raw.length) {
      feed = raw.map((s) => {
        try { return JSON.parse(s); } catch (e) { return null; }
      }).filter(Boolean);
      console.log(`[tronMints] restored ${feed.length} items from Redis`);
    }
  } catch (e) {
    console.warn("[tronMints] loadFromRedis failed:", e.message);
  }
}

async function saveToRedis() {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return;
  try {
    await redisCommand(["DEL", REDIS_KEY]);
    for (const item of feed.slice().reverse()) {
      await redisCommand(["LPUSH", REDIS_KEY, JSON.stringify(item)]);
    }
    await redisCommand(["LTRIM", REDIS_KEY, "0", String(MAX_ITEMS - 1)]);
  } catch (e) {
    console.warn("[tronMints] saveToRedis failed:", e.message);
  }
}

async function fetchEvents(eventName, since, now, apiKey) {
  const url = `https://api.trongrid.io/v1/contracts/\( {USDT_CONTRACT}/events?event_name= \){eventName}&min_timestamp=\( {since}&max_timestamp= \){now}&limit=200&order_by=block_timestamp,asc`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, { headers: { "TRON-PRO-API-KEY": apiKey }, signal: controller.signal });
    clearTimeout(timeout);
    const data = await res.json();
    return Array.isArray(data.data) ? data.data : [];
  } catch (e) {
    clearTimeout(timeout);
    console.warn(`[tronMints] ${eventName} fetch failed:`, e.message);
    return [];
  }
}

async function refresh() {
  console.log("[tronMints] refresh() called");
  try {
    const apiKey = process.env.TRONGRID_API_KEY;
    if (!apiKey || apiKey.includes("your_")) {
      console.log("[tronMints] no TRONGRID_API_KEY set, skipping");
      return;
    }
    const now = Date.now();
    // First run or after long gap: look back 10 days to catch recent big mints
    const since = seenSince || (now - 10 * 24 * 60 * 60 * 1000);

    const [transfers, issues] = await Promise.all([
      fetchEvents("Transfer", since, now, apiKey),
      fetchEvents("Issue", since, now, apiKey),
    ]);

    let added = 0;

    // Handle Transfer events (from zero = mint, to zero = burn)
    for (const ev of transfers) {
      const r = ev.result || {};
      const from = (r.from || "").toLowerCase().replace(/^0x/, "");
      const to = (r.to || "").toLowerCase().replace(/^0x/, "");
      const isMint = from === NULL_ADDRESS_HEX || from === "" || from === "0";
      const isBurn = to === NULL_ADDRESS_HEX || to === "" || to === "0";
      if (!isMint && !isBurn) continue;
      const amount = Number(r.value || r.amount || 0) / 1e6;
      if (amount < 1000) continue;
      const entry = {
        type: isMint ? "mint" : "burn",
        amount,
        hash: ev.transaction_id || ev.transaction,
        timestamp: ev.block_timestamp || Date.now(),
      };
      if (feed.some(f => f.hash === entry.hash)) continue;
      feed = [entry, ...feed].slice(0, MAX_ITEMS);
      added++;
      console.log(`[tronMints] Transfer ${entry.type} ${amount} USDT`);
    }

    // Handle Issue events (Tether's official mint)
    for (const ev of issues) {
      const r = ev.result || {};
      const amount = Number(r.amount || r.value || r.in_amount || 0) / 1e6;
      if (amount < 1000) continue;
      const entry = {
        type: "mint",
        amount,
        hash: ev.transaction_id || ev.transaction,
        timestamp: ev.block_timestamp || Date.now(),
      };
      if (feed.some(f => f.hash === entry.hash)) continue;
      feed = [entry, ...feed].slice(0, MAX_ITEMS);
      added++;
      console.log(`[tronMints] Issue mint ${amount} USDT`);
    }

    // Sort by timestamp descending
    feed.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    feed = feed.slice(0, MAX_ITEMS);

    seenSince = now;
    if (added > 0) await saveToRedis();
    if (added > 0) console.log(`[tronMints] added ${added} new items, total ${feed.length}`);
  } catch (e) {
    console.warn("[tronMints] refresh failed:", e.message);
  }
}

async function start() {
  console.log("[tronMints] start() called");
  await loadFromRedis();
  // Ensure the known big mint is always present
  if (typeof SEED_MINT !== "undefined" && !feed.some(f => f.hash === SEED_MINT.hash)) {
    feed = [SEED_MINT, ...feed].slice(0, MAX_ITEMS);
    console.log("[tronMints] seeded $1B mint from Aug 10");
    await saveToRedis();
  }
  setTimeout(refresh, 20000);
  setInterval(refresh, REFRESH_MS);
}

function getFeed() {
  return feed;
}

module.exports = { start, getFeed };
