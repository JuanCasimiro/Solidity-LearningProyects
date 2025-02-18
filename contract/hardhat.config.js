require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config(); // Cargar variables de entorno desde .env

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.28", // Asegúrate de usar la versión correcta de Solidity
  networks: {
    sepolia: {
      url: process.env.ALCHEMY_TESTNET_RPC_URL, // URL de Alchemy para Sepolia
      accounts: [process.env.TESTNET_PRIVATE_KEY], // Clave privada de tu wallet
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY, // API key de Etherscan
  },
};