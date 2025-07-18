const hre = require("hardhat");

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const feeTokenAddress = "0xA801da100bF16D07F668F4A49E1f71fc54D05177";
  const factoryAddress = "0x25F1471e8F729a3e8424B883b9D68b2f019D6167"; // PredictionMarketFactory on BSC testnet

  // ABI fragment for getMarkets()
  const factoryAbi = [
    "function getMarkets() view returns (address[] memory)"
  ];
  const factory = await hre.ethers.getContractAt(factoryAbi, factoryAddress, signer);
  const markets = await factory.getMarkets();
  if (!markets || markets.length === 0) {
    throw new Error("No markets found in factory.");
  }
  console.log(`Found ${markets.length} market(s).`);

  // ERC20 ABI fragment for approve
  const erc20Abi = [
    "function approve(address spender, uint256 amount) public returns (bool)"
  ];
  const feeToken = await hre.ethers.getContractAt(erc20Abi, feeTokenAddress, signer);

  // Approve a large amount (adjust as needed)
  const amount = hre.ethers.parseUnits("1000", 18); // 1000 tokens, adjust decimals if needed

  for (const marketAddress of markets) {
    console.log(`Approving ${amount} tokens for market: ${marketAddress}`);
    const tx = await feeToken.approve(marketAddress, amount);
    await tx.wait();
    console.log(`Approved ${amount} tokens for ${marketAddress}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 