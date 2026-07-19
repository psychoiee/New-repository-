const fs = require('fs');
let c = fs.readFileSync('adapters/evm.js', 'utf8');

const oldFetchLine = `  const res = await fetch(url.toString());
  const data = await res.json();
  if (data.error) throw new Error(\`RPC \${method} failed: \${JSON.stringify(data.error)}\`);
  return data.result;
}`;

const newFetchLine = `  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url.toString());
      const data = await res.json();
      if (data.error) throw new Error(\`RPC \${method} failed: \${JSON.stringify(data.error)}\`);
      return data.result;
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1))); // brief backoff before retrying
    }
  }
  throw lastErr;
}`;

if (!c.includes(oldFetchLine)) {
  console.log('NO MATCH - aborting, no changes made');
} else {
  c = c.replace(oldFetchLine, newFetchLine);
  fs.writeFileSync('adapters/evm.js', c);
  console.log('patched:', c.includes('for (let attempt = 0; attempt < 3'));
}
