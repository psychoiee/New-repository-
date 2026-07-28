const fetch = require("node-fetch");

const ETHERSCAN_API_BASE = "https://api.etherscan.io/v2/api";
const USDT_ETH_ADDRESS = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const NULL_TOPIC = "0x" + "0".repeat(64);
const REFRESH_MS = 60 * 1000;
const MAX_ITEMS = 30;

let feed = [];
let lastBlock = null;

async function refresh() {
  console.log("[stablecoinMints] refresh() called");
  try {
    const apiKey = process.env.ETHERSCAN_API_KEY;
    if (!apiKey) {
      console.log("[stablecoinMints] no ETHERSCAN_API_KEY set, skipping");
      return;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    // get latest block
    const blockUrl = new URL(ETHERSCAN_API_BASE);
    blockUrl.searchParams.set("chainid", "1");
    blockUrl.searchParams.set("module", "proxy");
    blockUrl.searchParams.set("action", "eth_blockNumber");
    blockUrl.searchParams.set("apikey", apiKey);
    const blockRes = await fetch(blockUrl.toString(), { signal: controller.signal });
    const blockData = await blockRes.json();
    const latestBlock = parseInt(blockData.result, 16);
    if (lastBlock === null) lastBlock = latestBlock - 100; // first run: look back ~100 blocks
    const fromBlock = lastBlock + 1;

    if (fromBlock > latestBlock) {
      clearTimeout(timeout);
      return;
    }

    const url = new URL(ETHERSCAN_API_BASE);
    url.searchParams.set("chainid", "1");
    url.searchParams.set("module", "logs");
    url.searchParams.set("action", "getLogs");
    url.searchParams.set("address", USDT_ETH_ADDRESS);
    url.searchParams.set("topic0", TRANSFER_TOPIC);
    url.searchParams.set("fromBlock", String(fromBlock));
    url.searchParams.set("toBlock", String(latestBlock));
    url.searchParams.set("apikey", apiKey);
    const res = await fetch(url.toString(), { signal: controller.signal });
    clearTimeout(timeout);
    const data = await res.json();
    if (!Array.isArray(data.result)) {
      console.log("[stablecoinMints] unexpected logs response:", JSON.stringify(data).slice(0, 200));
      lastBlock = latestBlock;
      return;
    }

    for (const log of data.result) {
      const fromTopic = log.topics[1];
      const toTopic = log.topics[2];
      const isMint = fromTopic === NULL_TOPIC;
      const isBurn = toTopic === NULL_TOPIC;
      if (!isMint && !isBurn) continue;
      const amount = Number(BigInt(log.data)) / 1e6;
      if (amount < 1000) continue; // ignore dust
      const entry = {
        type: isMint ? "mint" : "burn",
        amount,
        hash: log.transactionHash,
        timestamp: Date.now(),
      };
      feed = [entry, ...feed].slice(0, MAX_ITEMS);
      console.log(`[stablecoinMints] ${entry.type} ${amount} USDT`);
    }
    lastBlock = latestBlock;
  } catch (e) {
    console.warn("[stablecoinMints] refresh failed:", e.message);
  }
}

function start() {
  console.log("[stablecoinMints] start() called");
  setTimeout(refresh, 20000);
  setInterval(refresh, REFRESH_MS);
}

function getFeed() {
  return feed;
}

module.exports = { start, getFeed };
