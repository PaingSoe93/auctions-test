"use strict";

const swarm = require("@hyperswarm/network")();
const hypercore = require("hypercore");
const RPC = require("@hyperswarm/rpc");

const main = async () => {
  const feed = hypercore("./db/auction-log-client");

  await new Promise((resolve) => feed.ready(resolve));

  swarm.join(feed.discoveryKey, {
    lookup: true,
    announce: true,
  });

  const rpc = new RPC();
  const serverPubKey = Buffer.from("YOUR_SERVER_PUBLIC_KEY", "hex");

  swarm.on("connection", (connection, details) => {
    connection.on("data", (data) => {
      try {
        const message = JSON.parse(data.toString());

        switch (message.type) {
          case "updateAuction":
            console.log(
              `Update received for auction ${message.auctionId}: Current highest bid is ${message.highestBid}`
            );
            break;

          case "newAuction":
            console.log(
              `New auction started! Auction ID: ${message.auctionId}, Item: ${message.item}, Starting Price: ${message.startingPrice}`
            );
            break;

          case "auctionClosed":
            if (message.highestBid) {
              console.log(
                `Auction ${message.auctionId} has closed. Winning bid is ${message.highestBid} by client ${message.clientId}`
              );
            } else {
              console.log(
                `Auction ${message.auctionId} has closed with no bids.`
              );
            }
            break;

          case "error":
            console.error(`Error received: ${message.errorMsg}`);
            break;

          default:
            console.warn(`Received unknown message type: ${message.type}`);
            break;
        }
      } catch (error) {
        console.error("Failed to parse incoming data:", error);
      }
    });
  });

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

  const sendToSwarm = (message) => {
    // Append the action to our hypercore log
    feed.append(JSON.stringify(message), (err) => {
      if (err) throw err;

      swarm.connections.forEach((peer) => {
        if (peer.remotePublicKey !== feed.key) {
          // Avoid sending back to self
          peer.send(Buffer.from(JSON.stringify(message)));
        }
      });
    });
  };

  const enhancedCreateAuction = async (clientId, item, startingPrice) => {
    const auctionId = await createAuction(clientId, item, startingPrice);
    sendToSwarm({
      type: "createAuction",
      clientId,
      item,
      startingPrice,
      auctionId,
    });
    return auctionId;
  };
};

const cli = async () => {
  const command = process.argv[2]; // Get the second argument as the command

  switch (command) {
    case "createAuction":
      const clientId = process.argv[3];
      const item = process.argv[4];
      const startingPrice = parseInt(process.argv[5], 10);
      const auctionId = await enhancedCreateAuction(
        clientId,
        item,
        startingPrice
      );
      console.log(`Auction created with ID: ${auctionId}`);
      break;

    case "getAuctions":
      const auctions = await getAuctions();
      console.log("Active auctions:", auctions);
      break;

    case "makeBid":
      const bidClientId = process.argv[3];
      const bidAuctionId = process.argv[4];
      const amount = parseInt(process.argv[5], 10);
      const bidSuccess = await makeBid(bidClientId, bidAuctionId, amount);
      console.log("Bid successful:", bidSuccess);
      break;

    case "closeAuction":
      const closeAuctionId = process.argv[3];
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

main().then(cli).catch(console.error);
