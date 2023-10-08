"use strict";

const RPC = require("@hyperswarm/rpc");
const DHT = require("hyperdht");
const Hypercore = require("hypercore");
const Hyperbee = require("hyperbee");
const crypto = require("crypto");
const Auction = require("./model/auction");
const auctions = new Map();
const connectedClients = new Set();

const main = async () => {
  const hcore = new Hypercore("./db/rpc-server");
  const hbee = new Hyperbee(hcore, {
    keyEncoding: "utf-8",
    valueEncoding: "binary",
  });
  await hbee.ready();

  let dhtSeed = (await hbee.get("dht-seed"))?.value;
  if (!dhtSeed) {
    dhtSeed = crypto.randomBytes(32);
    await hbee.put("dht-seed", dhtSeed);
  }

  const dht = new DHT({
    keyPair: DHT.keyPair(dhtSeed),
  });
  await dht.ready();

  let rpcSeed = (await hbee.get("rpc-seed"))?.value;
  if (!rpcSeed) {
    rpcSeed = crypto.randomBytes(32);
    await hbee.put("rpc-seed", rpcSeed);
  }

  const rpc = new RPC({ seed: rpcSeed, dht });
  const rpcServer = rpc.createServer();

  rpcServer.on("connection", (client) => {
    const clientPublicKey = client.stream.remotePublicKey;
    if (clientPublicKey) {
      console.log(
        "Client connected on remotePublicKey:",
        clientPublicKey.toString("hex")
      );
      client.remotePublicKey = clientPublicKey.toString("hex");
      connectedClients.add(client);
    } else {
      console.error("Failed to get client's remote public key.");
    }

    client.on("end", () => {
      connectedClients.delete(client);
    });
  });

  await rpcServer.listen();
  console.log(
    "rpc server started listening on public key:",
    rpcServer.publicKey.toString("hex")
  );

  rpcServer.respond("ping", async (reqRaw) => {
    // reqRaw is Buffer, we need to parse it
    const req = JSON.parse(reqRaw.toString("utf-8"));

    const resp = { nonce: req.nonce + 1 };

    // we also need to return buffer response
    const respRaw = Buffer.from(JSON.stringify(resp), "utf-8");
    return respRaw;
  });

  rpcServer.respond("createAuction", async (reqRaw) => {
    try {
      const req = JSON.parse(reqRaw.toString("utf-8"));
      console.log("Server get req createAuction:", req);
      if (!req.clientId || !req.item || !req.startingPrice) {
        throw new Error("Invalid request");
      }
      const auctionId = crypto.randomBytes(32).toString("hex");
      const auction = new Auction(req.clientId, req.item, req.startingPrice);
      auctions.set(auctionId, auction);

      const resp = { auctionId };
      return Buffer.from(JSON.stringify(resp), "utf-8");
    } catch (error) {
      console.error("Error handling createAuction:", error.message);
      return Buffer.from(JSON.stringify({ error: error.message }), "utf-8");
    }
  });

  rpcServer.respond("getAuctions", async () => {
    const activeAuctions = Array.from(auctions.values()).filter(
      (a) => !a.closed
    );
    return Buffer.from(JSON.stringify(activeAuctions), "utf-8");
  });

  rpcServer.respond("makeBid", async (reqRaw) => {
    try {
      const req = JSON.parse(reqRaw.toString("utf-8"));
      const auction = auctions.get(req.auctionId);
      if (
        auction &&
        !auction.closed &&
        req.amount > auction.highestBid.amount
      ) {
        auction.addBid(req.clientId, req.amount);
        return Buffer.from(JSON.stringify({ success: true }), "utf-8");
      }
      return Buffer.from(JSON.stringify({ success: false }), "utf-8");
    } catch (error) {
      console.error("Error handling makeBid:", error.message);
      return Buffer.from(JSON.stringify({ error: error.message }), "utf-8");
    }
  });

  rpcServer.respond("closeAuction", async (reqRaw) => {
    try {
      const req = JSON.parse(reqRaw.toString("utf-8"));
      const auction = auctions.get(req.auctionId);
      if (auction && !auction.closed) {
        auction.closed = true;
        const resp = { highestBid: auction.highestBid };
        return Buffer.from(JSON.stringify(resp), "utf-8");
      }
      return Buffer.from(JSON.stringify({ success: false }), "utf-8");
    } catch (error) {
      console.error("Error handling closeAuction:", error.message);
      return Buffer.from(JSON.stringify({ error: error.message }), "utf-8");
    }
  });
};

main().catch(console.error);
