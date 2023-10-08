"use strict";

const hypercore = require("hypercore");
const RPC = require("@hyperswarm/rpc");
const swarm = require("@hyperswarm/network")();
const crypto = require("crypto");
const Auction = require("./model/auction");
const auctions = new Map();
const rpcServer = new RPC();

const main = async () => {
  const feed = hypercore("./db/auction-log");

  await new Promise((resolve) => feed.ready(resolve));

  swarm.join(feed.discoveryKey, {
    lookup: true,
    announce: true,
  });

  swarm.on("connection", (connection, details) => {
    connection.on("data", (data) => {
      const message = JSON.parse(data.toString());

      switch (message.type) {
        case "createAuction":
          // ... handle auction creation ...
          break;
        case "makeBid":
          // ... handle bid ...
          break;
        case "closeAuction":
          // ... handle auction closure ...
          break;
        default:
          break;
      }
    });
  });

  rpcServer.respond("createAuction", async (reqRaw) => {
    try {
      const req = JSON.parse(reqRaw.toString("utf-8"));
      if (!req.clientId || !req.item || !req.startingPrice) {
        throw new Error("Invalid request");
      }
      const auctionId = crypto.randomBytes(32).toString("hex");
      const auction = new Auction(req.clientId, req.item, req.startingPrice);
      auctions.set(auctionId, auction);

      const resp = { auctionId };
      const respRaw = Buffer.from(JSON.stringify(resp), "utf-8");
      return respRaw;
    } catch (error) {
      console.error("Error handling createAuction:", error.message);
      return Buffer.from(JSON.stringify({ error: error.message }), "utf-8");
    }
  });

  rpcServer.respond("getAuctions", async () => {
    const activeAuctions = Array.from(auctions.values()).filter(
      (a) => !a.closed
    );
    const respRaw = Buffer.from(JSON.stringify(activeAuctions), "utf-8");
    return respRaw;
  });

  rpcServer.respond("makeBid", async (reqRaw) => {
    const req = JSON.parse(reqRaw.toString("utf-8"));
    const auction = auctions.get(req.auctionId);
    if (auction && !auction.closed && req.amount > auction.highestBid.amount) {
      auction.addBid(req.clientId, req.amount);
      const resp = { success: true };
      return Buffer.from(JSON.stringify(resp), "utf-8");
    }
    return Buffer.from(JSON.stringify({ success: false }), "utf-8");
  });

  rpcServer.respond("closeAuction", async (reqRaw) => {
    const req = JSON.parse(reqRaw.toString("utf-8"));
    const auction = auctions.get(req.auctionId);
    if (auction && !auction.closed) {
      auction.closed = true;
      const resp = {
        highestBid: auction.highestBid,
      };
      return Buffer.from(JSON.stringify(resp), "utf-8");
    }
    return Buffer.from(JSON.stringify({ success: false }), "utf-8");
  });
};

main().catch(console.error);
