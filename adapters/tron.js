const fetch = require("node-fetch");
const { getPriceUsd } = require("../services/priceService");

const USDT_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
const TRANSFER_SELECTOR = "a9059cbb";

async function tronPost(path, apiKey, body) {
  const res = await fetch(`https://api.trongrid.io${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "TRON-PRO-API-KEY": apiKey },
    body: JSON.stringify(body || {}),
  });
  return res.json();
}

function decodeUsdtTransfer(data) {
  // data = "a9059cbb" + 32-byte padded address + 32-byte padded amount (hex)
  if (!data || !data.startsWith(TRANSFER_SELECTOR)) return null;
  const toHex = data.slice(8, 72).slice(-40);
  const amountHex = data.slice(72, 136);
  const amount = Number(BigInt("0x" + amountHex)) / 1e6; // USDT has 6 decimals
  return { to: "41" + toHex, amount };
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
  let usdtPrice = null;
  const newTransactions = [];

  for (let n = lastNum + 1; n <= latestNum; n++) {
    const block = await tronPost("/wallet/getblockbynum", apiKey, { num: n, visible: true });
    if (!block.transactions) continue;
    for (const tx of block.transactions) {
      const contract = tx.raw_data && tx.raw_data.contract && tx.raw_data.contract[0];
      if (!contract) continue;

      if (contract.type === "TransferContract") {
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
      } else if (contract.type === "TriggerSmartContract") {
        const val = contract.parameter.value;
        if (val.contract_address !== USDT_CONTRACT) continue;
        const decoded = decodeUsdtTransfer(val.data);
        if (!decoded) continue;
        if (usdtPrice === null) {
          try { usdtPrice = await getPriceUsd("tether"); } catch (e) { usdtPrice = 1; }
        }
        const usdValue = decoded.amount * usdtPrice;
        if (usdValue >= thresholdUsd) {
          newTransactions.push({
            chain: "tron",
            hash: tx.txID,
            from: val.owner_address,
            to: decoded.to,
            symbol: "USDT",
            amount: decoded.amount,
            usdValue,
            timestamp: Date.now(),
          });
        }
      }
    }
  }

  return { newTransactions, nextState: { lastNum: latestNum } };
}

module.exports = { poll };
