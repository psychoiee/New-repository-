require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const { WebSocketServer } = require("ws");

const apiRoutes = require("./routes/api");
const store = require("./services/store");
const { startPolling } = require("./services/poller");
const liquidations = require("./services/liquidations");
const gasTracker = require("./services/gasTracker");
const marketMovers = require("./services/marketMovers");
const stablecoinMints = require("./services/stablecoinMints");
const tronMints = require("./services/tronMints");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));
app.get("/", (req, res) => res.redirect("/tracker.html"));
app.use("/api", apiRoutes);

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (socket) => {
  const unsubscribe = store.onNewTransaction((tx) => {
    socket.send(JSON.stringify({ type: "transaction", data: tx }));
  });
  const unsubscribeLiq = liquidations.onNewLiquidation((liq) => {
    socket.send(JSON.stringify({ type: "liquidation", data: liq }));
  });
  socket.on("close", () => { unsubscribe(); unsubscribeLiq(); });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, async () => {
  console.log(`Whale tracker backend running on port ${PORT}`);
  await store.loadFromRedis();
  startPolling();
  // liquidations.start(); // temporarily disabled to test server stability
  gasTracker.start();
  marketMovers.start();
  stablecoinMints.start();
  tronMints.start();
  setInterval(() => {
    const m = process.memoryUsage();
    console.log(`[memory] rss=${Math.round(m.rss/1024/1024)}MB heapUsed=${Math.round(m.heapUsed/1024/1024)}MB heapTotal=${Math.round(m.heapTotal/1024/1024)}MB`);
  }, 60000);
});
// restart Mon Jul 27 18:13:09 PKT 2026
// force restart Mon Jul 27 19:29:10 PKT 2026
// restart Tue Jul 28 21:50:27 PKT 2026
// restart Wed Jul 29 03:07:37 PKT 2026
// restart trigger 1785277537
