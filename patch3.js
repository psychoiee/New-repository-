const fs = require('fs');
let c = fs.readFileSync('public/tracker.html', 'utf8');

c = c.replace(
  `BTC: { color: "#f7931a" }, ETH: { color: "#627eea" }, BNB: { color: "#f3ba2f" },
    LAB: { color: "#22e39a" }, ENA: { color: "#7c5cff" }, ANDREA: { color: "#ff6bd6" },
  };`,
  `BTC: { color: "#f7931a" }, ETH: { color: "#627eea" }, BNB: { color: "#f3ba2f" },
    LAB: { color: "#22e39a" }, ENA: { color: "#7c5cff" }, ANDREA: { color: "#ff6bd6" },
    SOL: { color: "#9945ff" },
  };`
);

c = c.replace(
  `{ label: "Ethereum", value: "ethereum" }, { label: "BSC", value: "bsc" },
  ];`,
  `{ label: "Ethereum", value: "ethereum" }, { label: "BSC", value: "bsc" },
    { label: "Solana", value: "solana" },
  ];`
);

fs.writeFileSync('public/tracker.html', c);
console.log('patched:', c.includes('"Solana"'));
