require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const { WebSocketServer } = require("ws");

const apiRoutes = require("./routes/api");
const store = require("./services/store");
const { startPolling } = require("./services/poller");
const liquidations = require("./services/liquidations");

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
});
// restart Mon Jul 27 18:13:09 PKT 2026
// force restart Mon Jul 27 19:29:10 PKT 2026
