const fs = require('fs');
let c = fs.readFileSync('adapters/evm.js', 'utf8');

c = c.replace(
  `const { getPriceUsd } = require("../services/priceService");`,
  `const { getPriceUsd } = require("../services/priceService");
const { pollTokensEtherscan } = require("../services/tokenWatch");
const watchedTokens = require("../config/tokens");`
);

c = c.replace(
  `  return { newTransactions, nextState: { lastBlock: latestBlock } };
}`,
  `  const tokens = watchedTokens[chainConfig.id] || [];
  if (tokens.length) {
    try {
      const tokenTxs = await pollTokensEtherscan({
        apiBase: chainConfig.apiBase,
        chainId: chainConfig.chainId,
        apiKey,
        tokens,
        fromBlock: lastBlock + 1,
        toBlock: latestBlock,
        thresholdUsd,
      });
      for (const tx of tokenTxs) {
        tx.chain = chainConfig.id;
        newTransactions.push(tx);
      }
    } catch (e) {
      // token lookups are a bonus feature - never let them break native tracking
    }
  }

  return { newTransactions, nextState: { lastBlock: latestBlock } };
}`
);

fs.writeFileSync('adapters/evm.js', c);
console.log('patched:', c.includes('pollTokensEtherscan'));
