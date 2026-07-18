const fetch = require("node-fetch");
const { getPriceUsd } = require("../services/priceService");

async function poll(chainConfig, state, thresholdUsd) {
  const latestRes = await fetch("https://blockchain.info/latestblock");
  const latest = await latestRes.json();
  const latestHeight = latest.height;

  let lastHeight = state.lastHeight ?? latestHeight - 1;
  if (latestHeight - lastHeight > 3) lastHeight = latestHeight - 3;

  const priceUsd = await getPriceUsd("bitcoin");
  const newTransactions = [];

  for (let h = lastHeight + 1; h <= latestHeight; h++) {
    const blockRes = await fetch(`https://blockchain.info/block-height/${h}?format=json`);
    const blockData = await blockRes.json();
    const block = blockData.blocks && blockData.blocks[0];
    if (!block) continue;

    for (const tx of block.tx) {
      const totalOutSatoshi = (tx.out || []).reduce((sum, o) => sum + (o.value || 0), 0);
      const amountBtc = totalOutSatoshi / 1e8;
      const usdValue = amountBtc * priceUsd;
      if (usdValue >= thresholdUsd) {
        const firstOut = (tx.out || [])[0] || {};
        newTransactions.push({
          chain: "bitcoin",
          hash: tx.hash,
          from: (tx.inputs && tx.inputs[0] && tx.inputs[0].prev_out && tx.inputs[0].prev_out.addr) || "unknown",
          to: firstOut.addr || "unknown",
          symbol: "BTC",
          amount: amountBtc,
          usdValue,
          timestamp: Date.now(),
        });
      }
    }
  }

  return { newTransactions, nextState: { lastHeight: latestHeight } };
}

module.exports = { poll };
