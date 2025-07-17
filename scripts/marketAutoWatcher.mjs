import hre from "hardhat";
import { EvmChain } from "hyperbridge-sdk";

// --- HARDCODED CONFIGURATION ---
const FACTORY_ADDRESS = "0x25F1471e8F729a3e8424B883b9D68b2f019D6167"; // Factory on BSC testnet
const BSC_RPC = "https://data-seed-prebsc-1-s1.binance.org:8545/";
const SEPOLIA_CHAIN_ID = 11155111;
const SEPOLIA_CHAINLINK_BTCUSD = "0xA39434A63A52E749F02807ae27335515BA4b07F7";
const BSC_CHAIN_ID = 97;

// --- Utility: async sleep ---
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// --- Step 1: Listen for MarketCreated events from the factory ---
async function main() {
  const [signer] = await hre.ethers.getSigners();
  const factory = await hre.ethers.getContractAt("PredictionMarketFactory", FACTORY_ADDRESS, signer);

  console.log(`[INFO] Watcher started. Listening for MarketCreated events on factory: ${FACTORY_ADDRESS}`);

  factory.on("MarketCreated", async (marketAddress, prompt, asset, closeTime, event) => {
    const closeTimeNum = closeTime.toNumber ? closeTime.toNumber() : Number(closeTime);
    const closeDate = new Date(closeTimeNum * 1000).toISOString();
    console.log(`[EVENT] New market created at: ${marketAddress}\n        Prompt: ${prompt}\n        Asset: ${asset}\n        CloseTime: ${closeTimeNum} (${closeDate})`);
    // Step 2: For each new market, fetch closeTime from contract and wait
    await handleMarketLifecycle(marketAddress);
  });

  // Keep the process alive
  process.stdin.resume();
}

// --- Step 2: For each new market, fetch closeTime and wait until it passes ---
async function handleMarketLifecycle(marketAddress) {
  const [signer] = await hre.ethers.getSigners();
  const market = await hre.ethers.getContractAt("PredictionMarket", marketAddress, signer);
  try {
    const closeTime = await market.closeTime();
    const closeTimeNum = closeTime.toNumber ? closeTime.toNumber() : Number(closeTime);
    const now = Math.floor(Date.now() / 1000);
    const closeDate = new Date(closeTimeNum * 1000).toISOString();
    if (now < closeTimeNum) {
      const waitMs = (closeTimeNum - now) * 1000;
      console.log(`[INFO] Waiting for market ${marketAddress} to reach closeTime (${closeTimeNum} = ${closeDate}). Sleeping for ${Math.round(waitMs / 1000)} seconds...`);
      await sleep(waitMs);
    } else {
      console.log(`[INFO] Market ${marketAddress} already past closeTime (${closeTimeNum} = ${closeDate}). Proceeding...`);
    }
    // After waiting, attempt to close the market (if function exists)
    await tryCloseMarket(marketAddress);
    // Listen for MarketClosed event
    await listenForMarketClosed(marketAddress);
  } catch (err) {
    console.error(`[ERROR] Failed to fetch closeTime or wait for market ${marketAddress}:`, err);
  }
}

// --- Step 3: Try to close the market by calling closeMarket() if it exists ---
async function tryCloseMarket(marketAddress) {
  const [signer] = await hre.ethers.getSigners();
  const market = await hre.ethers.getContractAt("PredictionMarket", marketAddress, signer);
  if (typeof market.closeMarket === "function") {
    try {
      console.log(`[INFO] Attempting to close market ${marketAddress} by calling closeMarket()`);
      const tx = await market.closeMarket();
      await tx.wait();
      console.log(`[SUCCESS] closeMarket() called for ${marketAddress}`);
    } catch (err) {
      console.error(`[ERROR] Failed to call closeMarket() for ${marketAddress}:`, err);
    }
  } else {
    console.warn(`[WARN] No closeMarket() function found on contract ${marketAddress}. Skipping automatic closing.`);
  }
}

// --- Step 4: Listen for MarketClosed event on the market contract ---
async function listenForMarketClosed(marketAddress) {
  const [signer] = await hre.ethers.getSigners();
  const market = await hre.ethers.getContractAt("PredictionMarket", marketAddress, signer);
  console.log(`[INFO] Listening for MarketClosed event on market: ${marketAddress}`);

  // Use a promise to await the event in async/await style
  await new Promise((resolve) => {
    market.once("MarketClosed", async () => {
      console.log(`[EVENT] MarketClosed detected for market: ${marketAddress}`);
      // Step 5: On MarketClosed, trigger cross-chain GET request
      await handleMarketClosed(marketAddress);
      resolve();
    });
  });
}

// --- Step 5: On MarketClosed, trigger cross-chain GET request for BTC/USD from Sepolia ---
async function handleMarketClosed(marketAddress) {
  try {
    const sepolia = new EvmChain({
      url: "https://sepolia.infura.io/v3/fbb4fa2b1b734058b1ef4b6a3bb2a602",
      chainId: SEPOLIA_CHAIN_ID,
      host: SEPOLIA_CHAINLINK_BTCUSD,
    });
    console.log(`[INFO] Fetching BTC/USD price from Chainlink on Sepolia...`);
    const priceFeedAbi = [
      "function latestRoundData() view returns (uint80, int256, uint256, uint256, uint80)"
    ];
    const priceFeed = await sepolia.getContract(SEPOLIA_CHAINLINK_BTCUSD, priceFeedAbi);
    const roundData = await priceFeed.latestRoundData();
    const price = roundData[1]; // int256 price
    console.log(`[SUCCESS] Fetched BTC/USD price from Sepolia: ${price.toString()}`);
    // Step 6: Call resolveMarket(price) on the market contract
    await resolveMarketOnBSC(marketAddress, price);
  } catch (err) {
    console.error(`[ERROR] Failed to fetch BTC/USD price or resolve market for ${marketAddress}:`, err);
  }
}

// --- Step 6: Call resolveMarket(price) on the market contract on BSC ---
async function resolveMarketOnBSC(marketAddress, price) {
  try {
    const [signer] = await hre.ethers.getSigners();
    const market = await hre.ethers.getContractAt("PredictionMarket", marketAddress, signer);
    const tx = await market.resolveMarket(price);
    await tx.wait();
    console.log(`[SUCCESS] Market at ${marketAddress} resolved with price: ${price.toString()}`);
  } catch (err) {
    console.error(`[ERROR] Failed to resolve market at ${marketAddress}:`, err);
  }
}

await main(); 