const { expect } = require("chai");
const { ethers, network } = require("hardhat");

describe("FirefighterCrowdfunding", function () {
  let FirefighterCrowdfunding;
  let crowdfunding;
  let owner, contributor1, contributor2, whitelistAddress, nonWhitelistAddress;
  let campaignId;

  beforeEach(async function () {
    [owner, contributor1, contributor2, whitelistAddress, nonWhitelistAddress] = await ethers.getSigners();
    FirefighterCrowdfunding = await ethers.getContractFactory("FirefighterCrowdfunding");
    crowdfunding = await FirefighterCrowdfunding.deploy({ gasLimit: 12000000 });
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

  describe("Whitelisted event", function () {
    it("should emit Whitelisted event when address is added to whitelist", async function () {
      await expect(
        crowdfunding.setWhitelist(nonWhitelistAddress.address, true)
      ).to.emit(crowdfunding, "Whitelisted").withArgs(nonWhitelistAddress.address, true);
    });

    it("should emit Whitelisted event when address is removed from whitelist", async function () {
      await crowdfunding.setWhitelist(nonWhitelistAddress.address, true);
      await expect(
        crowdfunding.setWhitelist(nonWhitelistAddress.address, false)
      ).to.emit(crowdfunding, "Whitelisted").withArgs(nonWhitelistAddress.address, false);
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
      const duration = 1; // 1 day

      const tx = await crowdfunding.connect(whitelistAddress).createCampaign(title, description, goal, duration);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);
      const expectedDeadline = block.timestamp + duration * 86400;

      await expect(tx)
        .to.emit(crowdfunding, "CampaignCreated")
        .withArgs(1, whitelistAddress.address, title, goal, expectedDeadline);

      const campaign = await crowdfunding.campaigns(1);
      expect(campaign.id).to.equal(1);
      expect(campaign.creator).to.equal(whitelistAddress.address);
      expect(campaign.title).to.equal(title);
      expect(campaign.goal.toString()).to.equal(goal.toString());
      expect(campaign.deadline).to.be.closeTo(expectedDeadline, 1); // Allow a 1 second difference
    });

    it("should revert if non-whitelisted users try to create a campaign", async function () {
      const title = "Firefighter Fund";
      const description = "Helping firefighters with funding";
      const goal = ethers.parseEther("5");
      const duration = 1; // 1 day

      await expect(
        crowdfunding.connect(contributor1).createCampaign(title, description, goal, duration)
      ).to.be.revertedWith("Not authorized to create campaigns");
    });

    it("should revert if the campaign goal is zero", async function () {
      const title = "Test Campaign";
      const description = "Test description";
      const goal = 0;
      const duration = 1; // 1 day

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
      const duration = 1; // 1 day

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

    it("should not mint NFT if contribution equals threshold", async function () {
      const contributionAmount = ethers.parseEther("1");

      await expect(
        crowdfunding.connect(contributor1).contribute(campaignId, { value: contributionAmount })
      ).not.to.emit(crowdfunding, "NFTMinted");

      const balance = await crowdfunding.balanceOf(contributor1.address);
      expect(balance).to.equal(0);
    });

    it("should not mint NFT if contribution is below threshold", async function () {
      const contributionAmount = ethers.parseEther("0.5"); // Below nftThreshold

      await expect(
        crowdfunding.connect(contributor1).contribute(campaignId, { value: contributionAmount })
      ).not.to.emit(crowdfunding, "NFTMinted");

      const balance = await crowdfunding.balanceOf(contributor1.address);
      expect(balance).to.equal(0);
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
  });

  describe("refund", function () {
    beforeEach(async function () {
      const title = "Firefighter Fund";
      const description = "Helping firefighters with funding";
      const goal = ethers.parseEther("5");
      const duration = 1; // 1 day

      await crowdfunding.connect(whitelistAddress).createCampaign(title, description, goal, duration);
      campaignId = 1;

      // Contributor contributes to the campaign
      const contributionAmount = ethers.parseEther("2");
      await crowdfunding.connect(contributor1).contribute(campaignId, { value: contributionAmount });
    });

    it("should allow refunds if the campaign fails and is within the claim period", async function () {
      // End the campaign
      await network.provider.send("evm_increaseTime", [60 * 60 * 24]); // 1 day
      await network.provider.send("evm_mine");

      const initialBalance = await ethers.provider.getBalance(contributor1.address);

      // Refund the contribution
      await expect(
        crowdfunding.connect(contributor1).refund(campaignId)
      ).to.changeEtherBalance(contributor1, ethers.parseEther("2"));

      const finalBalance = await ethers.provider.getBalance(contributor1.address);
      expect(BigInt(finalBalance.toString())).to.be.greaterThan(BigInt(initialBalance.toString()));
    });

    it("should revert if the campaign succeeds", async function () {
      // Contribute enough to meet the goal
      const contributionAmount = ethers.parseEther("5");
      await crowdfunding.connect(contributor2).contribute(campaignId, { value: contributionAmount });

      // End the campaign
      await network.provider.send("evm_increaseTime", [60 * 60 * 24]); // 1 day
      await network.provider.send("evm_mine");

      // Attempt to refund
      await expect(
        crowdfunding.connect(contributor1).refund(campaignId)
      ).to.be.revertedWith("Campaign was successful, no refunds");
    });

    it("should revert if the refund period has expired", async function () {
      // Increase time beyond the 15-day claim period
      await network.provider.send("evm_increaseTime", [16 * 24 * 60 * 60]); // 16 days
      await network.provider.send("evm_mine");

      // Attempt to refund
      await expect(
        crowdfunding.connect(contributor1).refund(campaignId)
      ).to.be.revertedWith("Refund period has expired");
    });

    it("should revert if there are no funds to refund", async function () {
      // End the campaign
      await network.provider.send("evm_increaseTime", [60 * 60 * 24]); // 1 day
      await network.provider.send("evm_mine");

      // Refund once
      await crowdfunding.connect(contributor1).refund(campaignId);

      // Attempt to refund again
      await expect(
        crowdfunding.connect(contributor1).refund(campaignId)
      ).to.be.revertedWith("No funds to refund");
    });
  });

  describe("withdrawFunds", function () {
    beforeEach(async function () {
      const title = "Firefighter Fund";
      const description = "Helping firefighters with funding";
      const goal = ethers.parseEther("5");
      const duration = 1; // 1 day

      await crowdfunding.connect(whitelistAddress).createCampaign(title, description, goal, duration);
      campaignId = 1;

      const contributionAmount = ethers.parseEther("2");
      await crowdfunding.connect(contributor1).contribute(campaignId, { value: contributionAmount });
    });

    it("should allow campaign creator to withdraw funds after the 15-day claim period", async function () {
      await network.provider.send("evm_increaseTime", [16 * 24 * 60 * 60]); // 16 days
      await network.provider.send("evm_mine");

      const initialBalance = await ethers.provider.getBalance(whitelistAddress.address);

      await expect(
        crowdfunding.connect(whitelistAddress).withdrawFunds(campaignId)
      ).to.emit(crowdfunding, "Withdrawn").withArgs(campaignId, ethers.parseEther("2"));

      const finalBalance = await ethers.provider.getBalance(whitelistAddress.address);
      expect(BigInt(finalBalance.toString())).to.be.greaterThan(BigInt(initialBalance.toString()));
    });

    it("should revert if trying to withdraw within the 15-day claim period", async function () {
      await network.provider.send("evm_increaseTime", [60 * 60 * 24]); // 1 day
      await network.provider.send("evm_mine");

      await expect(
        crowdfunding.connect(whitelistAddress).withdrawFunds(campaignId)
      ).to.be.revertedWith("Refund period still open");
    });
  });

  describe("getCampaign", function () {
    it("should return the correct campaign details", async function () {
      const title = "Firefighter Fund";
      const description = "Helping firefighters with funding";
      const goal = ethers.parseEther("5");
      const duration = 1; // 1 day

      // Create a campaign
      await crowdfunding.connect(whitelistAddress).createCampaign(title, description, goal, duration);
      campaignId = 1;

      // Get the latest block timestamp
      const block = await ethers.provider.getBlock("latest");
      const currentTime = block.timestamp;

      // Retrieve the campaign details
      const campaign = await crowdfunding.getCampaign(campaignId);

      // Validate the campaign details
      expect(campaign.id).to.equal(1);
      expect(campaign.creator).to.equal(whitelistAddress.address);
      expect(campaign.title).to.equal(title);
      expect(campaign.description).to.equal(description);
      expect(campaign.goal.toString()).to.equal(goal.toString());
      expect(campaign.deadline.toString()).to.equal((currentTime + duration * 86400).toString());
    });
  });

  describe("getFundsRaised", function () {
    it("should return the correct funds raised for a campaign", async function () {
      const title = "Firefighter Fund";
      const description = "Helping firefighters with funding";
      const goal = ethers.parseEther("5");
      const duration = 1; // 1 day

      // Create a campaign
      await crowdfunding.connect(whitelistAddress).createCampaign(title, description, goal, duration);
      campaignId = 1;

      // Contribute to the campaign
      const contributionAmount = ethers.parseEther("2");
      await crowdfunding.connect(contributor1).contribute(campaignId, { value: contributionAmount });

      // Get the funds raised
      const fundsRaised = await crowdfunding.getFundsRaised(campaignId);
      expect(fundsRaised.toString()).to.equal(contributionAmount.toString());
    });
  });

  describe("getCampaigns", function () {
    it("should return the correct campaign IDs", async function () {
      const title1 = "Firefighter Fund 1";
      const description1 = "Helping firefighters with funding 1";
      const goal1 = ethers.parseEther("5");
      const duration1 = 1; // 1 day

      const title2 = "Firefighter Fund 2";
      const description2 = "Helping firefighters with funding 2";
      const goal2 = ethers.parseEther("10");
      const duration2 = 2; // 2 days

      // Create two campaigns
      await crowdfunding.connect(whitelistAddress).createCampaign(title1, description1, goal1, duration1);
      await crowdfunding.connect(whitelistAddress).createCampaign(title2, description2, goal2, duration2);

      // Get the campaign IDs
      const campaignIds = await crowdfunding.getCampaigns();
      expect(campaignIds.length).to.equal(2);
      expect(campaignIds[0].toString()).to.equal("1");
      expect(campaignIds[1].toString()).to.equal("2");
    });
  });

  describe("NFTMinted event", function () {
    it("should emit NFTMinted event when NFT is minted", async function () {
      const title = "Firefighter Fund";
      const description = "Helping firefighters with funding";
      const goal = ethers.parseEther("5");
      const duration = 1; // 1 day

      // Create a campaign
      await crowdfunding.connect(whitelistAddress).createCampaign(title, description, goal, duration);
      campaignId = 1;

      // Contribute to the campaign
      const contributionAmount = ethers.parseEther("2");
      await expect(
        crowdfunding.connect(contributor1).contribute(campaignId, { value: contributionAmount })
      ).to.emit(crowdfunding, "NFTMinted").withArgs(contributor1.address, 0);
    });
  });
});
