'use strict';

// ... imports ...

const main = async () => {
  // ... initial setup ...

  const createAuction = async (clientId, item, startingPrice) => {
    const payload = { clientId, item, startingPrice };
    const respRaw = await rpc.request(serverPubKey, 'createAuction', Buffer.from(JSON.stringify(payload), 'utf-8'));
    const resp = JSON.parse(respRaw.toString('utf-8'));
    return resp.auctionId;
  };

  const getAuctions = async () => {
    const respRaw = await rpc.request(serverPubKey, 'getAuctions');
    return JSON.parse(respRaw.toString('utf-8'));
  };

  const makeBid = async (clientId, auctionId, amount) => {
    const payload = { clientId, auctionId, amount };
    const respRaw = await rpc.request(serverPubKey, 'makeBid', Buffer.from(JSON.stringify(payload), 'utf-8'));
    const resp = JSON.parse(respRaw.toString('utf-8'));
    return resp.success;
  };

  const closeAuction = async (auctionId) => {
    const payload = { auctionId };
    const respRaw = await rpc.request(serverPubKey, 'closeAuction', Buffer.from(JSON.stringify(payload), 'utf-8'));
    const resp = JSON.parse(respRaw.toString('utf-8'));
    return resp.highestBid;
  };

  // ... remaining code ...
}
