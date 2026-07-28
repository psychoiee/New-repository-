const express = require("express");
const store = require("../services/store");
const liquidations = require("../services/liquidations");
const gasTracker = require("../services/gasTracker");
const marketMovers = require("../services/marketMovers");
const stablecoinMints = require("../services/stablecoinMints");
const tronMints = require("../services/tronMints");
const { evmChains, rpcChains, nonEvmChains } = require("../config/chains");

const router = express.Router();

router.get("/chains", (req, res) => {
  const all = [...evmChains, ...rpcChains, ...nonEvmChains].map((c) => ({ id: c.id, label: c.label, symbol: c.nativeSymbol }));
  res.json(all);
});

router.get("/transactions", (req, res) => {
  const chain = req.query.chain || "ALL";
  const minUsd = req.query.minUsd ? Number(req.query.minUsd) : undefined;
  res.json(store.getFeed({ chain, minUsd }));
});

router.get("/liquidations", (req, res) => {
  const minUsd = req.query.minUsd ? Number(req.query.minUsd) : undefined;
  res.json(liquidations.getFeed({ minUsd }));
});

router.get("/gas", (req, res) => {
  res.json(gasTracker.getGas() || {});
});

router.get("/movers", (req, res) => {
  res.json(marketMovers.getMovers());
});

router.get("/mints", (req, res) => {
  res.json(stablecoinMints.getFeed());
});

router.get("/mints/tron", (req, res) => {
  res.json(tronMints.getFeed());
});

module.exports = router;
