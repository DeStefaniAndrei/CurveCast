const hre = require("hardhat");

async function main() {
  const [signer] = await hre.ethers.getSigners();
  
  // Configuration
  const marketAddress = process.env.MARKET_ADDRESS || "0x..."; // Set this
  const mockPrice = process.env.MOCK_PRICE || "51500"; // Set this (e.g., 51500 for $51,500)
  
  if (!marketAddress || marketAddress === "0x...") {
    console.error("Please set MARKET_ADDRESS environment variable");
    process.exit(1);
  }

  console.log(`[INFO] Manually resolving market: ${marketAddress}`);
  console.log(`[INFO] Mock price: ${mockPrice}`);

  const market = await hre.ethers.getContractAt("PredictionMarket", marketAddress, signer);
  
  // Check market state
  const state = await market.state();
  const closeTime = await market.closeTime();
  const now = Math.floor(Date.now() / 1000);
  
  console.log(`[DEBUG] Market state: ${state} (0=Open, 1=Closed, 2=Resolved)`);
  console.log(`[DEBUG] Close time: ${closeTime}`);
  console.log(`[DEBUG] Current time: ${now}`);
  
  // Close market if not already closed
  if (state === 0) {
    if (now < closeTime) {
      console.log(`[ERROR] Market not ready to close. Close time: ${closeTime}, Current time: ${now}`);
      process.exit(1);
    }
    
    console.log(`[INFO] Closing market...`);
    const closeTx = await market.closeMarket();
    await closeTx.wait();
    console.log(`[SUCCESS] Market closed`);
  } else if (state === 1) {
    console.log(`[INFO] Market already closed`);
  } else {
    console.log(`[INFO] Market already resolved`);
    process.exit(0);
  }
  
  // Create mock Hyperbridge response
  const abiCoder = new hre.ethers.AbiCoder();
  const encodedPrice = abiCoder.encode(["int256"], [parseInt(mockPrice)]);
  
  // Mock the Chainlink feed address and slot for latest answer
  const chainlinkFeed = "0xA39434A63A52E749F02807ae27335515BA4b07F7"; // BTC/USD on Sepolia
  const key = abiCoder.encodePacked(
    chainlinkFeed,
    hre.ethers.zeroPadValue("0x00", 32) // slot 0 for latest answer
  );
  
  const mockGetRequest = {
    source: "0x",
    dest: "0x", 
    nonce: 0,
    from: hre.ethers.ZeroAddress,
    timeoutTimestamp: 0,
    keys: [key],
    height: 0,
    context: "0x"
  };
  
  const mockStorageValue = {
    key: key,
    value: encodedPrice
  };
  
  const mockGetResponse = {
    request: mockGetRequest,
    values: [mockStorageValue]
  };
  
  const mockIncoming = {
    response: mockGetResponse,
    relayer: hre.ethers.ZeroAddress
  };
  
  // Call onGetResponse as the dispatcher (we'll use the owner for testing)
  console.log(`[INFO] Resolving market with price: ${mockPrice}`);
  const resolveTx = await market.onGetResponse(mockIncoming);
  await resolveTx.wait();
  
  console.log(`[SUCCESS] Market resolved with price: ${mockPrice}`);
  
  // Check final state
  const finalState = await market.state();
  const outcome = await market.outcome();
  console.log(`[INFO] Final market state: ${finalState}`);
  console.log(`[INFO] Outcome: ${outcome}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 