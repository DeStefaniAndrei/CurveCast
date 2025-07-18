const hre = require("hardhat");

async function main() {
  // Chainlink BTC/USD feed address on Sepolia
  const BTC_USD_FEED = "0xA39434A63A52E749F02807ae27335515BA4b07F7";

  const PriceFeedResponder = await hre.ethers.getContractFactory("PriceFeedResponder");
  const responder = await PriceFeedResponder.deploy(BTC_USD_FEED);
  await responder.waitForDeployment();

  const responderAddress = await responder.getAddress();
  console.log("PriceFeedResponder deployed to:", responderAddress);
  console.log(`[INFO] Use this address as the responder in your Hyperbridge destination encoding!`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 