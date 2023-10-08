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

Connect client to Server

```
node rpc-client.js <ServerPubKey>
```

The client has several commands available:

Create an Auction

```
createAuction <clientId> <itemName> <startingPrice>
```

Example

```
createAuction client123 "TestItem" 100
```

Get Active Auctions

```
getAuctions
```

Make a Bid

```
makeBid <clientId> <auctionId> <bidAmount>
```

Example

```
makeBid client123 auctionId123 150
```

Close an Auction

```
closeAuction <auctionId>
```

Example

```
closeAuction auctionId123
```
