// scripts/topUpFactoryV2.js
const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const FACTORY_V2_ADDRESS = "0xf3018cbEB09bFbB6C6A674201801364e9A4f57B3";
  const USDH_ADDRESS = "0xA801da100bF16D07F668F4A49E1f71fc54D05177";
  const amount = hre.ethers.utils.parseUnits("20", 18);

  const usdH = await hre.ethers.getContractAt("IERC20", USDH_ADDRESS);
  const tx = await usdH.transfer(FACTORY_V2_ADDRESS, amount);
  await tx.wait();
  console.log(`Funded factory V2 with 20 USD.h tokens.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 