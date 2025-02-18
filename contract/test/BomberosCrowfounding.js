const { expect } = require("chai");
const { ethers, network } = require("hardhat");

describe("FirefighterCrowdfunding", function () {
  let FirefighterCrowdfunding;
  let crowdfunding;
  let owner;
  let contributor1;
  let contributor2;
  let whitelistAddress;
  let nonWhitelistAddress;
  let campaignId;

  beforeEach(async function () {
    // Obtener las direcciones de los participantes
    [owner, contributor1, contributor2, whitelistAddress, nonWhitelistAddress] = await ethers.getSigners();

    // Desplegar el contrato antes de cada test
    FirefighterCrowdfunding = await ethers.getContractFactory("FirefighterCrowdfunding");
    crowdfunding = await FirefighterCrowdfunding.deploy({ gasLimit: 12000000 });

    // Agregar whitelistAddress a la whitelist
    await crowdfunding.setWhitelist(whitelistAddress.address, true);
  });

  describe("setWhitelist", function () {
    it("should add and remove an address from the whitelist", async function () {
      await crowdfunding.setWhitelist(whitelistAddress.address, true);
      expect(await crowdfunding.whitelist(whitelistAddress.address)).to.be.true;

      await crowdfunding.setWhitelist(whitelistAddress.address, false);
      expect(await crowdfunding.whitelist(whitelistAddress.address)).to.be.false;
    });

    it("should revert if a non-owner attempts to modify the whitelist", async function () {
      await expect(
        crowdfunding.connect(contributor1).setWhitelist(nonWhitelistAddress.address, true)
      ).to.be.revertedWithCustomError(crowdfunding, "OwnableUnauthorizedAccount")
      .withArgs(contributor1.address);
    });
  });

  describe("setNFTThreshold", function () {
    it("should update the NFT threshold", async function () {
      const newThreshold = ethers.parseEther("2");
      await crowdfunding.setNFTThreshold(newThreshold);
      expect(await crowdfunding.nftThreshold()).to.equal(newThreshold);
    });

    it("should revert if a non-owner attempts to update NFT threshold", async function () {
      const newThreshold = ethers.parseEther("2");
      await expect(
        crowdfunding.connect(contributor1).setNFTThreshold(newThreshold)
      ).to.be.revertedWithCustomError(crowdfunding, "OwnableUnauthorizedAccount")
      .withArgs(contributor1.address);
    });
  });

  describe("createCampaign", function () {
    it("should allow whitelisted users to create campaigns", async function () {
      const title = "Firefighter Fund";
      const description = "Helping firefighters with funding";
      const goal = ethers.parseEther("5");
      const duration = 60 * 60 * 24; // 1 day

      await expect(
        crowdfunding.connect(whitelistAddress).createCampaign(title, description, goal, duration)
      )
        .to.emit(crowdfunding, "CampaignCreated")
        .withArgs(1, whitelistAddress.address, title, goal, duration);

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

    it("should revert if the campaign goal is zero", async function () {
      const title = "Test Campaign";
      const description = "Test description";
      const goal = 0;
      const duration = 60 * 60 * 24; // 1 day

      await expect(
        crowdfunding.connect(whitelistAddress).createCampaign(title, description, goal, duration)
      ).to.be.revertedWith("Goal must be greater than zero");
    });

    it("should revert if the campaign duration is zero", async function () {
      const title = "Test Campaign";
      const description = "Test description";
      const goal = ethers.parseEther("1");
      const duration = 0;

      await expect(
        crowdfunding.connect(whitelistAddress).createCampaign(title, description, goal, duration)
      ).to.be.revertedWith("Duration must be greater than zero");
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

      const balance = await crowdfunding.balanceOf(contributor1.address);
      expect(balance).to.equal(1);
    });

    it("should revert if contribution is zero", async function () {
      await expect(
        crowdfunding.connect(contributor1).contribute(campaignId, { value: 0 })
      ).to.be.revertedWith("Contribution must be greater than zero");
    });

    it("should revert if campaign does not exist", async function () {
      await expect(
        crowdfunding.connect(contributor1).contribute(999, { value: ethers.parseEther("1") })
      ).to.be.revertedWith("Campaign does not exist");
    });

    it("should revert if campaign has ended", async function () {
      await network.provider.send("evm_increaseTime", [60 * 60 * 24]);
      await network.provider.send("evm_mine");

      await expect(
        crowdfunding.connect(contributor1).contribute(campaignId, { value: ethers.parseEther("1") })
      ).to.be.revertedWith("Campaign has ended");
    });

    it("should update contributions mapping correctly for multiple contributions from the same user", async function () {
      const contribution1 = ethers.parseEther("0.5");
      const contribution2 = ethers.parseEther("0.7");

      await crowdfunding.connect(contributor1).contribute(campaignId, { value: contribution1 });
      await crowdfunding.connect(contributor1).contribute(campaignId, { value: contribution2 });

      const campaign = await crowdfunding.campaigns(campaignId);
      expect(campaign.fundsRaised.toString()).to.equal(ethers.parseEther("1.2").toString());

      const userContribution = await crowdfunding.contributions(campaignId, contributor1.address);
      expect(userContribution.toString()).to.equal(ethers.parseEther("1.2").toString());
    });

    it("should mint NFT only once even after multiple contributions that exceed the threshold", async function () {
      const contribution1 = ethers.parseEther("0.6");
      const contribution2 = ethers.parseEther("0.5");
      const contribution3 = ethers.parseEther("0.5");

      await expect(
        crowdfunding.connect(contributor1).contribute(campaignId, { value: contribution1 })
      ).not.to.emit(crowdfunding, "NFTMinted");

      await expect(
        crowdfunding.connect(contributor1).contribute(campaignId, { value: contribution2 })
      ).to.emit(crowdfunding, "NFTMinted").withArgs(contributor1.address, 0);

      await expect(
        crowdfunding.connect(contributor1).contribute(campaignId, { value: contribution3 })
      ).not.to.emit(crowdfunding, "NFTMinted");

      const balance = await crowdfunding.balanceOf(contributor1.address);
      expect(balance).to.equal(1);
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

      const contributionAmount = ethers.parseEther("2");
      await crowdfunding.connect(contributor1).contribute(campaignId, { value: contributionAmount });
    console.log(await crowdfunding.getFundsRaised(campaignId));
    });
  
    it("should return the correct funds raised for a campaign", async function () {
        const fundsRaised = await crowdfunding.getFundsRaised(campaignId);
        expect(fundsRaised.toString()).to.equal(ethers.parseEther("2").toString());
      });

    it("should allow campaign creator to withdraw funds after deadline", async function () {
      await network.provider.send("evm_increaseTime", [60 * 60 * 24]);
      await network.provider.send("evm_mine");

      const initialBalance = await ethers.provider.getBalance(whitelistAddress.address);

      await expect(
        crowdfunding.connect(whitelistAddress).withdrawFunds(campaignId)
      ).to.emit(crowdfunding, "Withdrawn").withArgs(campaignId, ethers.parseEther("2"));

      const finalBalance = await ethers.provider.getBalance(whitelistAddress.address);
      expect(BigInt(finalBalance.toString())).to.be.greaterThan(BigInt(initialBalance.toString()));
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

    it("should revert if trying to withdraw funds from a non-existent campaign", async function () {
      await expect(
        crowdfunding.connect(whitelistAddress).withdrawFunds(999)
      ).to.be.revertedWith("Campaign does not exist");
    });
  });
});
