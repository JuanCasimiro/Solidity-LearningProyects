FirefighterCrowdfunding Contract API Documentation
The FirefighterCrowdfunding contract is a Solidity-based smart contract designed to facilitate crowdfunding campaigns for firefighters. It includes features such as campaign creation, contributions, refunds, fund withdrawals, and NFT rewards for contributors who meet a specified threshold. Below is the detailed API documentation for the methods available in the contract.

Structs
Campaign
Represents the details of a crowdfunding campaign:

creator: The address of the campaign creator.
title: The title of the campaign.
description: A description of the campaign.
goal: The funding goal of the campaign (in wei).
deadline: The timestamp when the campaign ends.
claimDeadline: The timestamp after which funds can be withdrawn (15 days after the deadline).
fundsRaised: The total amount of funds raised so far.
withdrawn: A boolean indicating whether the funds have been withdrawn.
Mappings
campaigns : Maps campaign IDs to their respective Campaign structs.
contributions : Tracks contributions made by users for each campaign (campaignId => contributorAddress => contributionAmount).
whitelist : Tracks whether an address is authorized to create campaigns (address => bool).
nftClaimed : Tracks whether a user has already claimed an NFT for a specific campaign (campaignId => contributorAddress => bool).
State Variables
campaignCount : Tracks the total number of campaigns created.
nftThreshold : The minimum contribution required to receive an NFT (default: 1 ether).
nextTokenId : Tracks the next token ID for minting NFTs.
Events
CampaignCreated(uint256 campaignId, address creator, string title, uint256 goal, uint256 deadline)
Emitted when a new campaign is created.
Funded(uint256 campaignId, address contributor, uint256 amount)
Emitted when a user contributes to a campaign.
Withdrawn(uint256 campaignId, uint256 amount)
Emitted when the campaign creator withdraws funds.
Whitelisted(address account, bool status)
Emitted when an address is added or removed from the whitelist.
NFTMinted(address recipient, uint256 tokenId)
Emitted when an NFT is minted for a contributor.
NFTThresholdUpdated(uint256 newThreshold)
Emitted when the NFT threshold is updated.
Modifiers
onlyWhitelisted
Ensures that only whitelisted addresses can create campaigns.
nonReentrant
Prevents reentrancy attacks in functions like contribute, withdrawFunds, and refund.
Methods
1. Whitelist Management
setWhitelist(address _account, bool _status)
Adds or removes an address from the whitelist.
Access: Only the contract owner.
Parameters:
_account: The address to add/remove from the whitelist.
_status: Whether to add (true) or remove (false) the address.
Emits: Whitelisted(_account, _status)
2. NFT Threshold Management
setNFTThreshold(uint256 _newThreshold)
Updates the minimum contribution required to receive an NFT.
Access: Only the contract owner.
Parameters:
_newThreshold: The new threshold value (in wei).
Emits: NFTThresholdUpdated(_newThreshold)
3. Campaign Creation
createCampaign(string memory _title, string memory _description, uint256 _goal, uint256 _duration)
Creates a new crowdfunding campaign.
Access: Only whitelisted addresses.
Parameters:
_title: The title of the campaign.
_description: A description of the campaign.
_goal: The funding goal (in wei).
_duration: The duration of the campaign (in seconds).
Requirements:
_goal > 0
_duration > 0
Emits: CampaignCreated(campaignId, msg.sender, _title, _goal, _duration)
4. Contributions
contribute(uint256 _campaignId)
Allows users to contribute to a campaign.
Access: Public.
Parameters:
_campaignId: The ID of the campaign to contribute to.
Value: The contribution amount (in wei).
Requirements:
_campaignId must exist.
Contribution must be greater than zero.
The campaign must not have ended.
Funds must not have been withdrawn.
Behavior:
If the user's total contribution exceeds nftThreshold, an NFT is minted.
Emits: Funded(_campaignId, msg.sender, msg.value) and optionally NFTMinted(msg.sender, tokenId).
5. Fund Withdrawal
withdrawFunds(uint256 _campaignId)
Allows the campaign creator to withdraw funds after the campaign ends.
Access: Only the campaign creator.
Parameters:
_campaignId: The ID of the campaign.
Requirements:
The campaign must have ended.
The refund period must have expired (15 days after the deadline) or the goal must have been met.
Funds must not have been withdrawn already.
Emits: Withdrawn(_campaignId, amount)
6. Refunds
refund(uint256 _campaignId)
Allows contributors to request refunds if the campaign fails.
Access: Public.
Parameters:
_campaignId: The ID of the campaign.
Requirements:
The campaign must have ended.
The refund period must not have expired (15 days after the deadline).
The campaign must have failed to meet its goal.
The contributor must have contributed funds.
Behavior: Refunds the contributor's entire contribution.
7. Campaign Details
getCampaign(uint256 _campaignId)
Retrieves the details of a specific campaign.
Access: Public.
Parameters:
_campaignId: The ID of the campaign.
Returns:
creator: The address of the campaign creator.
title: The title of the campaign.
description: A description of the campaign.
goal: The funding goal (in wei).
deadline: The campaign deadline timestamp.
fundsRaised: The total funds raised so far.
withdrawn: Whether the funds have been withdrawn.
8. Funds Raised
getFundsRaised(uint256 _campaignId)
Retrieves the total funds raised for a specific campaign.
Access: Public.
Parameters:
_campaignId: The ID of the campaign.
Returns: The total funds raised (in wei).
9. Internal Functions
_mintNFT(address recipient)
Mints an NFT for a contributor.
Access: Internal.
Parameters:
recipient: The address of the recipient.
Behavior: Mints an NFT with a unique tokenId.
Emits: NFTMinted(recipient, tokenId)