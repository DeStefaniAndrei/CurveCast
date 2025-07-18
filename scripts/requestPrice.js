const hre = require("hardhat");

async function main() {
  const [signer] = await hre.ethers.getSigners();
  
  // Configuration
  const marketAddress = process.env.MARKET_ADDRESS || "0x..."; // Set this
  const chainlinkFeed = "0xA39434A63A52E749F02807ae27335515BA4b07F7"; // BTC/USD on Sepolia
  const timeout = 3600; // 1 hour timeout
  const fee = hre.ethers.parseEther("0.1"); // 0.1 DAI fee
  
  if (!marketAddress || marketAddress === "0x...") {
    console.error("Please set MARKET_ADDRESS environment variable");
    process.exit(1);
  }

  console.log(`[INFO] Requesting price for market: ${marketAddress}`);
  console.log(`[INFO] Chainlink feed: ${chainlinkFeed}`);
  console.log(`[INFO] Timeout: ${timeout} seconds`);
  console.log(`[INFO] Fee: ${hre.ethers.formatEther(fee)} DAI`);

  const market = await hre.ethers.getContractAt("PredictionMarket", marketAddress, signer);
  
  // Check market state
  const state = await market.state();
  const dispatcher = await market.dispatcher();
  
  console.log(`[DEBUG] Market state: ${state} (0=Open, 1=Closed, 2=Resolved)`);
  console.log(`[DEBUG] Dispatcher: ${dispatcher}`);
  
  if (state !== 1) {
    console.log(`[ERROR] Market must be closed to request price. Current state: ${state}`);
    process.exit(1);
  }
  
  // Setup fee token approval if needed
  if (dispatcher !== hre.ethers.ZeroAddress) {
    console.log(`[INFO] Setting up fee token approval...`);
    
    // Get fee token address from dispatcher
    const dispatcherContract = await hre.ethers.getContractAt([
      "function feeToken() view returns (address)"
    ], dispatcher);
    
    const feeTokenAddress = await dispatcherContract.feeToken();
    console.log(`[INFO] Fee token address: ${feeTokenAddress}`);
    
    // Get fee token contract
    const feeToken = await hre.ethers.getContractAt([
      "function balanceOf(address) view returns (uint256)",
      "function allowance(address,address) view returns (uint256)",
      "function approve(address,uint256)"
    ], feeTokenAddress);
    
    const balance = await feeToken.balanceOf(signer.address);
    const allowance = await feeToken.allowance(signer.address, dispatcher);
    
    console.log(`[INFO] Fee token balance: ${hre.ethers.formatEther(balance)}`);
    console.log(`[INFO] Current allowance: ${hre.ethers.formatEther(allowance)}`);
    
    if (balance < fee) {
      console.log(`[ERROR] Insufficient fee token balance. Need ${hre.ethers.formatEther(fee)}, have ${hre.ethers.formatEther(balance)}`);
      process.exit(1);
    }
    
    if (allowance < fee) {
      console.log(`[INFO] Approving fee token...`);
      const approveTx = await feeToken.approve(dispatcher, hre.ethers.MaxUint256);
      await approveTx.wait();
      console.log(`[SUCCESS] Fee token approved`);
    }
  }
  
  // Request price
  console.log(`[INFO] Requesting price from Hyperbridge...`);
  const tx = await market.requestPriceGet(chainlinkFeed, timeout, fee);
  const receipt = await tx.wait();
  
  console.log(`[SUCCESS] Price request submitted`);
  console.log(`[INFO] Transaction: ${receipt.hash}`);
  
  // Check if price was requested
  const priceRequested = await market.priceRequested();
  console.log(`[INFO] Price requested flag: ${priceRequested}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 