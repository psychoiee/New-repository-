const fetch = require("node-fetch");
const { getPriceUsd } = require("../services/priceService");

async function rpc(rpcUrl, method, params) {
  const res = await fetch(rpcUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  const data = await res.json();
  if (data.error) throw new Error(`RPC ${method} failed: ${JSON.stringify(data.error)}`);
  return data.result;
}

async function poll(chainConfig, state, thresholdUsd) {
  const rpcUrl = process.env[chainConfig.rpcUrlEnv];
  if (!rpcUrl || rpcUrl.includes("your_")) {
    return { newTransactions: [], nextState: state, warning: `Missing ${chainConfig.rpcUrlEnv} in .env` };
  }
  const latestSlot = await rpc(rpcUrl, "getSlot", [{ commitment: "finalized" }]);
  let lastSlot = state.lastSlot ?? latestSlot - 1;
  if (latestSlot - lastSlot > 3) lastSlot = latestSlot - 3;
  const priceUsd = await getPriceUsd("solana");
  const newTransactions = [];
  for (let s = lastSlot + 1; s <= latestSlot; s++) {
    let block;
    try {
      block = await rpc(rpcUrl, "getBlock", [s, { encoding: "json", transactionDetails: "full", maxSupportedTransactionVersion: 0, rewards: false }]);
    } catch (e) { continue; }
    if (!block || !block.transactions) continue;
    for (const tx of block.transactions) {
      const meta = tx.meta;
      const keys = tx.transaction.message.accountKeys;
      if (!meta || !keys) continue;
      let maxIncreaseIdx = -1, maxIncrease = 0;
      let maxDecreaseIdx = -1, maxDecrease = 0;
      for (let i = 0; i < keys.length; i++) {
        const diff = meta.postBalances[i] - meta.preBalances[i];
        if (diff > maxIncrease) { maxIncrease = diff; maxIncreaseIdx = i; }
        if (diff < maxDecrease) { maxDecrease = diff; maxDecreaseIdx = i; }
      }
      if (maxIncreaseIdx === -1 || maxDecreaseIdx === -1) continue;
      const lamports = Math.min(maxIncrease, -maxDecrease);
      const amount = lamports / 1e9;
      const usdValue = amount * priceUsd;
      if (usdValue >= thresholdUsd) {
        newTransactions.push({ chain: "solana", hash: tx.transaction.signatures[0], from: keys[maxDecreaseIdx].pubkey || keys[maxDecreaseIdx], to: keys[maxIncreaseIdx].pubkey || keys[maxIncreaseIdx], symbol: "SOL", amount, usdValue, timestamp: Date.now() });
      }
    }
  }
  return { newTransactions, nextState: { lastSlot: latestSlot } };
}

module.exports = { poll };
