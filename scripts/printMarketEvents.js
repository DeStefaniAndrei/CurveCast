const hre = require("hardhat");

async function main() {
  // --- CONFIG ---
  const marketAddress = "0xCDD819C65fc692166608C10C83F4CbA7eb32FA1e"; // Set this to your deployed market address

  const market = await hre.ethers.getContractAt("PredictionMarket", marketAddress);
  const latestBlock = await hre.ethers.provider.getBlockNumber();

  function printEvent(evt, name) {
    function replacer(key, value) {
      if (typeof value === 'bigint') return value.toString();
      if (Array.isArray(value)) return value.map(v => (typeof v === 'bigint' ? v.toString() : v));
      return value;
    }
    console.log(`\n[${name}]`);
    console.log(`Block: ${evt.blockNumber}`);
    console.log(`Tx:    ${evt.transactionHash}`);
    // Special handling for PriceReceived event to decode price
    if (name === "PriceReceived" && evt.args && evt.args.length > 0) {
      const raw = evt.args[0];
      // Chainlink BTC/USD feeds are typically 8 decimals
      const price = Number(raw.toString()) / 1e8;
      console.log(`BTC/USD Price: ${price}`);
    }
    console.log(`Args:  ${JSON.stringify(evt.args, replacer, 2)}`);
  }

  // Fetch and print MarketClosed events
  const closedEvents = await market.queryFilter(market.filters.MarketClosed(), 0, latestBlock);
  closedEvents.forEach(evt => printEvent(evt, "MarketClosed"));

  // Fetch and print PriceRequested events
  const priceReqEvents = await market.queryFilter(market.filters.PriceRequested(), 0, latestBlock);
  priceReqEvents.forEach(evt => printEvent(evt, "PriceRequested"));

  // Fetch and print FeeTokenSpent events
  if (market.filters.FeeTokenSpent) {
    const feeEvents = await market.queryFilter(market.filters.FeeTokenSpent(), 0, latestBlock);
    feeEvents.forEach(evt => printEvent(evt, "FeeTokenSpent"));
  }

  // Fetch and print MarketResolved events
  if (market.filters.MarketResolved) {
    const resolvedEvents = await market.queryFilter(market.filters.MarketResolved(), 0, latestBlock);
    resolvedEvents.forEach(evt => printEvent(evt, "MarketResolved"));
  }

  // Fetch and print PriceReceived events (with decoded price)
  if (market.filters.PriceReceived) {
    const priceReceivedEvents = await market.queryFilter(market.filters.PriceReceived(), 0, latestBlock);
    priceReceivedEvents.forEach(evt => printEvent(evt, "PriceReceived"));
  }

  // Fetch and print PredictionSubmitted events
  if (market.filters.PredictionSubmitted) {
    const predEvents = await market.queryFilter(market.filters.PredictionSubmitted(), 0, latestBlock);
    predEvents.forEach(evt => printEvent(evt, "PredictionSubmitted"));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 