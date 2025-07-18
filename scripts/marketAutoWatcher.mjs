import hre from "hardhat";
import { EvmChain } from "hyperbridge-sdk";
import { MaxUint256, Contract } from "ethers"; // Add this import for ethers v6

// --- CONFIGURATION ---
const FACTORY_ADDRESS = "0x25F1471e8F729a3e8424B883b9D68b2f019D6167"; // BSC testnet factory
const SEPOLIA_CHAINLINK_BTCUSD = "0xA39434A63A52E749F02807ae27335515BA4b07F7";
const REQUEST_TIMEOUT = 20; // 20 seconds
const REQUEST_FEE = 0; // 0 for testnet

// --- Utility: async sleep ---
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// --- Main watcher: Listen for new markets and process lifecycle ---
async function main() {
  const [signer] = await hre.ethers.getSigners();
  const factory = await hre.ethers.getContractAt("PredictionMarketFactory", FACTORY_ADDRESS, signer);

  console.log(`[INFO] Watcher started. Listening for MarketCreated events on factory: ${FACTORY_ADDRESS}`);

  factory.on("MarketCreated", async (marketAddress, prompt, asset, closeTime) => {
    try {
      const closeTimeNum = closeTime.toNumber ? closeTime.toNumber() : Number(closeTime);
      const closeDate = new Date(closeTimeNum * 1000).toISOString();
      console.log(`\n[EVENT] New market created at: ${marketAddress}\n        Prompt: ${prompt}\n        Asset: ${asset}\n        CloseTime: ${closeTimeNum} (${closeDate})`);
      await processMarketLifecycle(marketAddress, closeTimeNum);
    } catch (err) {
      console.error(`[ERROR] Failed to process new market:`, err);
    }
  });

  // Keep the process alive
  process.stdin.resume();
}

// --- Process the full lifecycle for a single market ---
async function processMarketLifecycle(marketAddress, closeTimeNum) {
  try {
    await waitForMarketCloseTime(marketAddress, closeTimeNum);
    await closeMarket(marketAddress);
    await requestPrice(marketAddress);
    // Optionally, you can add a polling loop here to check for resolution
  } catch (err) {
    console.error(`[ERROR] Market lifecycle failed for ${marketAddress}:`, err);
  }
}

// --- Wait until the market's close time ---
async function waitForMarketCloseTime(marketAddress, closeTimeNum) {
  const now = Math.floor(Date.now() / 1000);
  if (now < closeTimeNum) {
    const waitMs = (closeTimeNum - now) * 1000;
    console.log(`[INFO] Waiting for market ${marketAddress} to reach closeTime (${closeTimeNum}). Sleeping for ${Math.round(waitMs / 1000)} seconds...`);
    await sleep(waitMs);
  } else {
    console.log(`[INFO] Market ${marketAddress} already past closeTime (${closeTimeNum}). Proceeding...`);
  }
}

// --- Close the market ---
async function closeMarket(marketAddress) {
  const [signer] = await hre.ethers.getSigners();
  const market = await hre.ethers.getContractAt("PredictionMarket", marketAddress, signer);
  try {
    console.log(`[INFO] Attempting to close market: ${marketAddress}`);
    const tx = await market.closeMarket();
    await tx.wait();
    console.log(`[SUCCESS] closeMarket() called for ${marketAddress}`);
    // Wait a few seconds to ensure state is updated
    await sleep(5000);
  } catch (err) {
    if (err.message && err.message.includes("Already closed")) {
      console.log(`[INFO] Market ${marketAddress} already closed.`);
    } else {
      throw err;
    }
  }
}

// --- Request price from Hyperbridge ---
async function requestPrice(marketAddress) {
  const [signer] = await hre.ethers.getSigners();
  const market = await hre.ethers.getContractAt("PredictionMarket", marketAddress, signer);

  // Always log these before attempting the transaction
  const state = await market.state();
  const owner = await market.owner();
  const priceRequested = await market.priceRequested();
  const dispatcher = await market.dispatcher();
  const destination = await market.destination();
  console.log(`[DEBUG] Market state before requestPriceGet: ${state} (0=Open, 1=Closed, 2=Resolved)`);
  console.log(`[DEBUG] Market owner: ${owner}`);
  console.log(`[DEBUG] Signer: ${signer.address}`);
  console.log(`[DEBUG] priceRequested: ${priceRequested}`);
  console.log(`[DEBUG] dispatcher: ${dispatcher}`);
  console.log(`[DEBUG] destination: ${destination}`);
  console.log(`[DEBUG] requestPriceGet args: feed=${SEPOLIA_CHAINLINK_BTCUSD}, timeout=${REQUEST_TIMEOUT}, fee=${REQUEST_FEE}`);

  // --- Auto-approve fee token if needed ---
  try {
    // Get the fee token address from the dispatcher contract
    const dispatcherAbi = ["function feeToken() view returns (address)"];
    const dispatcherContract = new Contract(dispatcher, dispatcherAbi, signer);
    const feeTokenAddress = await dispatcherContract.feeToken();
    console.log(`[DEBUG] Fee token address: ${feeTokenAddress}`);

    // Prepare ERC20 ABI for allowance/approve
    const erc20Abi = [
      "function allowance(address owner, address spender) view returns (uint256)",
      "function approve(address spender, uint256 amount) returns (bool)"
    ];
    const feeToken = new Contract(feeTokenAddress, erc20Abi, signer);
    const allowance = await feeToken.allowance(signer.address, marketAddress);
    console.log(`[DEBUG] Fee token allowance for market: ${allowance}`);

    if (allowance < REQUEST_FEE) {
      console.log(`[INFO] Approving fee token for market: ${marketAddress}`);
      const tx = await feeToken.approve(marketAddress, MaxUint256);
      await tx.wait();
      console.log(`[SUCCESS] Approved fee token for market: ${marketAddress}`);
    } else {
      console.log(`[INFO] Sufficient allowance already set for market: ${marketAddress}`);
    }
  } catch (approveErr) {
    console.error(`[ERROR] Fee token approval failed:`, approveErr);
    throw approveErr;
  }

  // Now call requestPriceGet
  try {
    console.log(`[INFO] Calling requestPriceGet on market: ${marketAddress}`);
    const tx = await market.requestPriceGet(SEPOLIA_CHAINLINK_BTCUSD, REQUEST_TIMEOUT, REQUEST_FEE);
    await tx.wait();
    console.log(`[SUCCESS] requestPriceGet called on market: ${marketAddress}`);
  } catch (err) {
    if (err.message && err.message.includes("Price already requested")) {
      console.log(`[INFO] Price already requested for market ${marketAddress}.`);
    } else {
      console.error(`[ERROR] Failed to call requestPriceGet on market ${marketAddress}:`, err);
    }
  }
}

await main(); 