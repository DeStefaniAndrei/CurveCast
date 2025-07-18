const hre = require("hardhat");

async function main() {
  const factoryAddress = "0x45424B86d496EFA5163DA80Afe17570e377cb526"; // updated factory address
  const prompt = "BTC/USD price test";
  const asset = "BTC/USD";
  const closeTime = Math.floor(Date.now() / 1000) + 60;
  const PING_MODULE_ADDRESS = "0xFE9f23F0F2fE83b8B9576d3FC94e9a7458DdDD35";
  const pingModule = await hre.ethers.getContractAt([
    "function host() view returns (address)"
  ], PING_MODULE_ADDRESS);
  const dispatcher = await pingModule.host();
  const abiCoder = hre.ethers.AbiCoder.defaultAbiCoder();
  const destination = abiCoder.encode(["uint8", "uint32"], [1, 11155111]);
  const initialMean = 50000;
  const initialStddev = 1000000;

  const factory = await hre.ethers.getContractAt("PredictionMarketFactory", factoryAddress);

  try {
    await factory.callStatic.createMarket(
      prompt,
      asset,
      closeTime,
      dispatcher,
      destination,
      initialMean,
      initialStddev
    );
    console.log("callStatic succeeded: createMarket would succeed with these arguments.");
  } catch (e) {
    console.error("callStatic reverted:", e);
    if (e && e.error && e.error.message) {
      console.error("Revert reason:", e.error.message);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 