const hre = require("hardhat");

async function main() {
  const [admin] = await hre.ethers.getSigners();

  // Set these values as needed
  const marketAddress = process.env.MARKET_ADDRESS || "<MARKET_ADDRESS_HERE>";
  const outcome = process.env.MARKET_OUTCOME || "<OUTCOME_PRICE_HERE>"; // e.g., 67500 for $67,500

  if (!marketAddress || !outcome) {
    throw new Error("Please set MARKET_ADDRESS and MARKET_OUTCOME env variables or edit the script.");
  }

  const market = await hre.ethers.getContractAt("PredictionMarket", marketAddress);
  const tx = await market.resolveMarket(outcome);
  await tx.wait();
  console.log(`Market at ${marketAddress} resolved with outcome: ${outcome}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 