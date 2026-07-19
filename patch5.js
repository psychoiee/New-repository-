const fs = require('fs');
let c = fs.readFileSync('public/tracker.html', 'utf8');
c = c.replace(
  `{ label: "Polygon", value: "polygon" },
    { label: "Arbitrum", value: "arbitrum" },
  ];`,
  `{ label: "Polygon", value: "polygon" },
    { label: "Arbitrum", value: "arbitrum" }, { label: "Tron", value: "tron" },
  ];`
);
c = c.replace(
  `POL: { color: "#8247e5" }, ETH: { color: "#627eea" },
  };`,
  `POL: { color: "#8247e5" }, ETH: { color: "#627eea" }, TRX: { color: "#ff0013" },
  };`
);
fs.writeFileSync('public/tracker.html', c);
console.log('patched:', c.includes('"Tron"'));
