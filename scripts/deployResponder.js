const hre = require("hardhat");

async function main() {
  // Chainlink BTC/USD feed address on Sepolia
  const BTC_USD_FEED = "0xA39434A63A52E749F02807ae27335515BA4b07F7";

  const PriceFeedResponder = await hre.ethers.getContractFactory("PriceFeedResponder");
  const responder = await PriceFeedResponder.deploy(BTC_USD_FEED);
  await responder.waitForDeployment();

  console.log("PriceFeedResponder deployed to:", await responder.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 