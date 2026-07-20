const fs = require('fs');
let c = fs.readFileSync('services/store.js', 'utf8');

c = c.replace(
  `async function redisCommand(command) {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return null;`,
  `async function redisCommand(command) {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) {
    console.warn("[store] Upstash credentials missing - UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN not set. Skipping persistence.");
    return null;
  }`
);

fs.writeFileSync('services/store.js', c);
console.log('patched:', c.includes('Upstash credentials missing'));
