const MAX_ITEMS = 500;
let feed = [];
const listeners = new Set();

function addTransactions(txs) {
  if (!txs.length) return;
  feed = [...txs, ...feed].slice(0, MAX_ITEMS);
  for (const listener of listeners) {
    txs.forEach((tx) => listener(tx));
  }
}

function getFeed({ chain, minUsd } = {}) {
  return feed.filter(
    (tx) => (!chain || chain === "ALL" || tx.chain === chain) && (!minUsd || tx.usdValue >= minUsd)
  );
}

function onNewTransaction(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

module.exports = { addTransactions, getFeed, onNewTransaction };
