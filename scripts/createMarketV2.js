// scripts/createMarketV2.js
const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const FACTORY_V2_ADDRESS = "0xf3018cbEB09bFbB6C6A674201801364e9A4f57B3";
  const factory = await hre.ethers.getContractAt("PredictionMarketFactoryV2", FACTORY_V2_ADDRESS);

  // Demo market parameters
  const prompt = "BTC/USD prediction for demo (V2)";
  const asset = "BTC/USD";
  const closeTime = Math.floor(Date.now() / 1000) + 600; // 10 minutes from now
  const dispatcher = "0x1111111111111111111111111111111111111111"; // non-zero placeholder
  const destination = "0x"; // placeholder
  const initialMean = 50000;
  const initialStddev = 5000;

  const tx = await factory.createMarket(
    prompt,
    asset,
    closeTime,
    dispatcher,
    destination,
    initialMean,
    initialStddev
  );
  const receipt = await tx.wait();
  const event = receipt.events.find(e => e.event === "MarketCreatedV2");
  const marketAddress = event.args.market;
  console.log("Demo V2 market created at:", marketAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 