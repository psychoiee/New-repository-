const fetch = require("node-fetch");
const { getPriceUsd } = require("../services/priceService");

async function tronPost(path, apiKey, body) {
  const res = await fetch(`https://api.trongrid.io${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "TRON-PRO-API-KEY": apiKey },
    body: JSON.stringify(body || {}),
  });
  return res.json();
}

async function poll(chainConfig, state, thresholdUsd) {
  const apiKey = process.env[chainConfig.apiKeyEnv];
  if (!apiKey || apiKey.includes("your_")) {
    return { newTransactions: [], nextState: state, warning: `Missing ${chainConfig.apiKeyEnv} in .env` };
  }

  const nowBlock = await tronPost("/wallet/getnowblock", apiKey, {});
  const latestNum = nowBlock.block_header.raw_data.number;
  let lastNum = state.lastNum ?? latestNum - 1;
  if (latestNum - lastNum > 5) lastNum = latestNum - 5;

  const priceUsd = await getPriceUsd("tron");
  const newTransactions = [];

  for (let n = lastNum + 1; n <= latestNum; n++) {
    const block = await tronPost("/wallet/getblockbynum", apiKey, { num: n, visible: true });
    if (!block.transactions) continue;

    for (const tx of block.transactions) {
      const contract = tx.raw_data && tx.raw_data.contract && tx.raw_data.contract[0];
      if (!contract || contract.type !== "TransferContract") continue;
      const val = contract.parameter.value;
      const amount = (val.amount || 0) / 1e6;
      const usdValue = amount * priceUsd;
      if (usdValue >= thresholdUsd) {
        newTransactions.push({
          chain: "tron",
          hash: tx.txID,
          from: val.owner_address,
          to: val.to_address,
          symbol: "TRX",
          amount,
          usdValue,
          timestamp: Date.now(),
        });
      }
    }
  }

  return { newTransactions, nextState: { lastNum: latestNum } };
}

module.exports = { poll };
