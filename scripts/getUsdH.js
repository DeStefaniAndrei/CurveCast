const hre = require("hardhat");

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const user = signer.address;
  console.log(`[INFO] Using wallet: ${user}`);

  // Step 1: Get USD.h token address from IsmpHost
  const ismpHostAddress = "0x8Aa0Dea6D675d785A882967Bf38183f6117C09b7"; // BSC Testnet IsmpHost
  const host = await hre.ethers.getContractAt([
    "function feeToken() view returns (address)"
  ], ismpHostAddress);
  const usdHAddress = await host.feeToken();
  console.log(`[INFO] USD.h token address: ${usdHAddress}`);

  // Step 2: Call the faucet to mint USD.h
  const faucetAddress = "0x1794aB22388303ce9Cb798bE966eeEBeFe59C3a3";
  const faucet = await hre.ethers.getContractAt([
    "function drip(address token) public"
  ], faucetAddress);
  console.log(`[INFO] Requesting USD.h from faucet...`);
  const tx = await faucet.drip(usdHAddress);
  await tx.wait();
  console.log(`[SUCCESS] Faucet transaction sent!`);

  // Step 3: Check USD.h balance
  const usdH = await hre.ethers.getContractAt([
    "function balanceOf(address) view returns (uint256)"
  ], usdHAddress);
  const balance = await usdH.balanceOf(user);
  console.log(`[INFO] USD.h balance: ${hre.ethers.formatEther(balance)} USD.h`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 