'use strict';

// ... imports ...

const auctions = new Map(); // key: auctionId, value: Auction instance

const main = async () => {
  // ... initial setup ...

  rpcServer.respond('createAuction', async (reqRaw) => {
    const req = JSON.parse(reqRaw.toString('utf-8'));
    const auctionId = crypto.randomBytes(32).toString('hex');
    const auction = new Auction(req.clientId, req.item, req.startingPrice);
    auctions.set(auctionId, auction);
    
    const resp = { auctionId };
    const respRaw = Buffer.from(JSON.stringify(resp), 'utf-8');
    return respRaw;
  });

  rpcServer.respond('getAuctions', async () => {
    const activeAuctions = Array.from(auctions.values()).filter(a => !a.closed);
    const respRaw = Buffer.from(JSON.stringify(activeAuctions), 'utf-8');
    return respRaw;
  });

  rpcServer.respond('makeBid', async (reqRaw) => {
    const req = JSON.parse(reqRaw.toString('utf-8'));
    const auction = auctions.get(req.auctionId);
    if (auction && !auction.closed && req.amount > auction.highestBid.amount) {
      auction.addBid(req.clientId, req.amount);
      const resp = { success: true };
      return Buffer.from(JSON.stringify(resp), 'utf-8');
    }
    return Buffer.from(JSON.stringify({ success: false }), 'utf-8');
  });

  rpcServer.respond('closeAuction', async (reqRaw) => {
    const req = JSON.parse(reqRaw.toString('utf-8'));
    const auction = auctions.get(req.auctionId);
    if (auction && !auction.closed) {
      auction.closed = true;
      const resp = {
        highestBid: auction.highestBid,
      };
      return Buffer.from(JSON.stringify(resp), 'utf-8');
    }
    return Buffer.from(JSON.stringify({ success: false }), 'utf-8');
  });
  
  // ... remaining code ...
}
