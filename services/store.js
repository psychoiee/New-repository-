const fetch = require("node-fetch");

// Persists the whale-transaction feed to Upstash Redis, using a SEPARATE
// list per (chain, symbol) pair so that high-frequency assets (native
// coins like TRX/BTC) cannot push out the history of lower-frequency
// assets on the same chain (e.g. USDT on Tron).

const MAX_PER_KEY = 60;
const KEY_PREFIX = "whale:feed:";

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

let feedByKey = {};
const listeners = new Set();
let loaded = false;

function keyFor(chain, symbol) {
  return KEY_PREFIX + chain + ":" + symbol;
}

async function redisCommand(command) {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) {
    console.warn("[store] Upstash credentials missing - UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN not set. Skipping persistence.");
    return null;
  }
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
    const chains = require("../config/chains");
    const tokens = require("../config/tokens");
    const allChains = [
      ...chains.evmChains.map((c) => c.id),
      ...chains.rpcChains.map((c) => c.id),
      ...chains.nonEvmChains.map((c) => c.id),
    ];
    const chainSymbolPairs = [];
    for (const chainCfg of [...chains.evmChains, ...chains.rpcChains, ...chains.nonEvmChains]) {
      chainSymbolPairs.push([chainCfg.id, chainCfg.nativeSymbol]);
      const chainTokens = tokens[chainCfg.id] || [];
      for (const t of chainTokens) chainSymbolPairs.push([chainCfg.id, t.symbol]);
    }
    for (const [chain, symbol] of chainSymbolPairs) {
      const k = keyFor(chain, symbol);
      const raw = await redisCommand(["LRANGE", k, "0", String(MAX_PER_KEY - 1)]);
      if (Array.isArray(raw) && raw.length) {
        feedByKey[k] = raw.map((s) => {
          try { return JSON.parse(s); } catch (e) { return null; }
        }).filter(Boolean);
      }
    }
    const total = Object.values(feedByKey).reduce((a, b) => a + b.length, 0);
    console.log(`[store] restored ${total} transactions from Redis across ${chainSymbolPairs.length} chain/symbol keys`);
  } catch (e) {
    console.warn("[store] could not load from Redis:", e.message);
  }
}

let biggestToday = null;
let biggestDay = null;

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function updateBiggest(tx) {
  const day = todayKey();
  if (biggestDay !== day) {
    biggestDay = day;
    biggestToday = null;
  }
  if (!biggestToday || tx.usdValue > biggestToday.usdValue) {
    biggestToday = tx;
  }
}

function getBiggestToday() {
  if (biggestDay !== todayKey()) return null;
  return biggestToday;
}

function addTransactions(txs) {
  if (!txs.length) return;
  for (const tx of txs) updateBiggest(tx);
  const byKey = {};
  for (const tx of txs) {
    const k = keyFor(tx.chain, tx.symbol);
    if (!byKey[k]) byKey[k] = [];
    byKey[k].push(tx);
  }
  for (const k of Object.keys(byKey)) {
    const existing = feedByKey[k] || [];
    feedByKey[k] = [...byKey[k], ...existing].slice(0, MAX_PER_KEY);
  }
  for (const listener of listeners) {
    txs.forEach((tx) => listener(tx));
  }

  // Fire-and-forget write to Redis - never blocks or breaks live tracking.
  (async () => {
    try {
      for (const k of Object.keys(byKey)) {
        for (const tx of byKey[k]) {
          await redisCommand(["LPUSH", k, JSON.stringify(tx)]);
        }
        await redisCommand(["LTRIM", k, "0", String(MAX_PER_KEY - 1)]);
      }
    } catch (e) {
      console.warn("[store] could not save to Redis:", e.message);
    }
  })();
}

function getFeed({ chain, minUsd } = {}) {
  let all;
  if (chain && chain !== "ALL") {
    all = Object.entries(feedByKey)
      .filter(([k]) => k.startsWith(KEY_PREFIX + chain + ":"))
      .flatMap(([, v]) => v);
  } else {
    all = Object.values(feedByKey).flat();
  }
  all.sort((a, b) => b.timestamp - a.timestamp);
  return all.filter((tx) => !minUsd || tx.usdValue >= minUsd);
}

function onNewTransaction(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

module.exports = { addTransactions, getFeed, onNewTransaction, loadFromRedis, getBiggestToday };
