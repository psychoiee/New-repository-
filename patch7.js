const fs = require('fs');
let c = fs.readFileSync('adapters/evm.js', 'utf8');

c = c.replace(
  `async function rpc(apiBase, chainId, apiKey, method, params) {`,
  `let lastCallAt = 0;
async function throttle() {
  const minGapMs = 400; // stay under Etherscan's 3 req/sec shared limit
  const wait = lastCallAt + minGapMs - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCallAt = Date.now();
}

async function rpc(apiBase, chainId, apiKey, method, params) {
  await throttle();`
);

c = c.replace(
  `if (latestBlock - lastBlock > 5) lastBlock = latestBlock - 5;`,
  `if (latestBlock - lastBlock > 2) lastBlock = latestBlock - 2;`
);

fs.writeFileSync('adapters/evm.js', c);
console.log('patched:', c.includes('throttle'));
