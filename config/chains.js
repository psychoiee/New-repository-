const EVM_API_BASE = "https://api.etherscan.io/v2/api";

const evmChains = [
  { id: "ethereum", label: "Ethereum", nativeSymbol: "ETH", apiBase: EVM_API_BASE, chainId: 1, apiKeyEnv: "ETHERSCAN_API_KEY", coingeckoId: "ethereum", avgBlockTimeMs: 12000 },
  { id: "polygon", label: "Polygon", nativeSymbol: "POL", apiBase: EVM_API_BASE, chainId: 137, apiKeyEnv: "ETHERSCAN_API_KEY", coingeckoId: "polygon-ecosystem-token", avgBlockTimeMs: 2000 },
  { id: "arbitrum", label: "Arbitrum", nativeSymbol: "ETH", apiBase: EVM_API_BASE, chainId: 42161, apiKeyEnv: "ETHERSCAN_API_KEY", coingeckoId: "ethereum", avgBlockTimeMs: 500 },
  
];

const rpcChains = [
  { id: "bsc", label: "BNB Smart Chain", nativeSymbol: "BNB", rpcUrlEnv: "BSC_RPC_URL", coingeckoId: "binancecoin", avgBlockTimeMs: 3000 },
  { id: "solana", label: "Solana", nativeSymbol: "SOL", rpcUrlEnv: "SOLANA_RPC_URL", coingeckoId: "solana", avgBlockTimeMs: 1000, kind: "solana" },
  { id: "tron", label: "Tron", nativeSymbol: "TRX", apiKeyEnv: "TRONGRID_API_KEY", coingeckoId: "tron", avgBlockTimeMs: 3000, kind: "tron" },
];

const nonEvmChains = [
  { id: "bitcoin", label: "Bitcoin", nativeSymbol: "BTC", coingeckoId: "bitcoin", kind: "bitcoin" },
];

module.exports = { evmChains, rpcChains, nonEvmChains };
