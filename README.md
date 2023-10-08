# Auctions P2P test using hyperswarm

This project provides a P2P auction system using Hypercore and Hyperswarm.

## Setup

1. Clone the repository:

```
git clone https://github.com/PaingSoe93/auctions-test
cd auctions-test
```

2. Install dependencies:

```
yarn install
```

## Usage

### Starting the Server

To start the auction server:

```
yarn start:server
```

### Using the Client CLI

The client has several commands available:

Create an Auction

```
node rpc-client.js <ServerPubKey> createAuction <clientId> <itemName> <startingPrice>
```

Example

```
node rpc-client.js <ServerPubKey> createAuction client123 "Test Item" 100
```

Get Active Auctions

```
node rpc-client.js <ServerPubKey> getAuctions
```

Make a Bid

```
node rpc-client.js <ServerPubKey> makeBid <clientId> <auctionId> <bidAmount>
```

Example

```
node rpc-client.js makeBid client123 auctionId123 150
```

Close an Auction

```
node rpc-client.js closeAuction <auctionId>
```

Example

```
node rpc-client.js closeAuction auctionId123
```
