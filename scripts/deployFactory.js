const hre = require("hardhat");

async function main() {
  // --- CONFIG ---
  const admin = "0x93d43c27746D76e7606C55493A757127b33D7763"; // your wallet address
  const usdAddress = "0xA801da100bF16D07F668F4A49E1f71fc54D05177"; // USD.h on BSC testnet

  const Factory = await hre.ethers.getContractFactory("PredictionMarketFactory");
  const factory = await Factory.deploy(admin, usdAddress);
  await factory.waitForDeployment();

  const factoryAddress = await factory.getAddress();
  console.log("PredictionMarketFactory deployed to:", factoryAddress);

  console.log(`[INFO] To fund the factory, approve it to spend your USD.h, then call fundFactory(amount) as owner.`);
  console.log(`[INFO] Example in Hardhat console:`);
  console.log(`const usd = await ethers.getContractAt(\"IERC20\", \"${usdAddress}\")`);
  console.log(`await usd.approve(\"${factoryAddress}\", ethers.parseEther(\"100\"))`);
  console.log(`const factory = await ethers.getContractAt(\"PredictionMarketFactory\", \"${factoryAddress}\")`);
  console.log(`await factory.fundFactory(ethers.parseEther(\"100\"))`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 