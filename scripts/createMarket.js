const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  // --- HARDCODED CONFIGURATION ---
  const factoryAddress = "0x25F1471e8F729a3e8424B883b9D68b2f019D6167"; // Deployed factory on BSC testnet
  const prompt = "BTC/USD prediction test (auto, 3min)";
  const asset = "BTC/USD";
  const closeTime = Math.floor(Date.now() / 1000) + 60; // 3 minutes from now
  const dispatcher = "0x0000000000000000000000000000000000000000"; // Not used for BSC testnet
  const destination = "0x"; // Not used for BSC testnet

  console.log(`[INFO] Using factory at: ${factoryAddress}`);
  const factory = await hre.ethers.getContractAt("PredictionMarketFactory", factoryAddress);
  console.log(`[INFO] Creating market: prompt='${prompt}', asset='${asset}', closeTime=${closeTime}`);
  const tx = await factory.createMarket(prompt, asset, closeTime, dispatcher, destination);
  const receipt = await tx.wait();

  // Parse MarketCreated event from logs using ethers v6
  try {
    const iface = factory.interface;
    let marketAddress = null;
    for (const log of receipt.logs) {
      try {
        const parsed = iface.parseLog(log);
        if (parsed && parsed.name === "MarketCreated") {
          marketAddress = parsed.args.market;
          break;
        }
      } catch (e) {
        // Not a MarketCreated event, skip
      }
    }
    if (marketAddress) {
      console.log(`[SUCCESS] Market created at: ${marketAddress}`);
    } else {
      console.log("[WARN] Market created, but address not found in logs.");
    }
  } catch (err) {
    console.error("[ERROR] Failed to parse MarketCreated event:", err);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 