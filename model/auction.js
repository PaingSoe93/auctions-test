class Auction {
  constructor(clientId, item, startingPrice) {
    this.clientId = clientId;
    this.item = item;
    this.startingPrice = startingPrice;
    this.bids = []; // list of bids { clientId, amount }
    this.closed = false;
  }

  addBid(clientId, amount) {
    this.bids.push({ clientId, amount });
  }

  get highestBid() {
    return this.bids.reduce(
      (acc, curr) => (curr.amount > acc.amount ? curr : acc),
      { amount: 0 }
    );
  }
}

module.exports = Auction;
