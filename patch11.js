const fs = require('fs');
let c = fs.readFileSync('adapters/jsonRpcEvm.js', 'utf8');

c = c.replace(
  `const { getPriceUsd } = require("../services/priceService");`,
  `const { getPriceUsd } = require("../services/priceService");
const { pollTokensRpc } = require("../services/tokenWatch");
const watchedTokens = require("../config/tokens");`
);

c = c.replace(
  `  return { newTransactions, nextState: { lastBlock: latestBlock } };
}`,
  `  const tokens = watchedTokens[chainConfig.id] || [];
  if (tokens.length) {
    try {
      const tokenTxs = await pollTokensRpc({
        rpcUrl,
        chainId: chainConfig.id,
        tokens,
        fromBlockHex: "0x" + (lastBlock + 1).toString(16),
        toBlockHex: "0x" + latestBlock.toString(16),
        thresholdUsd,
      });
      newTransactions.push(...tokenTxs);
    } catch (e) {
      // token lookups are a bonus feature - never let them break native tracking
    }
  }

  return { newTransactions, nextState: { lastBlock: latestBlock } };
}`
);

fs.writeFileSync('adapters/jsonRpcEvm.js', c);
console.log('patched:', c.includes('pollTokensRpc'));
