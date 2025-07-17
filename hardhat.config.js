require("@nomicfoundation/hardhat-toolbox")

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
    solidity: "0.8.28",
    resolc: {
        compilerSource: "npm",
    },
    networks: {
        bscTestnet: {
            url: "https://bsc-testnet.infura.io/v3/fbb4fa2b1b734058b1ef4b6a3bb2a602",
            chainId: 97,
            accounts: [
                "0x6ac767029147ca423267ec4a001285fec314564a46fdc56436e38934c6bf3c70"
              ]
        }
    }
};
