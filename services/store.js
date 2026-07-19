const fetch = require("node-fetch");

// Persists the whale-transaction feed to Upstash Redis (a free cloud
// key-value store) so it survives server restarts/redeploys, while still
// keeping an in-memory copy for fast reads.

const MAX_ITEMS = 500;
const REDIS_KEY = "whale:feed";

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

let feed = [];
const listeners = new Set();
let loaded = false;

async function redisCommand(command) {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return null;
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
}

async function loadFromRedis() {
  if (loaded) return;
  loaded = true;
  try {
    const raw = await redisCommand(["LRANGE", REDIS_KEY, "0", String(MAX_ITEMS - 1)]);
    if (Array.isArray(raw)) {
      feed = raw.map((s) => {
        try { return JSON.parse(s); } catch (e) { return null; }
      }).filter(Boolean);
      console.log(`[store] restored ${feed.length} transactions from Redis`);
    }
  } catch (e) {
    console.warn("[store] could not load from Redis:", e.message);
  }
}

function addTransactions(txs) {
  if (!txs.length) return;
  feed = [...txs, ...feed].slice(0, MAX_ITEMS);
  for (const listener of listeners) {
    txs.forEach((tx) => listener(tx));
  }

  // Fire-and-forget write to Redis - never blocks or breaks live tracking.
  (async () => {
    try {
      for (const tx of txs) {
        await redisCommand(["LPUSH", REDIS_KEY, JSON.stringify(tx)]);
      }
      await redisCommand(["LTRIM", REDIS_KEY, "0", String(MAX_ITEMS - 1)]);
    } catch (e) {
      console.warn("[store] could not save to Redis:", e.message);
    }
  })();
}

function getFeed({ chain, minUsd } = {}) {
  return feed.filter(
    (tx) => (!chain || chain === "ALL" || tx.chain === chain) && (!minUsd || tx.usdValue >= minUsd)
  );
}

function onNewTransaction(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

module.exports = { addTransactions, getFeed, onNewTransaction, loadFromRedis };
