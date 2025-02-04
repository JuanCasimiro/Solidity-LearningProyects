const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MiColeccionNFT", function () {
  let miNFT, owner, addr1, addr2;
  // En ethers v6 usamos ethers.parseEther directamente
  const PRICE = ethers.parseEther("0.05"); // Devuelve un BigInt

  beforeEach(async function () {
    // Obtén las cuentas de prueba
    [owner, addr1, addr2, ...addrs] = await ethers.getSigners();
    // Obtén la fábrica del contrato y despliega (usa waitForDeployment)
    const MiColeccionNFTFactory = await ethers.getContractFactory("MiColeccionNFT");
    miNFT = await MiColeccionNFTFactory.deploy({ gasLimit: 12000000 });
    await miNFT.waitForDeployment();
  });

  describe("Deployment", function () {
    it("debería tener el nombre y símbolo correctos", async function () {
      expect(await miNFT.name()).to.equal("Mi Coleccion NFT");
      expect(await miNFT.symbol()).to.equal("MCNFT");
    });
  });

  describe("Minting", function () {
    it("debería permitir el mintManual correctamente", async function () {
      // addr1 mintea el token con ID 0
      await expect(
        miNFT.connect(addr1).mintManual(0, { value: PRICE, gasLimit: 500000 })
      ).to.emit(miNFT, "Transfer");
      expect(await miNFT.mintedTokens(0)).to.equal(true);
      // totalSupply() ahora devuelve BigInt
      const supply = await miNFT.totalSupply();
      expect(supply).to.equal(1n);
    });

    it("debería revertir mintManual si tokenId está fuera de rango", async function () {
      await expect(
        miNFT.connect(addr1).mintManual(50, { value: PRICE, gasLimit: 500000 })
      ).to.be.revertedWith("ID fuera de rango");
    });

    it("debería revertir mintManual si el NFT ya fue minteado", async function () {
      // addr1 mintea el token 5
      await miNFT.connect(addr1).mintManual(5, { value: PRICE, gasLimit: 500000 });
      // addr2 intenta mintear el mismo token
      await expect(
        miNFT.connect(addr2).mintManual(5, { value: PRICE, gasLimit: 500000 })
      ).to.be.revertedWith("NFT ya minteado");
    });

    it("debería revertir mintManual si se envía ETH insuficiente", async function () {
      await expect(
        miNFT.connect(addr1).mintManual(1, { value: ethers.parseEther("0.01"), gasLimit: 500000 })
      ).to.be.revertedWith("ETH insuficiente");
    });

    it("debería permitir el mintRandom y aumentar totalSupply", async function () {
      const initialSupply = await miNFT.totalSupply(); // BigInt
      await expect(
        miNFT.connect(addr1).mintRandom({ value: PRICE, gasLimit: 500000 })
      ).to.emit(miNFT, "Transfer");
      const finalSupply = await miNFT.totalSupply();
      expect(finalSupply).to.equal(initialSupply + 1n);
    });

    it("debería revertir mintRandom si se envía ETH insuficiente", async function () {
      await expect(
        miNFT.connect(addr1).mintRandom({ value: ethers.parseEther("0.01"), gasLimit: 500000 })
      ).to.be.revertedWith("ETH insuficiente");
    });
  });

  describe("Royalties", function () {
    it("debería retornar la royalty correcta", async function () {
      // Con _royaltyFee = 1000 (10%), para salePrice = 1 ETH, royaltyAmount = 0.1 ETH
      const salePrice = ethers.parseEther("1"); // BigInt
      const [royaltyReceiver, royaltyAmount] = await miNFT.royaltyInfo(0, salePrice);
      expect(royaltyReceiver).to.equal(owner.address);
      // Realizamos la operación aritmética con BigInt
      expect(royaltyAmount).to.equal((salePrice * 1000n) / 10000n);
    });

    it("debería permitir al owner actualizar la info de royalties", async function () {
      // Actualiza royalties a 5% (500) y establece addr1 como receptor
      await miNFT.connect(owner).setRoyaltyInfo(addr1.address, 500);
      const salePrice = ethers.parseEther("1");
      const [royaltyReceiver, royaltyAmount] = await miNFT.royaltyInfo(0, salePrice);
      expect(royaltyReceiver).to.equal(addr1.address);
      expect(royaltyAmount).to.equal((salePrice * 500n) / 10000n);
    });
  });

  describe("Withdrawals", function () {
    it("should allow the owner to withdraw contract funds", async function () {
        // addr1 mints token 2 to send ETH to the contract
        await miNFT.connect(addr1).mintManual(2, { value: PRICE, gasLimit: 500000 });
        // Verifica que el balance del contrato sea igual a PRICE
        const contractBalanceBefore = await ethers.provider.getBalance(miNFT.target);
        expect(contractBalanceBefore).to.equal(PRICE);
      
        // Obtiene el balance del owner antes de retirar
        const initialOwnerBalance = await ethers.provider.getBalance(owner.address);
      
        // Owner withdraws the funds
        const tx = await miNFT.connect(owner).withdraw();
        const receipt = await tx.wait();
      
        // Usa effectiveGasPrice si existe; de lo contrario, usa tx.gasPrice
        const effectiveGasPrice = receipt.effectiveGasPrice ? receipt.effectiveGasPrice : tx.gasPrice;
        // Convertir a BigInt para realizar cálculos precisos
        const gasCost = BigInt(receipt.gasUsed) * BigInt(effectiveGasPrice);
      
        // Obtiene el balance final del owner
        const finalOwnerBalance = await ethers.provider.getBalance(owner.address);
      
        // Calcula el balance esperado:
        // expectedFinalBalance = initialOwnerBalance + contractBalanceBefore - gasCost
        const expectedFinalBalance = BigInt(initialOwnerBalance) + BigInt(contractBalanceBefore) - gasCost;
      
        // Verifica que el balance final sea exactamente el esperado
        expect(finalOwnerBalance).to.equal(expectedFinalBalance);
      
        // Opcional: Verifica que el balance del contrato sea 0 después del retiro
        const contractBalanceAfter = await ethers.provider.getBalance(miNFT.target);
        expect(contractBalanceAfter).to.equal(0n);
      });

    it("debería revertir withdraw si la llamada no es del owner", async function () {
      await expect(miNFT.connect(addr1).withdraw()).to.be.reverted;
    });
  });
});
