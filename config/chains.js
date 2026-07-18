const EVM_API_BASE = "https://api.etherscan.io/v2/api";

const evmChains = [
  { id: "ethereum", label: "Ethereum", nativeSymbol: "ETH", apiBase: EVM_API_BASE, chainId: 1, apiKeyEnv: "ETHERSCAN_API_KEY", coingeckoId: "ethereum", avgBlockTimeMs: 12000 },
];

const rpcChains = [
  { id: "bsc", label: "BNB Smart Chain", nativeSymbol: "BNB", rpcUrlEnv: "BSC_RPC_URL", coingeckoId: "binancecoin", avgBlockTimeMs: 3000 },
];

const nonEvmChains = [
  { id: "bitcoin", label: "Bitcoin", nativeSymbol: "BTC", coingeckoId: "bitcoin", kind: "bitcoin" },
];

module.exports = { evmChains, rpcChains, nonEvmChains };
