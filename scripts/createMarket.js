const hre = require("hardhat");
const { AbiCoder } = require("ethers");

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  // --- HARDCODED CONFIGURATION ---
  const factoryAddress = "0x25F1471e8F729a3e8424B883b9D68b2f019D6167"; // Deployed factory on BSC testnet
  const closeTime = Math.floor(Date.now() / 1000) + 1.5 * 60; // 6 seconds from now for quick test
  const closeDateObj = new Date(closeTime * 1000);
  const day = String(closeDateObj.getUTCDate()).padStart(2, '0');
  const month = String(closeDateObj.getUTCMonth() + 1).padStart(2, '0');
  const year = closeDateObj.getUTCFullYear();
  const hour = String(closeDateObj.getUTCHours()).padStart(2, '0');
  const minute = String(closeDateObj.getUTCMinutes()).padStart(2, '0');
  const prompt = `BTC/USD prediction on ${day}/${month}/${year} at ${hour}:${minute}`;
  const asset = "BTC/USD";

  // --- Fetch dispatcher (host) address from Ping module ---
  const PING_MODULE_ADDRESS = "0xFE9f23F0F2fE83b8B9576d3FC94e9a7458DdDD35"; // BSC testnet
  const pingModule = await hre.ethers.getContractAt([
    "function host() view returns (address)"
  ], PING_MODULE_ADDRESS);
  const dispatcher = await pingModule.host();

  // --- Encode destination for Sepolia (EVM, chainId 11155111) using StateMachine format ---
  // StateMachine.evm(11155111) for Sepolia
  const abiCoder = AbiCoder.defaultAbiCoder();
  // Format: StateMachine.evm(chainId) - this creates the proper destination encoding
  const destination = abiCoder.encode(["uint8", "uint32"], [1, 11155111]); // 1 = EVM, 11155111 = Sepolia chainId

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