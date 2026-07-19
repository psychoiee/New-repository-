const fs = require('fs');
let c = fs.readFileSync('adapters/evm.js', 'utf8');

c = c.replace(
  `let lastCallAt = 0;
async function throttle() {
  const minGapMs = 400; // stay under Etherscan's 3 req/sec shared limit
  const wait = lastCallAt + minGapMs - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCallAt = Date.now();
}`,
  `let lastCallAt = 0;
let queue = Promise.resolve();
function throttle() {
  // Chain every call onto a single queue so requests are strictly
  // serialized (no two calls can race past the gap check together).
  queue = queue.then(async () => {
    const minGapMs = 500; // stay comfortably under Etherscan's 3 req/sec shared limit
    const wait = lastCallAt + minGapMs - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCallAt = Date.now();
  });
  return queue;
}`
);

fs.writeFileSync('adapters/evm.js', c);
console.log('patched:', c.includes('let queue = Promise.resolve()'));
