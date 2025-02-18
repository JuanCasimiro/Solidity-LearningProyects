const { ethers } = require("hardhat");

async function main() {
    // Dirección del contrato desplegado
    const contractAddress = "0xb112966D4265125BC52d59eF7579900a2f20A1c0";

    // Conectarse al contrato
    const MiColeccionNFT = await ethers.getContractFactory("MiColeccionNFT");
    const contract = MiColeccionNFT.attach(contractAddress);

    // Nuevo baseURI
    const newBaseURI = "ipfs://bafybeidlj7ejlwnx4oc7gdaoptrxyrojsql5p3b5gbw5pbt64swnn5gpui/";

    // Llamar a la función setBaseURI
    const tx = await contract.setBaseURI(newBaseURI);
    await tx.wait();

    console.log(`BaseURI establecido exitosamente: ${newBaseURI}`);

    // Consultar el tokenURI para el ID 0
    const tokenURI = await contract.tokenURI(0);
    console.log(`Token URI para el ID 0: ${tokenURI}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});