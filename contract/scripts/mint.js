const { ethers } = require("hardhat");

async function main() {
    // Dirección del contrato desplegado
    const contractAddress = "0xb112966D4265125BC52d59eF7579900a2f20A1c0";

    // Conectarse al contrato
    const MiColeccionNFT = await ethers.getContractFactory("MiColeccionNFT");
    const contract = MiColeccionNFT.attach(contractAddress);

    // Cantidad de ETH a enviar (precio del NFT)
    const price = ethers.parseEther("0.05");

    // Llamar a la función mintRandom para mintear un nuevo NFT
    const tx = await contract.mintManual({ value: price });
    await tx.wait();

    console.log("NFT minteado exitosamente");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});