const hre = require("hardhat");
const { decodeChainlinkRlpValue } = require("../lib/rlpDecode");
const { Client, StateMachine, encodeGetKey } = require("hyperbridge-sdk");

// --- HARDCODED CONFIGURATION ---
const CHAINLINK_FEED = "0x143db3CEEfbdfe5631aDD3E50f7614B6ba708BA7"; // BNB/USD on BSC testnet
const TIMEOUT = 3600; // 1 hour
const FEE = 0; // Set relayer fee as needed
const BSC_RPC = "https://data-seed-prebsc-1-s1.binance.org:8545/";

// Get market address from command-line argument
const MARKET_ADDRESS = process.argv[2];
if (!MARKET_ADDRESS) {
  console.error("[FATAL] Please provide the market address as the first argument.\nUsage: npx hardhat run scripts/resolveMarketAtEndTime.js --network <network> <market_address>");
  process.exit(1);
}

async function main() {
  console.log(`[INFO] Starting resolveMarketAtEndTime script for market: ${MARKET_ADDRESS}`);
  const [signer] = await hre.ethers.getSigners();
  const market = await hre.ethers.getContractAt("PredictionMarket", MARKET_ADDRESS, signer);

  // 1. Wait until closeTime is reached
  let closeTime;
  try {
    closeTime = await market.closeTime();
    closeTime = closeTime.toNumber ? closeTime.toNumber() : Number(closeTime);
    const now = Math.floor(Date.now() / 1000);
    if (now < closeTime) {
      const waitMs = (closeTime - now) * 1000;
      console.log(`[INFO] Waiting for market to close in ${Math.round(waitMs / 1000)} seconds (closeTime: ${closeTime}, now: ${now})...`);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    } else {
      console.log(`[INFO] Market already closed (closeTime: ${closeTime}, now: ${now}). Proceeding...`);
    }
  } catch (err) {
    console.error("[ERROR] Failed to fetch closeTime from contract:", err);
    process.exit(1);
  }

  // 2. Construct the GET request key (20 bytes feed + 32 bytes slot)
  let key, keys, dest, height, context;
  try {
    key = encodeGetKey(CHAINLINK_FEED, 0); // slot 0 for latest answer
    keys = [key];
    dest = StateMachine.evm(97); // BSC testnet chain ID
    height = 0; // latest block
    context = Buffer.from("");
    console.log("[INFO] Constructed GET request key for Chainlink feed.");
  } catch (err) {
    console.error("[ERROR] Failed to construct GET request key:", err);
    process.exit(1);
  }

  // 3. Use Hyperbridge SDK to dispatch the GET request
  let client, commitment;
  try {
    client = new Client({ rpc: BSC_RPC });
    const getRequest = {
      dest,
      height,
      keys,
      timeout: TIMEOUT,
      fee: FEE,
      context
    };
    commitment = await client.dispatchGet(getRequest, signer);
    console.log("[INFO] GET request dispatched. Commitment:", commitment);
  } catch (err) {
    console.error("[ERROR] Failed to dispatch GET request via Hyperbridge:", err);
    process.exit(1);
  }

  // 4. Poll for the GET response using the SDK
  let response = null;
  let pollAttempts = 0;
  while (!response) {
    try {
      await new Promise((resolve) => setTimeout(resolve, 10000)); // poll every 10s
      response = await client.getGetResponse(commitment);
      pollAttempts++;
      if (response && response.values && response.values.length > 0) {
        console.log(`[INFO] GET response received after ${pollAttempts} attempts.`);
        break;
      }
      console.log(`[INFO] Waiting for GET response... (attempt ${pollAttempts})`);
    } catch (err) {
      console.error(`[ERROR] Polling GET response failed (attempt ${pollAttempts}):`, err);
      if (pollAttempts >= 3) {
        console.error("[ERROR] Max polling attempts reached. Exiting.");
        process.exit(1);
      }
    }
  }

  // 5. Decode the value using the RLP utility
  try {
    const rlpValue = response.values[0].value;
    const price = decodeChainlinkRlpValue(rlpValue);
    console.log(`[SUCCESS] Market resolved! Outcome (price): ${price.toString()}`);
    // 6. (Optional) Call the contract's resolve function if needed
    // await market.resolveMarket(price);
  } catch (err) {
    console.error("[ERROR] Failed to decode Chainlink RLP value or resolve market:", err);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("[FATAL] Uncaught error:", error);
  process.exitCode = 1;
}); 