const fetch = require("node-fetch");

// Persists the whale-transaction feed to Upstash Redis, using a SEPARATE
// list per chain so that high-frequency chains (Bitcoin, Solana) cannot
// push out the history of low-frequency chains (Tron, BSC, etc).

const MAX_PER_CHAIN = 150;
const KEY_PREFIX = "whale:feed:";

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

let feedByChain = {};
const listeners = new Set();
let loaded = false;

function chainKey(chain) {
  return KEY_PREFIX + chain;
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
    const allIds = [
      ...chains.evmChains.map((c) => c.id),
      ...chains.rpcChains.map((c) => c.id),
      ...chains.nonEvmChains.map((c) => c.id),
    ];
    for (const id of allIds) {
      const raw = await redisCommand(["LRANGE", chainKey(id), "0", String(MAX_PER_CHAIN - 1)]);
      if (Array.isArray(raw)) {
        feedByChain[id] = raw.map((s) => {
          try { return JSON.parse(s); } catch (e) { return null; }
        }).filter(Boolean);
      }
    }
    const total = Object.values(feedByChain).reduce((a, b) => a + b.length, 0);
    console.log(`[store] restored ${total} transactions from Redis across ${allIds.length} chains`);
  } catch (e) {
    console.warn("[store] could not load from Redis:", e.message);
  }
}

function addTransactions(txs) {
  if (!txs.length) return;
  const byChain = {};
  for (const tx of txs) {
    if (!byChain[tx.chain]) byChain[tx.chain] = [];
    byChain[tx.chain].push(tx);
  }
  for (const chain of Object.keys(byChain)) {
    const existing = feedByChain[chain] || [];
    feedByChain[chain] = [...byChain[chain], ...existing].slice(0, MAX_PER_CHAIN);
  }
  for (const listener of listeners) {
    txs.forEach((tx) => listener(tx));
  }

  // Fire-and-forget write to Redis - never blocks or breaks live tracking.
  (async () => {
    try {
      for (const chain of Object.keys(byChain)) {
        for (const tx of byChain[chain]) {
          await redisCommand(["LPUSH", chainKey(chain), JSON.stringify(tx)]);
        }
        await redisCommand(["LTRIM", chainKey(chain), "0", String(MAX_PER_CHAIN - 1)]);
      }
    } catch (e) {
      console.warn("[store] could not save to Redis:", e.message);
    }
  })();
}

function getFeed({ chain, minUsd } = {}) {
  let all;
  if (chain && chain !== "ALL") {
    all = feedByChain[chain] || [];
  } else {
    all = Object.values(feedByChain).flat().sort((a, b) => b.timestamp - a.timestamp);
  }
  return all.filter((tx) => !minUsd || tx.usdValue >= minUsd);
}

function onNewTransaction(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

module.exports = { addTransactions, getFeed, onNewTransaction, loadFromRedis };
