const WebSocket = require("ws");

// Free, no-API-key public stream of forced liquidations on Bybit.
const BYBIT_WS = "wss://stream.bybit.com/v5/public/linear";
const MAX_ITEMS = 100;
const SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT", "BNBUSDT", "DOGEUSDT"];

let feed = [];
const listeners = new Set();
let ws = null;

function connect() {
  try {
    ws = new WebSocket(BYBIT_WS);
  } catch (e) {
    console.warn("[liquidations] failed to create WebSocket:", e.message);
    scheduleReconnect();
    return;
  }

  let pingInterval = null;
  ws.on("open", () => {
    console.log("[liquidations] connected to Bybit, subscribing to liquidation topics");
    const args = SYMBOLS.map((s) => `allLiquidation.${s}`);
    ws.send(JSON.stringify({ op: "subscribe", args }));
    pingInterval = setInterval(() => {
      if (ws.readyState === ws.OPEN) ws.send(JSON.stringify({ op: "ping" }));
    }, 20000);
  });

  ws.on("message", (raw) => {
    try {
      const msg = JSON.parse(raw);
      if (msg.success !== undefined) {
        console.log("[liquidations] subscribe response:", JSON.stringify(msg));
        return;
      }
      if (!msg.topic || !msg.topic.startsWith("allLiquidation.") || !msg.data) return;
      const d = Array.isArray(msg.data) ? msg.data[0] : msg.data;
      if (!d) return;
      const qty = parseFloat(d.size);
      const price = parseFloat(d.price);
      const usdValue = qty * price;
      const liq = {
        symbol: d.symbol,
        side: d.side,
        qty,
        price,
        usdValue,
        exchange: "Bybit",
        timestamp: Number(d.updatedTime) || Date.now(),
      };
      feed = [liq, ...feed].slice(0, MAX_ITEMS);
      console.log(`[liquidations] +1 ${liq.symbol} $${Math.round(liq.usdValue)}`);
      for (const listener of listeners) listener(liq);
    } catch (e) {
      console.warn("[liquidations] failed to parse message:", e.message);
    }
  });

  ws.on("close", () => {
    if (pingInterval) clearInterval(pingInterval);
    console.warn("[liquidations] connection closed, reconnecting in 5s");
    scheduleReconnect();
  });

  ws.on("error", (e) => {
    console.warn("[liquidations] error:", e.message);
  });
}

function scheduleReconnect() {
  setTimeout(connect, 5000);
}

function start() {
  connect();
}

function getFeed({ minUsd } = {}) {
  return feed.filter((l) => !minUsd || l.usdValue >= minUsd);
}

function onNewLiquidation(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

module.exports = { start, getFeed, onNewLiquidation };
