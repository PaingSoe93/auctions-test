"use strict";

const hypercore = require("hypercore");
const RPC = require("@hyperswarm/rpc");
const swarm = require("@hyperswarm/network")();
const crypto = require("crypto");
const Auction = require("./model/auction");
const auctions = new Map();
const rpcServer = new RPC();

const main = async () => {
  const feed = new hypercore("./db/auction-log");

  console.log("Initializing feed...");

  await new Promise((resolve, reject) => {
    feed.ready((err) => {
      if (err) {
        console.error("Error initializing feed:", err);
        reject(err);
        return;
      }
      console.log("Feed initialized.");
      resolve();
    });
  });

  console.log(`Server public key: ${feed.key.toString("hex")}`);

  swarm.join(feed.discoveryKey, {
    lookup: true,
    announce: true,
  });

  const createNewAuction = (clientId, item, startingPrice) => {
    const auctionId = crypto.randomBytes(16).toString("hex");
    const auction = new Auction(clientId, item, startingPrice);
    auctions.set(auctionId, auction);
    feed.append(
      JSON.stringify({
        action: "createAuction",
        auctionId,
        clientId,
        item,
        startingPrice,
      })
    );
    return auctionId;
  };

  const placeBid = (clientId, auctionId, amount) => {
    const auction = auctions.get(auctionId);
    if (!auction || auction.closed) return false;

    const success = auction.addBid(clientId, amount);
    if (success) {
      feed.append(
        JSON.stringify({
          action: "makeBid",
          auctionId,
          clientId,
          amount,
        })
      );
    }
    return success;
  };

  const closeAnAuction = (auctionId) => {
    const auction = auctions.get(auctionId);
    if (!auction || auction.closed) return null;

    auction.closed = true;
    feed.append(
      JSON.stringify({
        action: "closeAuction",
        auctionId,
      })
    );
    return auction.highestBid;
  };

  swarm.on("connection", (connection, details) => {
    connection.on("data", async (data) => {
      try {
        const message = JSON.parse(data.toString());

        switch (message.type) {
          case "createAuction":
            const auctionId = createNewAuction(
              message.clientId,
              message.item,
              message.startingPrice
            );
            connection.write(
              JSON.stringify({ type: "createAuctionResponse", auctionId })
            );
            break;

          case "makeBid":
            const success = placeBid(
              message.clientId,
              message.auctionId,
              message.amount
            );
            connection.write(
              JSON.stringify({ type: "makeBidResponse", success })
            );
            break;

          case "closeAuction":
            const highestBid = closeAnAuction(message.auctionId);
            connection.write(
              JSON.stringify({ type: "closeAuctionResponse", highestBid })
            );
            break;

          default:
            connection.write(
              JSON.stringify({ type: "error", message: "Unknown command" })
            );
            break;
        }
      } catch (error) {
        console.error("Error in connection data event:", error.message);
        connection.write(
          JSON.stringify({ type: "error", message: error.message })
        );
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

  process.on("SIGINT", () => {
    console.log("\nGracefully shutting down from SIGINT (Ctrl+C)");
    rpcServer.destroy((err) => {
      if (err) console.error("Error shutting down rpcServer:", err);
      else console.log("rpcServer shut down successfully.");
    });
    swarm.destroy((err) => {
      if (err) console.error("Error shutting down swarm:", err);
      else console.log("Swarm shut down successfully.");
      process.exit();
    });
  });
};

main().catch(console.error);
