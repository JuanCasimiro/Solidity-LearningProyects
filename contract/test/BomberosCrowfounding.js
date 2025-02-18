const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("FirefighterCrowdfunding", function () {
  let FirefighterCrowdfunding;
  let crowdfunding;
  let owner;
  let contributor1;
  let contributor2;
  let whitelistAddress;
  let campaignId;

  beforeEach(async function () {
    // Obtener las direcciones de los participantes
    [owner, contributor1, contributor2, whitelistAddress] = await ethers.getSigners();

    // Desplegar el contrato antes de cada test
    FirefighterCrowdfunding = await ethers.getContractFactory("FirefighterCrowdfunding");
    crowdfunding = await FirefighterCrowdfunding.deploy({ gasLimit: 12000000 });

    await crowdfunding.setWhitelist(whitelistAddress.address, true);
    // Asegurarse de que el contrato esté desplegado correctamente
  });

  describe("setWhitelist", function () {
    it("should add and remove an address from the whitelist", async function () {
      await crowdfunding.setWhitelist(whitelistAddress.address, true);
      expect(await crowdfunding.whitelist(whitelistAddress.address)).to.be.true;

      await crowdfunding.setWhitelist(whitelistAddress.address, false);
      expect(await crowdfunding.whitelist(whitelistAddress.address)).to.be.false;
    });
  });

  describe("createCampaign", function () {
    it("should allow whitelisted users to create campaigns", async function () {
      const title = "Firefighter Fund";
      const description = "Helping firefighters with funding";
      const goal = ethers.parseEther("5");
      const duration = 60 * 60 * 24; // 1 day

      // Create campaign
      await expect(
        crowdfunding.connect(whitelistAddress).createCampaign(title, description, goal, duration)
      )
        .to.emit(crowdfunding, "CampaignCreated")
        .withArgs(1, whitelistAddress.address, title, goal, duration);

      // Check if campaign was created
      const campaign = await crowdfunding.campaigns(1);
      expect(campaign.creator).to.equal(whitelistAddress.address);
      expect(campaign.title).to.equal(title);
      expect(campaign.goal.toString()).to.equal(goal.toString());
    });

    it("should revert if non-whitelisted users try to create a campaign", async function () {
      const title = "Firefighter Fund";
      const description = "Helping firefighters with funding";
      const goal = ethers.parseEther("5");
      const duration = 60 * 60 * 24; // 1 day

      await expect(
        crowdfunding.connect(contributor1).createCampaign(title, description, goal, duration)
      ).to.be.revertedWith("Not authorized to create campaigns");
    });
  });

  describe("contribute", function () {
    beforeEach(async function () {
      const title = "Firefighter Fund";
      const description = "Helping firefighters with funding";
      const goal = ethers.parseEther("5");
      const duration = 60 * 60 * 24; // 1 day

      await crowdfunding.connect(whitelistAddress).createCampaign(title, description, goal, duration);
      campaignId = 1;
    });

    it("should allow users to contribute to campaigns", async function () {
      const contributionAmount = ethers.parseEther("1");

      await expect(
        crowdfunding.connect(contributor1).contribute(campaignId, { value: contributionAmount })
      ).to.emit(crowdfunding, "Funded").withArgs(campaignId, contributor1.address, contributionAmount);

      const campaign = await crowdfunding.campaigns(campaignId);
      expect(campaign.fundsRaised.toString()).to.equal(contributionAmount.toString());
    });

    it("should mint NFT if contribution exceeds threshold", async function () {
      const contributionAmount = ethers.parseEther("2");

      await expect(
        crowdfunding.connect(contributor1).contribute(campaignId, { value: contributionAmount })
      ).to.emit(crowdfunding, "NFTMinted").withArgs(contributor1.address, 0);

      // Check NFT balance
      const balance = await crowdfunding.balanceOf(contributor1.address);
      expect(balance).to.equal(1);
    });

    it("should revert if contribution is zero", async function () {
      await expect(
        crowdfunding.connect(contributor1).contribute(campaignId, { value: 0 })
      ).to.be.revertedWith("Contribution must be greater than zero");
    });
  });

  describe("withdrawFunds", function () {
    beforeEach(async function () {
      const title = "Firefighter Fund";
      const description = "Helping firefighters with funding";
      const goal = ethers.parseEther("5");
      const duration = 60 * 60 * 24; // 1 day

      await crowdfunding.connect(whitelistAddress).createCampaign(title, description, goal, duration);
      campaignId = 1;

      // Contribute to the campaign
      const contributionAmount = ethers.parseEther("2");
      await crowdfunding.connect(contributor1).contribute(campaignId, { value: contributionAmount });
    });

    it("should allow campaign creator to withdraw funds after deadline", async function () {
      // Fast forward time to after the deadline
      await network.provider.send("evm_increaseTime", [60 * 60 * 24]);
      await network.provider.send("evm_mine");

      const initialBalance = await ethers.provider.getBalance(whitelistAddress.address);
      console.log("Initial Balance:", ethers.formatEther(initialBalance), "ETH"); 

      const contractBalance = await ethers.provider.getBalance(crowdfunding.target);
      console.log("Contract Initial Balance:", ethers.formatEther(contractBalance), "ETH");

      await expect(
        crowdfunding.connect(whitelistAddress).withdrawFunds(campaignId)
      ).to.emit(crowdfunding, "Withdrawn").withArgs(campaignId, ethers.parseEther("2"));

      const fundsRaised = await crowdfunding.campaigns(campaignId);
      console.log("Funds Raised:", ethers.formatEther(fundsRaised.fundsRaised), "ETH");

      let finalBalance = await ethers.provider.getBalance(whitelistAddress.address);
      console.log("Final Balance:", ethers.formatEther(finalBalance), "ETH");
      const contractFinalBalance = await ethers.provider.getBalance(crowdfunding.target);
      console.log("Contract Final Balance:", ethers.formatEther(contractFinalBalance), "ETH");
      
      expect(BigInt(finalBalance.toString())
        ).to.be.greaterThan(
        BigInt(initialBalance.toString())
    );
    });

    it("should revert if non-creator tries to withdraw funds", async function () {
      await expect(
        crowdfunding.connect(contributor1).withdrawFunds(campaignId)
      ).to.be.revertedWith("Only the creator can withdraw funds");
    });

    it("should revert if trying to withdraw before the deadline", async function () {
      await expect(
        crowdfunding.connect(whitelistAddress).withdrawFunds(campaignId)
      ).to.be.revertedWith("Cannot withdraw before deadline");
    });

    it("should revert if funds have already been withdrawn", async function () {
      await network.provider.send("evm_increaseTime", [60 * 60 * 24]);
      await network.provider.send("evm_mine");

      await crowdfunding.connect(whitelistAddress).withdrawFunds(campaignId);
      await expect(
        crowdfunding.connect(whitelistAddress).withdrawFunds(campaignId)
      ).to.be.revertedWith("Funds already withdrawn");
    });
  });
});
