const WebSocket = require("ws");

// Free, no-API-key public stream of forced liquidations on Binance Futures.
const BINANCE_LIQ_WS = "wss://fstream.binance.com/ws/!forceOrder@arr";
const MAX_ITEMS = 100;

let feed = [];
const listeners = new Set();
let ws = null;

function connect() {
  try {
    ws = new WebSocket(BINANCE_LIQ_WS);
  } catch (e) {
    console.warn("[liquidations] failed to create WebSocket:", e.message);
    scheduleReconnect();
    return;
  }

  ws.on("open", () => {
    console.log("[liquidations] connected to Binance liquidation stream");
  });

  ws.on("message", (raw) => {
    try {
      const msg = JSON.parse(raw);
      const o = msg.o;
      if (!o) {
        console.log("[liquidations] unexpected message shape:", raw.toString().slice(0, 200));
        return;
      }
      const qty = parseFloat(o.q);
      const price = parseFloat(o.ap || o.p);
      const usdValue = qty * price;
      const liq = {
        symbol: o.s,
        side: o.S,
        qty,
        price,
        usdValue,
        exchange: "Binance",
        timestamp: o.T || Date.now(),
      };
      feed = [liq, ...feed].slice(0, MAX_ITEMS);
      console.log(`[liquidations] +1 ${liq.symbol} $${Math.round(liq.usdValue)}`);
      for (const listener of listeners) listener(liq);
    } catch (e) {
      console.warn("[liquidations] failed to parse message:", e.message);
    }
  });

  ws.on("close", () => {
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
