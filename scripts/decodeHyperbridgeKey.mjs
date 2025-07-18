// Usage: node scripts/decodeHyperbridgeKey.mjs
// Paste your request object below to compute the commitment

import { createQueryClient, IndexerClient, getRequestCommitment } from "hyperbridge-sdk";
import { ethers } from "ethers";

// --- CONFIG ---
// Paste your request object here (as sent to the dispatcher)
const requestObject = {
  dest: "0x45564d2d3131313535313131",
  keys: [
    "0xA39434A63A52E749F02807ae27335515BA4B07F70000000000000000000000000000000000000000000000000000000000000000"
  ],
  height: 0,
  nonce: 8814,
  timeoutTimestamp: 1752834917,
  context: "0x",
  fee: "100000000000000000"
};
const INDEXER_URL = "https://gargantua.indexer.polytope.technology"; // Hyperbridge indexer API

async function main() {
  let commitment = null;
  if (requestObject) {
    commitment = getRequestCommitment(requestObject);
    console.log("[INFO] Computed request commitment:", commitment);
  } else {
    console.log("[INFO] No request object provided. Set requestObject at the top of the script to compute the commitment.");
  }

  // If you already have a commitment, set it here:
  const REQUEST_COMMITMENT = commitment || "YOUR_REQUEST_COMMITMENT_OR_TX_HASH_HERE";
  if (!REQUEST_COMMITMENT || REQUEST_COMMITMENT === "YOUR_REQUEST_COMMITMENT_OR_TX_HASH_HERE") {
    console.error("Please set REQUEST_COMMITMENT at the top of the script or provide a requestObject.");
    process.exit(1);
  }

  const queryClient = createQueryClient({ url: INDEXER_URL });
  const indexer = new IndexerClient({ queryClient });

  console.log(`[INFO] Fetching status for commitment: ${REQUEST_COMMITMENT}`);
  const statusStream = await indexer.getRequestStatusStream(REQUEST_COMMITMENT);

  for await (const item of statusStream) {
    if (item && item.metadata && item.metadata.request) {
      const req = item.metadata.request;
      if (req.keys && req.keys.length > 0) {
        const key = req.keys[0];
        const keyHex = typeof key === "string" ? key : ethers.utils.hexlify(key);
        const feed = "0x" + keyHex.slice(2, 42);
        const slot = "0x" + keyHex.slice(42);
        console.log("[DECODED KEY]");
        console.log("Feed address:", feed);
        console.log("Slot:", ethers.BigNumber.from(slot).toString());
        break;
      }
    }
    if (item && item.status) {
      console.log(`[INFO] Status: ${item.status}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
}); 