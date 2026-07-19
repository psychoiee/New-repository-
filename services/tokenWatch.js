const fetch = require("node-fetch");
const { getPriceUsd } = require("./priceService");

// keccak256("Transfer(address,address,uint256)") - the standard ERC-20/
// BEP-20 "Transfer" event signature that every token contract emits.
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

function decodeTransferLog(log, token, chainId) {
  const from = "0x" + log.topics[1].slice(26);
  const to = "0x" + log.topics[2].slice(26);
  const raw = BigInt(log.data);
  const amount = Number(raw) / 10 ** token.decimals;
  return { chain: chainId, hash: log.transactionHash, from, to, symbol: token.symbol, amount, timestamp: Date.now() };
}

// For chains reached through Etherscan API V2 (ethereum, polygon, arbitrum)
async function pollTokensEtherscan({ apiBase, chainId, apiKey, tokens, fromBlock, toBlock, thresholdUsd }) {
  const out = [];
  for (const token of tokens) {
    const url = new URL(apiBase);
    url.searchParams.set("chainid", chainId);
    url.searchParams.set("module", "logs");
    url.searchParams.set("action", "getLogs");
    url.searchParams.set("address", token.address);
    url.searchParams.set("topic0", TRANSFER_TOPIC);
    url.searchParams.set("fromBlock", String(fromBlock));
    url.searchParams.set("toBlock", String(toBlock));
    url.searchParams.set("apikey", apiKey);

    let logs = [];
    try {
      const res = await fetch(url.toString());
      const data = await res.json();
      if (Array.isArray(data.result)) logs = data.result;
    } catch (e) {
      continue;
    }
    if (!logs.length) continue;

    let price;
    try {
      price = await getPriceUsd(token.coingeckoId);
    } catch (e) {
      continue;
    }

    for (const log of logs) {
      const tx = decodeTransferLog(log, token, token.chainLabel || token.chainIdLabel || token.symbol);
      tx.chain = token.chainId || tx.chain;
      tx.usdValue = tx.amount * price;
      if (tx.usdValue >= thresholdUsd) out.push({ ...tx, chain: token.__chain });
    }
  }
  return out;
}

// For chains reached through a plain JSON-RPC URL (bsc via NodeReal, etc.)
async function pollTokensRpc({ rpcUrl, chainId, tokens, fromBlockHex, toBlockHex, thresholdUsd }) {
  const out = [];
  for (const token of tokens) {
    let logs = [];
    try {
      const res = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "eth_getLogs",
          params: [{ address: token.address, topics: [TRANSFER_TOPIC], fromBlock: fromBlockHex, toBlock: toBlockHex }],
        }),
      });
      const data = await res.json();
      if (Array.isArray(data.result)) logs = data.result;
    } catch (e) {
      continue;
    }
    if (!logs.length) continue;

    let price;
    try {
      price = await getPriceUsd(token.coingeckoId);
    } catch (e) {
      continue;
    }

    for (const log of logs) {
      const tx = decodeTransferLog(log, token, chainId);
      tx.usdValue = tx.amount * price;
      if (tx.usdValue >= thresholdUsd) out.push(tx);
    }
  }
  return out;
}

module.exports = { pollTokensEtherscan, pollTokensRpc };
