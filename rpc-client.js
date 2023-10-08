"use strict";

const RPC = require("@hyperswarm/rpc");
const DHT = require("hyperdht");
const Hypercore = require("hypercore");
const Hyperbee = require("hyperbee");
const crypto = require("crypto");

let rpc;
let serverPubKey;
let rpcServer;

const main = async () => {
  serverPubKey = Buffer.from(process.argv[2], "hex");

  if (!serverPubKey) {
    console.error("Please provide the server's public key as an argument.");
    process.exit(1);
  }

  const hcore = new Hypercore("./db/rpc-client");
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

  rpc = new RPC({ dht });

  rpcServer = rpc.createServer();

  await rpcServer.listen();

  rpcServer.respond("auctionCreated", async (dataRaw) => {
    const data = JSON.parse(dataRaw.toString("utf-8"));
    console.log("Notification received: Auction created:", data);
    return Buffer.from("Received", "utf-8");
  });

  rpcServer.respond("bidMade", async (dataRaw) => {
    const data = JSON.parse(dataRaw.toString("utf-8"));
    console.log("Notification received: Bid made:", data);
    return Buffer.from("Received", "utf-8");
  });

  rpcServer.respond("auctionClosed", async (dataRaw) => {
    const data = JSON.parse(dataRaw.toString("utf-8"));
    console.log("Notification received: Auction closed:", data);
    return Buffer.from("Received", "utf-8");
  });

  const payload = { nonce: 126 };
  const payloadRaw = Buffer.from(JSON.stringify(payload), "utf-8");

  const respRaw = await rpc.request(serverPubKey, "ping", payloadRaw);
  const resp = JSON.parse(respRaw.toString("utf-8"));
  console.log(resp);

  cli();
};

const createAuction = async (clientId, item, startingPrice) => {
  const payload = { clientId, item, startingPrice };
  const respRaw = await rpc.request(
    serverPubKey,
    "createAuction",
    Buffer.from(JSON.stringify(payload), "utf-8")
  );
  const resp = JSON.parse(respRaw.toString("utf-8"));
  return resp.auctionId;
};

const getAuctions = async () => {
  const respRaw = await rpc.request(serverPubKey, "getAuctions");
  return JSON.parse(respRaw.toString("utf-8"));
};

const makeBid = async (clientId, auctionId, amount) => {
  const payload = { clientId, auctionId, amount };
  const respRaw = await rpc.request(
    serverPubKey,
    "makeBid",
    Buffer.from(JSON.stringify(payload), "utf-8")
  );
  const resp = JSON.parse(respRaw.toString("utf-8"));
  return resp.success;
};

const closeAuction = async (auctionId) => {
  const payload = { auctionId };
  const respRaw = await rpc.request(
    serverPubKey,
    "closeAuction",
    Buffer.from(JSON.stringify(payload), "utf-8")
  );
  const resp = JSON.parse(respRaw.toString("utf-8"));
  return resp.highestBid;
};

const cli = async () => {
  const command = process.argv[3];

  console.log(command);

  switch (command) {
    case "createAuction":
      const clientId = process.argv[4];
      const item = process.argv[5];
      const startingPrice = parseInt(process.argv[6], 10);
      console.log(
        `${clientId} Creating auction for ${item} with starting price ${startingPrice}`
      );
      const auctionId = await createAuction(clientId, item, startingPrice);
      console.log(`Auction created with ID: ${auctionId}`);
      break;

    case "getAuctions":
      const auctions = await getAuctions();
      console.log("Active auctions:", auctions);
      break;

    case "makeBid":
      const bidClientId = process.argv[4];
      const bidAuctionId = process.argv[5];
      const amount = parseInt(process.argv[6], 10);
      const bidSuccess = await makeBid(bidClientId, bidAuctionId, amount);
      console.log("Bid successful:", bidSuccess);
      break;

    case "closeAuction":
      const closeAuctionId = process.argv[4];
      const highestBidAfterClosure = await closeAuction(closeAuctionId);
      console.log("Highest bid after auction closure:", highestBidAfterClosure);
      break;

    default:
      console.error(
        "Unknown command. Available commands are: createAuction, getAuctions, makeBid, closeAuction."
      );
      break;
  }
};

main().catch(console.error);
