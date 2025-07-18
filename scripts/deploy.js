const hre = require("hardhat");

async function main() {
  await hre.run('compile');

  const [deployer] = await hre.ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  // BSC testnet faucet integration (placeholder):
  // You may need to call the faucet API or contract here to fund the deployer with test tokens before deploying.
  // Example: await faucet.claim(deployer.address);

  // Deploy PredictionMarketFactory
  const Factory = await hre.ethers.getContractFactory("PredictionMarketFactory");
  const factory = await Factory.deploy(deployerAddress);
  await factory.waitForDeployment();
  const deployedAddress = await factory.getAddress();
  console.log("PredictionMarketFactory deployed to:", deployedAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 