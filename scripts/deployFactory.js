const hre = require("hardhat");
const { ethers } = require("ethers");

async function main() {
  // Hardcoded admin address (your wallet address)
  const admin = "0x93d43c27746D76e7606C55493A757127b33D7763";

  const Factory = await hre.ethers.getContractFactory("PredictionMarketFactory");
  const factory = await Factory.deploy(admin);
  await factory.waitForDeployment();

  console.log("PredictionMarketFactory deployed to:", await factory.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 