const hre = require("hardhat");

async function main() {
  // --- CONFIG ---
  const factoryAddress = "0x6bd732B016Fc7A089d8909dB4F172E619730E479"; // update if needed
  const usdAddress = "0xA801da100bF16D07F668F4A49E1f71fc54D05177"; // USD.h on BSC testnet
  const amount = hre.ethers.parseEther("100"); // Amount to send (100 USD.h)

  const [signer] = await hre.ethers.getSigners();
  const usd = await hre.ethers.getContractAt("IERC20", usdAddress, signer);

  const balance = await usd.balanceOf(signer.address);
  if (balance < amount) {
    console.error(`Insufficient USD.h balance. You have ${hre.ethers.formatEther(balance)}, need ${hre.ethers.formatEther(amount)}`);
    process.exit(1);
  }

  console.log(`[INFO] Sending ${hre.ethers.formatEther(amount)} USD.h to factory at ${factoryAddress}...`);
  const tx = await usd.transfer(factoryAddress, amount);
  await tx.wait();
  console.log(`[SUCCESS] Sent! Tx hash: ${tx.hash}`);

  const newBalance = await usd.balanceOf(factoryAddress);
  console.log(`[INFO] Factory USD.h balance: ${hre.ethers.formatEther(newBalance)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 