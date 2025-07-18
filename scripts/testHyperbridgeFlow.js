const hre = require("hardhat");

async function main() {
  const [signer] = await hre.ethers.getSigners();
  
  console.log(`[INFO] Testing Hyperbridge integration flow`);
  console.log(`[INFO] Signer: ${signer.address}`);
  
  // Step 1: Use existing factory
  let factoryAddress = "0x9C7CC6FFfb6ECaf9D0029B110f0Ee69f3f36E011"; // updated factory address
  const factory = await hre.ethers.getContractAt("PredictionMarketFactory", factoryAddress);
  console.log(`[INFO] Using factory at: ${factoryAddress}`);
  
  // Step 2: Create a market
  console.log(`\n[STEP 2] Creating market...`);
  const closeTime = Math.floor(Date.now() / 1000) + 60; // 1 minute from now
  const prompt = "BTC/USD price test";
  const asset = "BTC/USD";
  
  // Get dispatcher address
  const PING_MODULE_ADDRESS = "0xFE9f23F0F2fE83b8B9576d3FC94e9a7458DdDD35"; // BSC testnet
  const pingModule = await hre.ethers.getContractAt([
    "function host() view returns (address)"
  ], PING_MODULE_ADDRESS);
  const dispatcher = await pingModule.host();
  
  // Encode destination for Sepolia
  const abiCoder = hre.ethers.AbiCoder.defaultAbiCoder();
  const destination = abiCoder.encode(["uint8", "uint32"], [1, 11155111]); // EVM + Sepolia chainId
  
  const initialMean = 50000; // $50k initial BTC price
  const initialStddev = 1000000; // 1M uncertainty
  
  const createTx = await factory.createMarket(
    prompt, 
    asset, 
    closeTime, 
    dispatcher, 
    destination, 
    initialMean, 
    initialStddev
  );
  const createReceipt = await createTx.wait();
  
  // Parse market address from event
  let marketAddress = null;
  for (const log of createReceipt.logs) {
    if (log.address.toLowerCase() === factoryAddress.toLowerCase()) {
      try {
        const iface = factory.interface;
        const parsed = iface.parseLog(log);
        if (parsed && parsed.name === "MarketCreated") {
          marketAddress = parsed.args.market;
          break;
        }
      } catch (e) {
        // Not the event we're looking for
      }
    }
  }
  
  if (!marketAddress) {
    console.log(`[ERROR] Could not find market address in logs`);
    return;
  }
  
  console.log(`[SUCCESS] Market created at: ${marketAddress}`);
  
  // Step 3: Submit a prediction
  console.log(`\n[STEP 3] Submitting prediction...`);
  const market = await hre.ethers.getContractAt("PredictionMarket", marketAddress, signer);
  
  const predictionMean = 52000; // $52k prediction
  const predictionStddev = 1500000; // 1.5M uncertainty
  const stake = hre.ethers.parseEther("0.01"); // 0.01 ETH stake
  
  const predictTx = await market.submitPrediction(predictionMean, predictionStddev, { value: stake });
  await predictTx.wait();
  console.log(`[SUCCESS] Prediction submitted`);
  
  // Step 4: Wait for market to close
  console.log(`\n[STEP 4] Waiting for market to close...`);
  const marketCloseTime = Number(await market.closeTime());
  const currentTime = Math.floor(Date.now() / 1000);
  
  if (currentTime < marketCloseTime) {
    console.log(`[INFO] Market closes at ${marketCloseTime}, current time: ${currentTime}`);
    const waitSeconds = marketCloseTime - currentTime;
    console.log(`[INFO] Waiting ${waitSeconds} seconds...`);
    await new Promise(resolve => setTimeout(resolve, waitSeconds * 1000));
  }
  
  // Step 5: Automated close and price request
  console.log(`\n[STEP 5] Auto-closing market and requesting price from Hyperbridge...`);
  const chainlinkFeed = "0xA39434A63A52E749F02807ae27335515BA4b07F7"; // BTC/USD on Sepolia
  const timeout = 3600; // 1 hour
  const fee = hre.ethers.parseEther("0.1"); // 0.1 DAI fee
  
  const autoTx = await market.autoCloseAndRequest(chainlinkFeed, timeout, fee);
  await autoTx.wait();
  console.log(`[SUCCESS] Market closed and price requested`);

  // Step 6: Wait for Hyperbridge response (no simulation)
  console.log(`\n[STEP 6] Waiting for Hyperbridge response and market resolution...`);
  // Standard async/await polling function
  async function pollForResolution(market, maxTries = 60, intervalMs = 10000) {
    function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
    for (let i = 0; i < maxTries; i++) {
      const state = await market.state();
      if (state === 2) {
        return await market.outcome();
      }
      await sleep(intervalMs);
    }
    return null;
  }

  const outcome = await pollForResolution(market);
  if (outcome !== null) {
    console.log(`[SUCCESS] Market resolved! Outcome: ${outcome}`);
  } else {
    console.log(`[WARN] Market not resolved after waiting. Check Hyperbridge relayer and response.`);
  }

  // Step 7: Check final state
  console.log(`\n[STEP 7] Checking final state...`);
  const marketMean = await market.marketMean();
  const marketStddev = await market.marketStddev();
  
  console.log(`[INFO] Final market mean: ${marketMean}`);
  console.log(`[INFO] Final market stddev: ${marketStddev}`);
  
  console.log(`\n[SUCCESS] Hyperbridge integration test completed!`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});