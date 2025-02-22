// Importar ethers desde Hardhat
const { ethers } = require("hardhat");

async function main() {
  // Obtener el nombre del contrato
  const contractName = "FirefighterCrowdfunding";

  // Obtener la fábrica del contrato
  const ContractFactory = await ethers.getContractFactory(contractName);

  // Desplegar el contrato
  console.log(`Desplegando el contrato ${contractName}...`);
  const contract = await ContractFactory.deploy();

  // Esperar a que la transacción de despliegue sea confirmada
  await contract.waitForDeployment();

  // Obtener la dirección del contrato desplegado
  const contractAddress = await contract.getAddress();
  console.log(`${contractName} desplegado en la dirección:`, contractAddress);
}

// Ejecutar la función principal y manejar errores
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error durante el despliegue:", error);
    process.exit(1);
  });