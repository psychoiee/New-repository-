const fs = require('fs');
let c = fs.readFileSync('public/tracker.html', 'utf8');

c = c.replace(
  `{ label: "BSC", value: "bsc" },
    { label: "Solana", value: "solana" },
  ];`,
  `{ label: "BSC", value: "bsc" },
    { label: "Solana", value: "solana" }, { label: "Polygon", value: "polygon" },
    { label: "Arbitrum", value: "arbitrum" },
  ];`
);

c = c.replace(
  `SOL: { color: "#9945ff" },
  };`,
  `SOL: { color: "#9945ff" }, POL: { color: "#8247e5" }, ETH: { color: "#627eea" },
  };`
);

fs.writeFileSync('public/tracker.html', c);
console.log('patched:', c.includes('"Polygon"'));
