const fetch = require("node-fetch");
const { getPriceUsd } = require("../services/priceService");

let lastCallAt = 0;
let queue = Promise.resolve();
function throttle() {
  // Chain every call onto a single queue so requests are strictly
  // serialized (no two calls can race past the gap check together).
  queue = queue.then(async () => {
    const minGapMs = 800; // stay comfortably under Etherscan's 3 req/sec shared limit
    const wait = lastCallAt + minGapMs - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCallAt = Date.now();
  });
  return queue;
}

async function rpc(apiBase, chainId, apiKey, method, params) {
  await throttle();
  const url = new URL(apiBase);
  url.searchParams.set("chainid", chainId);
  url.searchParams.set("module", "proxy");
  url.searchParams.set("action", method);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  url.searchParams.set("apikey", apiKey);
  const res = await fetch(url.toString());
  const data = await res.json();
  if (data.error) throw new Error(`RPC ${method} failed: ${JSON.stringify(data.error)}`);
  return data.result;
}

function hexToBigInt(hex) {
  return BigInt(hex);
}

function weiToEther(weiHex) {
  const wei = hexToBigInt(weiHex);
  const whole = wei / 10n ** 18n;
  const frac = (wei % 10n ** 18n).toString().padStart(18, "0").slice(0, 6);
  return Number(`${whole}.${frac}`);
}

async function poll(chainConfig, state, thresholdUsd) {
  const apiKey = process.env[chainConfig.apiKeyEnv];
  if (!apiKey || apiKey.includes("your_")) {
    return { newTransactions: [], nextState: state, warning: `Missing ${chainConfig.apiKeyEnv} in .env` };
  }
  const latestHex = await rpc(chainConfig.apiBase, chainConfig.chainId, apiKey, "eth_blockNumber", {});
  const latestBlock = Number(hexToBigInt(latestHex));
  let lastBlock = state.lastBlock ?? latestBlock - 1;
  if (latestBlock - lastBlock > 1) lastBlock = latestBlock - 1;
  const priceUsd = await getPriceUsd(chainConfig.coingeckoId);
  const newTransactions = [];
  for (let b = lastBlock + 1; b <= latestBlock; b++) {
    const blockHex = "0x" + b.toString(16);
    const block = await rpc(chainConfig.apiBase, chainConfig.chainId, apiKey, "eth_getBlockByNumber", { tag: blockHex, boolean: "true" });
    if (!block || !block.transactions) continue;
    for (const tx of block.transactions) {
      if (!tx.value || tx.value === "0x0") continue;
      const amount = weiToEther(tx.value);
      const usdValue = amount * priceUsd;
      if (usdValue >= thresholdUsd) {
        newTransactions.push({ chain: chainConfig.id, hash: tx.hash, from: tx.from, to: tx.to, symbol: chainConfig.nativeSymbol, amount, usdValue, timestamp: Date.now() });
      }
    }
  }
  return { newTransactions, nextState: { lastBlock: latestBlock } };
}

module.exports = { poll };
