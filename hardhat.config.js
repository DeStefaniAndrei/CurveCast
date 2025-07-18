require("@nomicfoundation/hardhat-toolbox")
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
    solidity: "0.8.28",
    resolc: {
        compilerSource: "npm",
    },
    networks: {
        bscTestnet: {
            url: "https://bsc-testnet.infura.io/v3/1baa7816d78641bf9ea27c9509cf1e50",
            chainId: 97,
            accounts: [
                "0x6ac767029147ca423267ec4a001285fec314564a46fdc56436e38934c6bf3c70"
              ]
        },
        sepolia: {
            url: "https://sepolia.infura.io/v3/1baa7816d78641bf9ea27c9509cf1e50", // Set your Sepolia RPC URL
            accounts: [
                "0x6ac767029147ca423267ec4a001285fec314564a46fdc56436e38934c6bf3c70"
              ], // Set your private key in .env
            chainId: 11155111,
        },
    }
};
