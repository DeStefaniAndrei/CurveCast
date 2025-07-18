const hre = require("hardhat");
const { AbiCoder } = require("ethers");

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  // --- HARDCODED CONFIGURATION ---
  const factoryAddress = "0x9C7CC6FFfb6ECaf9D0029B110f0Ee69f3f36E011"; // Correct factory address
  const closeTime = Math.floor(Date.now() / 1000) + 48 * 60 * 60; // 48 hours from now
  const closeDateObj = new Date(closeTime * 1000);
  const day = String(closeDateObj.getUTCDate()).padStart(2, '0');
  const month = String(closeDateObj.getUTCMonth() + 1).padStart(2, '0');
  const year = closeDateObj.getUTCFullYear();
  const hour = String(closeDateObj.getUTCHours()).padStart(2, '0');
  const minute = String(closeDateObj.getUTCMinutes()).padStart(2, '0');
  const prompt = `BTC/USD prediction on ${day}/${month}/${year} at ${hour}:${minute}`;
  const asset = "BTC/USD";

  // --- Dispatcher address (hardcoded) ---
  const dispatcher = "0xFE9f23F0F2fE83b8B9576d3FC94e9a7458DdDD35"; // BSC testnet

  // --- Encode destination for Sepolia (EVM, chainId 11155111) using StateMachine format ---
  const responderAddress = "0x3072586fE27A2bE611513A8cCB4378978f9eADAD";
  const stateMachine = hre.ethers.utils.solidityPack(["uint8", "uint32"], [1, 11155111]); // 4 bytes
  const destination = stateMachine + responderAddress.slice(2); // 4 bytes + 20 bytes = 24 bytes

  console.log(`[INFO] Using factory at: ${factoryAddress}`);
  console.log(`[INFO] Dispatcher (host) address: ${dispatcher}`);
  console.log(`[INFO] Destination bytes: ${destination}`);
  const factory = await hre.ethers.getContractAt("PredictionMarketFactory", factoryAddress);
  console.log(`[INFO] Creating market: prompt='${prompt}', asset='${asset}', closeTime=${closeTime}`);
  const initialMean = 50000; // $50k initial BTC price
  const initialStddev = 1000000; // 1M uncertainty
  const tx = await factory.createMarket(prompt, asset, closeTime, dispatcher, destination, initialMean, initialStddev);
  const receipt = await tx.wait();

  // Parse MarketCreated event from logs using ethers v6
  try {
    const iface = factory.interface;
    let marketAddress = null;
    for (const log of receipt.logs) {
      // Only parse logs from the factory address
      if (log.address.toLowerCase() !== factoryAddress.toLowerCase()) continue;
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
      console.log(`[INFO] Market close time: ${closeTime} (${prompt})`);
    } else {
      console.log("[WARN] Market created, but address not found in logs.\n[DEBUG] Receipt logs:", receipt.logs.map(l => ({address: l.address, topics: l.topics})));
    }
  } catch (err) {
    console.error("[ERROR] Failed to parse MarketCreated event:", err);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 