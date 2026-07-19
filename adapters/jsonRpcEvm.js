const fetch = require("node-fetch");
const { getPriceUsd } = require("../services/priceService");
const { pollTokensRpc } = require("../services/tokenWatch");
const watchedTokens = require("../config/tokens");

async function rpc(rpcUrl, method, params) {
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
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
  const rpcUrl = process.env[chainConfig.rpcUrlEnv];
  if (!rpcUrl || rpcUrl.includes("your_")) {
    return { newTransactions: [], nextState: state, warning: `Missing ${chainConfig.rpcUrlEnv} in .env` };
  }
  const latestHex = await rpc(rpcUrl, "eth_blockNumber", []);
  const latestBlock = Number(hexToBigInt(latestHex));
  let lastBlock = state.lastBlock ?? latestBlock - 1;
  if (latestBlock - lastBlock > 5) lastBlock = latestBlock - 5;
  const priceUsd = await getPriceUsd(chainConfig.coingeckoId);
  const newTransactions = [];
  for (let b = lastBlock + 1; b <= latestBlock; b++) {
    const blockHex = "0x" + b.toString(16);
    const block = await rpc(rpcUrl, "eth_getBlockByNumber", [blockHex, true]);
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
  const tokens = watchedTokens[chainConfig.id] || [];
  if (tokens.length) {
    try {
      const tokenTxs = await pollTokensRpc({
        rpcUrl,
        chainId: chainConfig.id,
        tokens,
        fromBlockHex: "0x" + (lastBlock + 1).toString(16),
        toBlockHex: "0x" + latestBlock.toString(16),
        thresholdUsd,
      });
      newTransactions.push(...tokenTxs);
    } catch (e) {
      // token lookups are a bonus feature - never let them break native tracking
    }
  }

  return { newTransactions, nextState: { lastBlock: latestBlock } };
}

module.exports = { poll };
