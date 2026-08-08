const fetch = require("node-fetch");

const USDT_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
const NULL_ADDRESS_HEX = "0000000000000000000000000000000000000000";
const REFRESH_MS = 60 * 1000;
const MAX_ITEMS = 50;
const REDIS_KEY = "whale:mints:tron";

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

let feed = [];
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

async function refresh() {
  console.log("[tronMints] refresh() called");
  try {
    const apiKey = process.env.TRONGRID_API_KEY;
    if (!apiKey || apiKey.includes("your_")) {
      console.log("[tronMints] no TRONGRID_API_KEY set, skipping");
      return;
    }
    const now = Date.now();
    // First run: look back 7 days
    const since = seenSince || (now - 7 * 24 * 60 * 60 * 1000);
    const url = `https://api.trongrid.io/v1/contracts/\( {USDT_CONTRACT}/events?event_name=Transfer&min_timestamp= \){since}&max_timestamp=${now}&limit=200&order_by=block_timestamp,asc`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(url, { headers: { "TRON-PRO-API-KEY": apiKey }, signal: controller.signal });
    clearTimeout(timeout);
    const data = await res.json();
    if (!Array.isArray(data.data)) {
      console.log("[tronMints] unexpected response:", JSON.stringify(data).slice(0, 200));
      seenSince = now;
      return;
    }
    let added = 0;
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
      if (feed.some(f => f.hash === entry.hash)) continue;
      feed = [entry, ...feed].slice(0, MAX_ITEMS);
      added++;
      console.log(`[tronMints] ${entry.type} ${amount} USDT`);
    }
    seenSince = now;
    if (added > 0) await saveToRedis();
  } catch (e) {
    console.warn("[tronMints] refresh failed:", e.message);
  }
}

async function start() {
  console.log("[tronMints] start() called");
  await loadFromRedis();
  setTimeout(refresh, 25000);
  setInterval(refresh, REFRESH_MS);
}

function getFeed() {
  return feed;
}

module.exports = { start, getFeed };
