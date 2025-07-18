// scripts/deployFactoryV2.js
const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  // Replace with the correct USD.h token address for BSC testnet
  const feeToken = "0xA801da100bF16D07F668F4A49E1f71fc54D05177";

  const Factory = await hre.ethers.getContractFactory("PredictionMarketFactoryV2");
  const factory = await Factory.deploy(deployer.address, feeToken);
  await factory.deployed();
  console.log("PredictionMarketFactoryV2 deployed to:", factory.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 