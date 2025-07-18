import hre from "hardhat";
import { EvmChain } from "hyperbridge-sdk";
import { MaxUint256, Contract } from "ethers";

// --- CONFIGURATION ---
const FACTORY_ADDRESS = "0xf3018cbEB09bFbB6C6A674201801364e9A4f57B3"; // V2 factory
const SEPOLIA_CHAINLINK_BTCUSD = "0xA39434A63A52E749F02807ae27335515BA4b07F7";
const REQUEST_TIMEOUT = 20; // 20 seconds
const REQUEST_FEE = 0; // 0 for testnet

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const factory = await hre.ethers.getContractAt("PredictionMarketFactoryV2", FACTORY_ADDRESS, signer);

  console.log(`[INFO] V2 Watcher started. Listening for MarketCreatedV2 events on factory: ${FACTORY_ADDRESS}`);

  factory.on("MarketCreatedV2", async (marketAddress, prompt, asset, closeTime) => {
    try {
      const closeTimeNum = closeTime.toNumber ? closeTime.toNumber() : Number(closeTime);
      const closeDate = new Date(closeTimeNum * 1000).toISOString();
      console.log(`\n[EVENT] New V2 market created at: ${marketAddress}\n        Prompt: ${prompt}\n        Asset: ${asset}\n        CloseTime: ${closeTimeNum} (${closeDate})`);
      await processMarketLifecycle(marketAddress, closeTimeNum);
    } catch (err) {
      console.error(`[ERROR] Failed to process new V2 market:`, err);
    }
  });

  process.stdin.resume();
}

async function processMarketLifecycle(marketAddress, closeTimeNum) {
  try {
    await waitForMarketCloseTime(marketAddress, closeTimeNum);
    await closeMarket(marketAddress);
    await requestPrice(marketAddress);
  } catch (err) {
    console.error(`[ERROR] V2 Market lifecycle failed for ${marketAddress}:`, err);
  }
}

async function waitForMarketCloseTime(marketAddress, closeTimeNum) {
  const now = Math.floor(Date.now() / 1000);
  if (now < closeTimeNum) {
    const waitMs = (closeTimeNum - now) * 1000;
    console.log(`[INFO] Waiting for V2 market ${marketAddress} to reach closeTime (${closeTimeNum}). Sleeping for ${Math.round(waitMs / 1000)} seconds...`);
    await sleep(waitMs);
  } else {
    console.log(`[INFO] V2 market ${marketAddress} already past closeTime (${closeTimeNum}). Proceeding...`);
  }
}

async function closeMarket(marketAddress) {
  const [signer] = await hre.ethers.getSigners();
  const market = await hre.ethers.getContractAt("PredictionMarketV2", marketAddress, signer);
  try {
    console.log(`[INFO] Attempting to close V2 market: ${marketAddress}`);
    const tx = await market.closeMarket();
    await tx.wait();
    console.log(`[SUCCESS] closeMarket() called for V2 market ${marketAddress}`);
    await sleep(5000);
  } catch (err) {
    if (err.message && err.message.includes("Already closed")) {
      console.log(`[INFO] V2 market ${marketAddress} already closed.`);
    } else {
      throw err;
    }
  }
}

async function requestPrice(marketAddress) {
  const [signer] = await hre.ethers.getSigners();
  const market = await hre.ethers.getContractAt("PredictionMarketV2", marketAddress, signer);
  const state = await market.state();
  const owner = await market.owner();
  const priceRequested = await market.priceRequested();
  const dispatcher = await market.dispatcher();
  const destination = await market.destination();
  console.log(`[DEBUG] V2 Market state before requestPriceGet: ${state} (0=Open, 1=Closed, 2=Resolved)`);
  console.log(`[DEBUG] V2 Market owner: ${owner}`);
  console.log(`[DEBUG] Signer: ${signer.address}`);
  console.log(`[DEBUG] priceRequested: ${priceRequested}`);
  console.log(`[DEBUG] dispatcher: ${dispatcher}`);
  console.log(`[DEBUG] destination: ${destination}`);
  console.log(`[DEBUG] requestPriceGet args: feed=${SEPOLIA_CHAINLINK_BTCUSD}, timeout=${REQUEST_TIMEOUT}, fee=${REQUEST_FEE}`);
  try {
    // Skipping fee token approval for demo (dispatcher is placeholder)
    console.log(`[INFO] Calling requestPriceGet on V2 market: ${marketAddress}`);
    const tx = await market.requestPriceGet(SEPOLIA_CHAINLINK_BTCUSD, REQUEST_TIMEOUT, REQUEST_FEE);
    await tx.wait();
    console.log(`[SUCCESS] requestPriceGet called on V2 market: ${marketAddress}`);
  } catch (err) {
    if (err.message && err.message.includes("Price already requested")) {
      console.log(`[INFO] Price already requested for V2 market ${marketAddress}.`);
    } else {
      console.error(`[ERROR] Failed to call requestPriceGet on V2 market ${marketAddress}:`, err);
    }
  }
}

await main(); 