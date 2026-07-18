const { evmChains, rpcChains, nonEvmChains } = require("../config/chains");
const evmAdapter = require("../adapters/evm");
const jsonRpcEvmAdapter = require("../adapters/jsonRpcEvm");
const bitcoinAdapter = require("../adapters/bitcoin");
const store = require("./store");

const chainState = {};

function getThresholdUsd() {
  return Number(process.env.DEFAULT_THRESHOLD_USD || 100000);
}

async function pollChain(chainConfig, adapter) {
  const state = chainState[chainConfig.id] || {};
  try {
    const { newTransactions, nextState, warning } = await adapter.poll(
      chainConfig,
      state,
      getThresholdUsd()
    );
    if (warning) console.warn(`[${chainConfig.id}] ${warning}`);
    chainState[chainConfig.id] = nextState;
    if (newTransactions.length) {
      console.log(`[${chainConfig.id}] +${newTransactions.length} whale tx`);
      store.addTransactions(newTransactions);
    }
  } catch (err) {
    console.error(`[${chainConfig.id}] poll error:`, err.message);
  }
}

function startPolling() {
  for (const chainConfig of evmChains) {
    const intervalMs = Math.max(chainConfig.avgBlockTimeMs, 3000);
    pollChain(chainConfig, evmAdapter);
    setInterval(() => pollChain(chainConfig, evmAdapter), intervalMs);
  }

  for (const chainConfig of rpcChains) {
    const intervalMs = Math.max(chainConfig.avgBlockTimeMs, 3000);
    pollChain(chainConfig, jsonRpcEvmAdapter);
    setInterval(() => pollChain(chainConfig, jsonRpcEvmAdapter), intervalMs);
  }

  for (const chainConfig of nonEvmChains) {
    if (chainConfig.kind === "bitcoin") {
      pollChain(chainConfig, bitcoinAdapter);
      setInterval(() => pollChain(chainConfig, bitcoinAdapter), 20000);
    }
  }
}

module.exports = { startPolling };
