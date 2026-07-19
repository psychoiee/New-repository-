const fs = require('fs');
let c = fs.readFileSync('services/poller.js', 'utf8');
c = c.replace(
  `for (const chainConfig of evmChains) {
    const intervalMs = Math.max(chainConfig.avgBlockTimeMs, 3000);`,
  `for (const chainConfig of evmChains) {
    const intervalMs = Math.max(chainConfig.avgBlockTimeMs, 8000);`
);
fs.writeFileSync('services/poller.js', c);
console.log('patched:', c.includes('8000'));
