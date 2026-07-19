// Watched ERC-20/BEP-20 tokens, grouped by chain id (must match the "id"
// used in config/chains.js: "bsc", "ethereum", "polygon", "arbitrum").
//
// To START tracking a token: add a line like the example below.
// To STOP tracking it: delete that line. Takes effect on next deploy.
//
// You'll need: the token's contract address, its decimals (usually 18),
// and its CoinGecko id (for USD pricing).
//
// Example:
// bsc: [
//   { symbol: "LAB", address: "0xabc123...", decimals: 18, coingeckoId: "lab-token" },
// ],

module.exports = {
  bsc: [],
  ethereum: [],
  polygon: [],
  arbitrum: [],
};
