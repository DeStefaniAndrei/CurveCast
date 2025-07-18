const hre = require("hardhat");

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const factoryAddress = "0x25F1471e8F729a3e8424B883b9D68b2f019D6167"; // PredictionMarketFactory on BSC testnet

  // ABI fragment for getMarkets()
  const factoryAbi = [
    "function getMarkets() view returns (address[] memory)"
  ];
  const factory = await hre.ethers.getContractAt(factoryAbi, factoryAddress, signer);
  const markets = await factory.getMarkets();
  if (!markets || markets.length === 0) {
    throw new Error("No markets found in factory.");
  }
  const marketAddress = markets[markets.length - 1]; // latest market
  console.log(`Latest market address: ${marketAddress}`);

  // ABI fragment for outcome and state
  const marketAbi = [
    "function outcome() view returns (uint256)",
    "function state() view returns (uint8)"
  ];
  const market = await hre.ethers.getContractAt(marketAbi, marketAddress, signer);
  const outcome = await market.outcome();
  const state = await market.state();

  const stateStr = ["Open", "Closed", "Resolved"][state] || state;
  console.log(`Market state: ${stateStr}`);
  console.log(`Resolved outcome (price): ${outcome.toString()}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 