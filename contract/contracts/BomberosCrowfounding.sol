// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract FirefighterCrowdfunding is Ownable, ERC721, ReentrancyGuard {
    struct Campaign {
        address payable creator;
        string title;
        string description;
        uint256 goal;
        uint256 deadline;
        uint256 claimDeadline; // Nuevo parámetro para el plazo de 15 días
        uint256 fundsRaised;
        bool withdrawn;
        string imageURL;
    }

    mapping(uint256 => Campaign) public campaigns;
    uint256 public campaignCount;
    
    mapping(uint256 => mapping(address => uint256)) public contributions;
    mapping(address => bool) public whitelist;
    mapping(uint256 => mapping(address => bool)) public nftClaimed;

    uint256 public nftThreshold = 1 ether; // Monto mínimo para recibir NFT
    uint256 private nextTokenId;
    
    event CampaignCreated(uint256 campaignId, address creator, string title, uint256 goal, uint256 deadline);
    event Funded(uint256 campaignId, address contributor, uint256 amount);
    event Withdrawn(uint256 campaignId, uint256 amount);
    event Whitelisted(address account, bool status);
    event NFTMinted(address recipient, uint256 tokenId);
    event NFTThresholdUpdated(uint256 newThreshold);
    
    modifier onlyWhitelisted() {
        require(whitelist[msg.sender], "Not authorized to create campaigns");
        _;
    }
    
    constructor() ERC721("FirefighterNFT", "FFNFT") Ownable(msg.sender) {}
    
    function setWhitelist(address _account, bool _status) public onlyOwner {
        whitelist[_account] = _status;
        emit Whitelisted(_account, _status);
    }

    function setNFTThreshold(uint256 _newThreshold) public onlyOwner {
        nftThreshold = _newThreshold;
        emit NFTThresholdUpdated(_newThreshold);
    }
    
    function createCampaign(string memory _title, string memory _description, uint256 _goal, uint256 _duration) public onlyWhitelisted {
        require(_goal > 0, "Goal must be greater than zero");
        require(_duration > 0, "Duration must be greater than zero");
        
        campaignCount++;
        uint256 campaignDeadline = block.timestamp + _duration;
        campaigns[campaignCount] = Campaign(
            payable(msg.sender),
            _title,
            _description,
            _goal,
            campaignDeadline,
            campaignDeadline + 15 days, // Establecemos el plazo de 15 días
            0,
            false
        );
        
        emit CampaignCreated(campaignCount, msg.sender, _title, _goal, _duration);
    }
    
    function contribute(uint256 _campaignId) public payable nonReentrant{
        require(_campaignId > 0 && _campaignId <= campaignCount, "Campaign does not exist");
        require(msg.value > 0, "Contribution must be greater than zero");
        require(block.timestamp < campaigns[_campaignId].deadline, "Campaign has ended");
        require(!campaigns[_campaignId].withdrawn, "Funds already withdrawn");

        
        campaigns[_campaignId].fundsRaised += msg.value;
        contributions[_campaignId][msg.sender] += msg.value;
        
        // Mintear NFT si supera el umbral
        if (contributions[_campaignId][msg.sender] > nftThreshold && !nftClaimed[_campaignId][msg.sender]) {
            _mintNFT(msg.sender);
            nftClaimed[_campaignId][msg.sender] = true;
        }

        
        emit Funded(_campaignId, msg.sender, msg.value);
    }
    
    function withdrawFunds(uint256 _campaignId) public nonReentrant {
        require(_campaignId > 0 && _campaignId <= campaignCount, "Campaign does not exist");

        Campaign storage campaign = campaigns[_campaignId];
        require(msg.sender == campaign.creator, "Only the creator can withdraw funds");
        require(block.timestamp >= campaign.deadline, "Cannot withdraw before deadline");
        require(!campaign.withdrawn, "Funds already withdrawn");

        // Permitir retiro después del período de reembolso
        require(block.timestamp > campaign.claimDeadline || campaign.fundsRaised >= campaign.goal, "Refund period still open");

        uint256 amount = campaign.fundsRaised;
        campaign.withdrawn = true;
        
        (bool success, ) = campaign.creator.call{value: amount}("");
        require(success, "Transfer failed");
        
        emit Withdrawn(_campaignId, amount);
    }
    
    function _mintNFT(address recipient) internal {
        uint256 tokenId = nextTokenId;
        _safeMint(recipient, tokenId);
        nextTokenId++;
        emit NFTMinted(recipient, tokenId);
    }

    function refund(uint256 _campaignId) public nonReentrant {
        require(_campaignId > 0 && _campaignId <= campaignCount, "Campaign does not exist");
        Campaign storage campaign = campaigns[_campaignId];
        require(block.timestamp >= campaign.deadline, "Campaign is still active");
        require(block.timestamp <= campaign.claimDeadline, "Refund period has expired"); // Solo durante los 15 días después del deadline
        require(campaign.fundsRaised < campaign.goal, "Campaign was successful, no refunds");

        uint256 amount = contributions[_campaignId][msg.sender];
        require(amount > 0, "No funds to refund");

        contributions[_campaignId][msg.sender] = 0;

        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "Refund failed");
    }
 
    function getFundsRaised(uint256 _campaignId) public view returns (uint256) {
        return campaigns[_campaignId].fundsRaised;
    }

    function getCampaigns() public view returns (uint256[] memory) {
        uint256[] memory campaignIds = new uint256[](campaignCount);
        for (uint256 i = 1; i <= campaignCount; i++) {
            campaignIds[i - 1] = i;
        }
        return campaignIds;
    }

    function getCampaign(uint256 _campaignId) public view returns (
        address creator, 
        string memory title, 
        string memory description, 
        uint256 goal, 
        uint256 deadline, 
        uint256 fundsRaised, 
        bool withdrawn
    ) {
        Campaign storage campaign = campaigns[_campaignId];
        return (
            campaign.creator,
            campaign.title,
            campaign.description,
            campaign.goal,
            campaign.deadline,
            campaign.fundsRaised,
            campaign.withdrawn
        );
    }

}
