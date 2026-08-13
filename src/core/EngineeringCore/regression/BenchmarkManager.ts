import { ProjectFile } from '../../../types';

export type BenchmarkEcosystemType = 'Ethereum/EVM' | 'Solana' | 'Aptos' | 'Sui';

export interface BenchmarkDefinition {
  id: string;
  name: string;
  ecosystem: BenchmarkEcosystemType;
  category: string;
  description: string;
  targetLanguage: 'solidity' | 'rust' | 'move';
  framework: 'Foundry/Hardhat' | 'Anchor' | 'Aptos CLI' | 'Sui CLI';
  basePrompt: string;
  sampleCode: ProjectFile[];
  expectedArtifacts: string[];
  complexity: 'Simple' | 'Intermediate' | 'Complex' | 'Enterprise';
  mode?: 'LIVE_GENERATION' | 'STATIC_FIXTURE';
}

export class BenchmarkManager {
  private static benchmarks: BenchmarkDefinition[] = [
    // --- ETHEREUM / EVM BENCHMARKS ---
    {
      id: 'ETH-ERC20',
      name: 'ERC20 Token Benchmark',
      ecosystem: 'Ethereum/EVM',
      category: 'ERC20',
      description: 'Standard ERC20 Token with Mint, Burn, Pause, and Role-Based Access Control.',
      targetLanguage: 'solidity',
      framework: 'Foundry/Hardhat',
      complexity: 'Simple',
      basePrompt: 'Create an ERC20 token contract named GovernanceToken with symbol GOV, minting capabilities, burning, pausable emergency controls, and access control.',
      sampleCode: [
        {
          path: 'contracts/GovernanceToken.sol',
          language: 'solidity',
          content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract GovernanceToken is ERC20, Ownable, ReentrancyGuard {
    error InvalidAddress();
    event TokenMinted(address indexed to, uint256 amount);
    bool public paused;
    constructor() ERC20("GovToken", "GOV") Ownable(msg.sender) {}
    function pause() external onlyOwner { paused = true; }
    function unpause() external onlyOwner { paused = false; }
    function mint(address to, uint256 amount) external onlyOwner nonReentrant {
        if (to == address(0)) revert InvalidAddress();
        _mint(to, amount);
        emit TokenMinted(to, amount);
    }
}`
        },
        {
          path: 'test/GovernanceToken.t.sol',
          language: 'solidity',
          content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "forge-std/Test.sol";
import "../contracts/GovernanceToken.sol";

contract GovernanceTokenTest is Test {
    GovernanceToken token;
    address owner = address(0x1);
    function setUp() public {
        vm.prank(owner);
        token = new GovernanceToken();
    }
    function testMint() public {
        vm.prank(owner);
        token.mint(address(0x2), 1000);
        assertEq(token.balanceOf(address(0x2)), 1000);
    }
}`
        }
      ],
      expectedArtifacts: ['contracts/GovernanceToken.sol', 'test/GovernanceToken.t.sol']
    },
    {
      id: 'ETH-ERC721',
      name: 'ERC721 NFT Benchmark',
      ecosystem: 'Ethereum/EVM',
      category: 'ERC721',
      description: 'ERC721 NFT Collection with Enumerable, URI Storage, Whitelist, and Royalty support.',
      targetLanguage: 'solidity',
      framework: 'Foundry/Hardhat',
      complexity: 'Intermediate',
      basePrompt: 'Build an ERC721 NFT collection with whitelist minting, max supply caps, URI metadata management, and royalities.',
      sampleCode: [
        {
          path: 'contracts/ArtNFT.sol',
          language: 'solidity',
          content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract ArtNFT is ERC721Enumerable, Ownable {
    uint256 public constant MAX_SUPPLY = 10000;
    uint256 public nextTokenId;
    constructor() ERC721("ArtNFT", "ANFT") Ownable(msg.sender) {}
    function mint(address to) external onlyOwner {
        require(nextTokenId < MAX_SUPPLY, "Max supply reached");
        _safeMint(to, nextTokenId);
        nextTokenId++;
    }
}`
        },
        {
          path: 'test/ArtNFT.t.sol',
          language: 'solidity',
          content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "forge-std/Test.sol";
import "../contracts/ArtNFT.sol";

contract ArtNFTTest is Test {
    ArtNFT nft;
    function setUp() public { nft = new ArtNFT(); }
    function testMint() public { nft.mint(address(0x1)); assertEq(nft.ownerOf(0), address(0x1)); }
}`
        }
      ],
      expectedArtifacts: ['contracts/ArtNFT.sol', 'test/ArtNFT.t.sol']
    },
    {
      id: 'ETH-ERC1155',
      name: 'ERC1155 Multi-Token Benchmark',
      ecosystem: 'Ethereum/EVM',
      category: 'ERC1155',
      description: 'ERC1155 Multi-Token standard for gaming items with batch minting and URI management.',
      targetLanguage: 'solidity',
      framework: 'Foundry/Hardhat',
      complexity: 'Intermediate',
      basePrompt: 'Construct an ERC1155 multi-token contract supporting fungible and non-fungible game items with batch minting and burning.',
      sampleCode: [
        {
          path: 'contracts/GameItems.sol',
          language: 'solidity',
          content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract GameItems is ERC1155, Ownable {
    uint256 public constant SWORD = 0;
    uint256 public constant SHIELD = 1;
    constructor() ERC1155("https://game.example/api/item/{id}.json") Ownable(msg.sender) {
        _mint(msg.sender, SWORD, 1000, "");
        _mint(msg.sender, SHIELD, 500, "");
    }
}`
        },
        {
          path: 'test/GameItems.t.sol',
          language: 'solidity',
          content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "forge-std/Test.sol";
import "../contracts/GameItems.sol";

contract GameItemsTest is Test {
    GameItems items;
    function setUp() public { items = new GameItems(); }
    function testBalances() public { assertEq(items.balanceOf(address(this), 0), 1000); }
}`
        }
      ],
      expectedArtifacts: ['contracts/GameItems.sol', 'test/GameItems.t.sol']
    },
    {
      id: 'ETH-MARKETPLACE',
      name: 'NFT Marketplace Benchmark',
      ecosystem: 'Ethereum/EVM',
      category: 'Marketplace',
      description: 'Decentralized Marketplace for ERC721 and ERC1155 listings, auctions, and platform fees.',
      targetLanguage: 'solidity',
      framework: 'Foundry/Hardhat',
      complexity: 'Complex',
      basePrompt: 'Build an NFT Marketplace contract supporting fixed-price listings, timed auctions, fee distribution, and emergency pause.',
      sampleCode: [
        {
          path: 'contracts/NFTMarketplace.sol',
          language: 'solidity',
          content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract NFTMarketplace is ReentrancyGuard, Ownable {
    struct Listing { address seller; address nftAddress; uint256 tokenId; uint256 price; bool active; }
    mapping(uint256 => Listing) public listings;
    uint256 public listingCount;
    constructor() Ownable(msg.sender) {}
    function createListing(address nftAddress, uint256 tokenId, uint256 price) external nonReentrant {
        require(price > 0, "Price must be > 0");
        listings[listingCount] = Listing(msg.sender, nftAddress, tokenId, price, true);
        listingCount++;
    }
}`
        },
        {
          path: 'test/NFTMarketplace.t.sol',
          language: 'solidity',
          content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "forge-std/Test.sol";
import "../contracts/NFTMarketplace.sol";

contract NFTMarketplaceTest is Test {
    NFTMarketplace market;
    function setUp() public { market = new NFTMarketplace(); }
    function testListing() public { market.createListing(address(0x1), 1, 100); assertEq(market.listingCount(), 1); }
}`
        }
      ],
      expectedArtifacts: ['contracts/NFTMarketplace.sol', 'test/NFTMarketplace.t.sol']
    },
    {
      id: 'ETH-ESCROW',
      name: 'Escrow Benchmark',
      ecosystem: 'Ethereum/EVM',
      category: 'Escrow',
      description: 'Trustless Escrow contract with arbiter dispute resolution and deadline release.',
      targetLanguage: 'solidity',
      framework: 'Foundry/Hardhat',
      complexity: 'Intermediate',
      basePrompt: 'Develop a 3-party escrow contract (Buyer, Seller, Arbiter) with deposit, refund, dispute resolution, and timeout release logic.',
      sampleCode: [
        {
          path: 'contracts/Escrow.sol',
          language: 'solidity',
          content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract Escrow is ReentrancyGuard {
    address public buyer;
    address payable public seller;
    address public arbiter;
    uint256 public amount;
    enum State { AwaitingPayment, AwaitingDelivery, Complete, Disputed, Refunded }
    State public currentState;

    constructor(address payable _seller, address _arbiter) payable {
        buyer = msg.sender;
        seller = _seller;
        arbiter = _arbiter;
        amount = msg.value;
        currentState = State.AwaitingDelivery;
    }

    function confirmDelivery() external nonReentrant {
        require(msg.sender == buyer, "Only buyer");
        require(currentState == State.AwaitingDelivery, "Invalid state");
        currentState = State.Complete;
        seller.transfer(amount);
    }
}`
        },
        {
          path: 'test/Escrow.t.sol',
          language: 'solidity',
          content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "forge-std/Test.sol";
import "../contracts/Escrow.sol";

contract EscrowTest is Test {
    Escrow escrow;
    function setUp() public { escrow = new Escrow{value: 1 ether}(payable(address(0x2)), address(0x3)); }
    function testState() public { assertEq(uint(escrow.currentState()), 1); }
}`
        }
      ],
      expectedArtifacts: ['contracts/Escrow.sol', 'test/Escrow.t.sol']
    },
    {
      id: 'ETH-DAO',
      name: 'DAO Governance Benchmark',
      ecosystem: 'Ethereum/EVM',
      category: 'DAO',
      description: 'On-chain DAO Governance with proposal creation, voting power weighting, and execution.',
      targetLanguage: 'solidity',
      framework: 'Foundry/Hardhat',
      complexity: 'Complex',
      basePrompt: 'Build a DAO governance system allowing token holders to submit proposals, vote with quorum checks, and execute passed proposals.',
      sampleCode: [
        {
          path: 'contracts/DAO.sol',
          language: 'solidity',
          content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "@openzeppelin/contracts/access/Ownable.sol";

contract DAO is Ownable {
    struct Proposal { uint256 id; string description; uint256 votesFor; uint256 votesAgainst; bool executed; }
    mapping(uint256 => Proposal) public proposals;
    uint256 public proposalCount;
    constructor() Ownable(msg.sender) {}
    function createProposal(string calldata desc) external returns (uint256) {
        proposals[proposalCount] = Proposal(proposalCount, desc, 0, 0, false);
        return proposalCount++;
    }
}`
        },
        {
          path: 'test/DAO.t.sol',
          language: 'solidity',
          content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "forge-std/Test.sol";
import "../contracts/DAO.sol";

contract DAOTest is Test {
    DAO dao;
    function setUp() public { dao = new DAO(); }
    function testProposal() public { uint256 id = dao.createProposal("Fund Dev"); assertEq(id, 0); }
}`
        }
      ],
      expectedArtifacts: ['contracts/DAO.sol', 'test/DAO.t.sol']
    },
    {
      id: 'ETH-LOTTERY',
      name: 'Lottery Benchmark',
      ecosystem: 'Ethereum/EVM',
      category: 'Lottery',
      description: 'Provably Fair Lottery using VRF or verifiable block randomness, ticket purchasing, and prize payout.',
      targetLanguage: 'solidity',
      framework: 'Foundry/Hardhat',
      complexity: 'Intermediate',
      basePrompt: 'Create a lottery contract with ticket sales, round timer, winner selection using pseudo or VRF randomness, and prize distribution.',
      sampleCode: [
        {
          path: 'contracts/Lottery.sol',
          language: 'solidity',
          content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "@openzeppelin/contracts/access/Ownable.sol";

contract Lottery is Ownable {
    address[] public players;
    uint256 public ticketPrice = 0.01 ether;
    constructor() Ownable(msg.sender) {}
    function enter() external payable {
        require(msg.value == ticketPrice, "Incorrect ETH amount");
        players.push(msg.sender);
    }
}`
        },
        {
          path: 'test/Lottery.t.sol',
          language: 'solidity',
          content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "forge-std/Test.sol";
import "../contracts/Lottery.sol";

contract LotteryTest is Test {
    Lottery lottery;
    function setUp() public { lottery = new Lottery(); }
    function testEnter() public { lottery.enter{value: 0.01 ether}(); assertEq(lottery.players(0), address(this)); }
}`
        }
      ],
      expectedArtifacts: ['contracts/Lottery.sol', 'test/Lottery.t.sol']
    },
    {
      id: 'ETH-CROWDFUNDING',
      name: 'Crowdfunding Benchmark',
      ecosystem: 'Ethereum/EVM',
      category: 'Crowdfunding',
      description: 'Crowdfunding Platform with funding goals, deadlines, campaign creation, and automated refunds if goal missed.',
      targetLanguage: 'solidity',
      framework: 'Foundry/Hardhat',
      complexity: 'Intermediate',
      basePrompt: 'Implement a crowdfunding platform contract supporting multiple campaigns, goal targets, refund triggers, and creator payouts.',
      sampleCode: [
        {
          path: 'contracts/Crowdfunding.sol',
          language: 'solidity',
          content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract Crowdfunding is ReentrancyGuard {
    struct Campaign { address creator; uint256 goal; uint256 raised; uint256 deadline; bool claimed; }
    mapping(uint256 => Campaign) public campaigns;
    uint256 public campaignCount;

    function createCampaign(uint256 goal, uint256 duration) external returns (uint256) {
        campaigns[campaignCount] = Campaign(msg.sender, goal, 0, block.timestamp + duration, false);
        return campaignCount++;
    }
}`
        },
        {
          path: 'test/Crowdfunding.t.sol',
          language: 'solidity',
          content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "forge-std/Test.sol";
import "../contracts/Crowdfunding.sol";

contract CrowdfundingTest is Test {
    Crowdfunding cf;
    function setUp() public { cf = new Crowdfunding(); }
    function testCreate() public { uint256 id = cf.createCampaign(10 ether, 3600); assertEq(id, 0); }
}`
        }
      ],
      expectedArtifacts: ['contracts/Crowdfunding.sol', 'test/Crowdfunding.t.sol']
    },
    {
      id: 'ETH-STAKING',
      name: 'Staking Benchmark',
      ecosystem: 'Ethereum/EVM',
      category: 'Staking',
      description: 'Token Staking contract with reward rate calculation, lockup periods, and compound rewards.',
      targetLanguage: 'solidity',
      framework: 'Foundry/Hardhat',
      complexity: 'Complex',
      basePrompt: 'Build a staking vault contract that computes APY yield rewards proportionally, supports emergency unstake, and admin reward refills.',
      sampleCode: [
        {
          path: 'contracts/StakingVault.sol',
          language: 'solidity',
          content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract StakingVault is Ownable, ReentrancyGuard {
    IERC20 public stakingToken;
    mapping(address => uint256) public stakedBalance;
    constructor(address _token) Ownable(msg.sender) { stakingToken = IERC20(_token); }
    function stake(uint256 amount) external nonReentrant {
        require(amount > 0, "Cannot stake 0");
        stakedBalance[msg.sender] += amount;
    }
}`
        },
        {
          path: 'test/StakingVault.t.sol',
          language: 'solidity',
          content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "forge-std/Test.sol";
import "../contracts/StakingVault.sol";

contract StakingVaultTest is Test {
    StakingVault vault;
    function setUp() public { vault = new StakingVault(address(0x1)); }
    function testInitial() public { assertEq(address(vault.stakingToken()), address(0x1)); }
}`
        }
      ],
      expectedArtifacts: ['contracts/StakingVault.sol', 'test/StakingVault.t.sol']
    },
    {
      id: 'ETH-VESTING',
      name: 'Vesting Benchmark',
      ecosystem: 'Ethereum/EVM',
      category: 'Vesting',
      description: 'Token Vesting Contract with Cliff, linear vesting schedule, and revocable admin features.',
      targetLanguage: 'solidity',
      framework: 'Foundry/Hardhat',
      complexity: 'Intermediate',
      basePrompt: 'Develop a linear token vesting schedule contract with cliff duration, total vesting duration, and partial claim logic.',
      sampleCode: [
        {
          path: 'contracts/TokenVesting.sol',
          language: 'solidity',
          content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "@openzeppelin/contracts/access/Ownable.sol";

contract TokenVesting is Ownable {
    struct VestingSchedule { address beneficiary; uint256 cliff; uint256 start; uint256 duration; uint256 totalAmount; uint256 released; }
    mapping(bytes32 => VestingSchedule) public schedules;
    constructor() Ownable(msg.sender) {}
}`
        },
        {
          path: 'test/TokenVesting.t.sol',
          language: 'solidity',
          content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "forge-std/Test.sol";
import "../contracts/TokenVesting.sol";

contract TokenVestingTest is Test {
    TokenVesting vesting;
    function setUp() public { vesting = new TokenVesting(); }
    function testOwner() public { assertEq(vesting.owner(), address(this)); }
}`
        }
      ],
      expectedArtifacts: ['contracts/TokenVesting.sol', 'test/TokenVesting.t.sol']
    },
    {
      id: 'ETH-MULTISIG',
      name: 'Multisig Benchmark',
      ecosystem: 'Ethereum/EVM',
      category: 'Multisig',
      description: 'Multi-Signature Wallet requiring M-of-N confirmations before executing arbitrary transactions.',
      targetLanguage: 'solidity',
      framework: 'Foundry/Hardhat',
      complexity: 'Enterprise',
      basePrompt: 'Construct an M-of-N Multi-Signature wallet contract with owner management, transaction proposals, confirmations, and execution.',
      sampleCode: [
        {
          path: 'contracts/MultiSigWallet.sol',
          language: 'solidity',
          content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MultiSigWallet {
    address[] public owners;
    uint256 public numConfirmationsRequired;
    struct Transaction { address to; uint256 value; bytes data; bool executed; uint256 numConfirmations; }
    Transaction[] public transactions;

    constructor(address[] memory _owners, uint256 _numConfirmationsRequired) {
        require(_owners.length > 0, "Owners required");
        owners = _owners;
        numConfirmationsRequired = _numConfirmationsRequired;
    }
}`
        },
        {
          path: 'test/MultiSigWallet.t.sol',
          language: 'solidity',
          content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "forge-std/Test.sol";
import "../contracts/MultiSigWallet.sol";

contract MultiSigWalletTest is Test {
    MultiSigWallet wallet;
    function setUp() public {
        address[] memory owners = new address[](2);
        owners[0] = address(0x1); owners[1] = address(0x2);
        wallet = new MultiSigWallet(owners, 2);
    }
    function testConfirmations() public { assertEq(wallet.numConfirmationsRequired(), 2); }
}`
        }
      ],
      expectedArtifacts: ['contracts/MultiSigWallet.sol', 'test/MultiSigWallet.t.sol']
    },
    {
      id: 'ETH-PAYMENT-SPLITTER',
      name: 'Payment Splitter Benchmark',
      ecosystem: 'Ethereum/EVM',
      category: 'Payment Splitter',
      description: 'Splits incoming ETH and ERC20 payments among payees according to share proportions.',
      targetLanguage: 'solidity',
      framework: 'Foundry/Hardhat',
      complexity: 'Simple',
      basePrompt: 'Build a Payment Splitter contract that distributes revenue proportionately among multiple team members.',
      sampleCode: [
        {
          path: 'contracts/PaymentSplitter.sol',
          language: 'solidity',
          content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "@openzeppelin/contracts/finance/PaymentSplitter.sol";

contract TeamSplitter is PaymentSplitter {
    constructor(address[] memory payees, uint256[] memory shares) PaymentSplitter(payees, shares) {}
}`
        },
        {
          path: 'test/PaymentSplitter.t.sol',
          language: 'solidity',
          content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "forge-std/Test.sol";
import "../contracts/PaymentSplitter.sol";

contract PaymentSplitterTest is Test {
    TeamSplitter splitter;
    function setUp() public {
        address[] memory payees = new address[](2); payees[0] = address(0x1); payees[1] = address(0x2);
        uint256[] memory shares = new uint256[](2); shares[0] = 50; shares[1] = 50;
        splitter = new TeamSplitter(payees, shares);
    }
    function testShares() public { assertEq(splitter.totalShares(), 100); }
}`
        }
      ],
      expectedArtifacts: ['contracts/PaymentSplitter.sol', 'test/PaymentSplitter.t.sol']
    },
    {
      id: 'ETH-UPGRADEABLE-PROXY',
      name: 'Upgradeable Proxy Benchmark',
      ecosystem: 'Ethereum/EVM',
      category: 'Upgradeable Proxy',
      description: 'UUPS / Transparent Upgradeable Proxy architecture with proxy admin and state storage layout protection.',
      targetLanguage: 'solidity',
      framework: 'Foundry/Hardhat',
      complexity: 'Enterprise',
      basePrompt: 'Implement a UUPS Upgradeable proxy contract system with initialized state, upgrade authorization checks, and implementation storage safety.',
      sampleCode: [
        {
          path: 'contracts/UpgradeableToken.sol',
          language: 'solidity',
          content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract UpgradeableToken is UUPSUpgradeable, OwnableUpgradeable {
    uint256 public version;
    function initialize() external initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        version = 1;
    }
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}`
        },
        {
          path: 'test/UpgradeableToken.t.sol',
          language: 'solidity',
          content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "forge-std/Test.sol";
import "../contracts/UpgradeableToken.sol";

contract UpgradeableTokenTest is Test {
    UpgradeableToken token;
    function setUp() public { token = new UpgradeableToken(); token.initialize(); }
    function testVersion() public { assertEq(token.version(), 1); }
}`
        }
      ],
      expectedArtifacts: ['contracts/UpgradeableToken.sol', 'test/UpgradeableToken.t.sol']
    },
    {
      id: 'ETH-GOVERNOR',
      name: 'Governor Benchmark',
      ecosystem: 'Ethereum/EVM',
      category: 'Governor',
      description: 'OpenZeppelin Governor framework compatible governance contract with voting delay and quorum fraction.',
      targetLanguage: 'solidity',
      framework: 'Foundry/Hardhat',
      complexity: 'Enterprise',
      basePrompt: 'Build an OpenZeppelin Governor modular contract integrated with governance tokens and timelock controller execution.',
      sampleCode: [
        {
          path: 'contracts/CoreGovernor.sol',
          language: 'solidity',
          content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract CoreGovernor {
    string public name = "CoreGovernor";
    uint256 public votingDelay = 1;
    uint256 public votingPeriod = 50400;
}`
        },
        {
          path: 'test/CoreGovernor.t.sol',
          language: 'solidity',
          content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "forge-std/Test.sol";
import "../contracts/CoreGovernor.sol";

contract CoreGovernorTest is Test {
    CoreGovernor gov;
    function setUp() public { gov = new CoreGovernor(); }
    function testName() public { assertEq(gov.name(), "CoreGovernor"); }
}`
        }
      ],
      expectedArtifacts: ['contracts/CoreGovernor.sol', 'test/CoreGovernor.t.sol']
    },
    {
      id: 'ETH-TIMELOCK',
      name: 'Timelock Benchmark',
      ecosystem: 'Ethereum/EVM',
      category: 'Timelock',
      description: 'Timelock Controller enforcing mandatory execution delay for governance proposals.',
      targetLanguage: 'solidity',
      framework: 'Foundry/Hardhat',
      complexity: 'Enterprise',
      basePrompt: 'Develop a Timelock Controller contract that queues transactions for a mandatory minimum delay before execution.',
      sampleCode: [
        {
          path: 'contracts/TimelockController.sol',
          language: 'solidity',
          content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract TimelockController {
    uint256 public minDelay;
    constructor(uint256 _minDelay) { minDelay = _minDelay; }
}`
        },
        {
          path: 'test/TimelockController.t.sol',
          language: 'solidity',
          content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "forge-std/Test.sol";
import "../contracts/TimelockController.sol";

contract TimelockControllerTest is Test {
    TimelockController timelock;
    function setUp() public { timelock = new TimelockController(2 days); }
    function testMinDelay() public { assertEq(timelock.minDelay(), 2 days); }
}`
        }
      ],
      expectedArtifacts: ['contracts/TimelockController.sol', 'test/TimelockController.t.sol']
    },

    // --- SOLANA BENCHMARKS ---
    {
      id: 'SOL-SPL-TOKEN',
      name: 'SPL Token Benchmark',
      ecosystem: 'Solana',
      category: 'SPL Token',
      description: 'Solana Rust Anchor SPL Token program with mint, transfer, and burn instructions.',
      targetLanguage: 'rust',
      framework: 'Anchor',
      complexity: 'Simple',
      basePrompt: 'Build a Solana Anchor program that creates an SPL Token mint, handles token minting, transfers, and token burning.',
      sampleCode: [
        {
          path: 'programs/spl_token_vault/src/lib.rs',
          language: 'rust',
          content: `use anchor_lang::prelude::*;
declare_id!("Token11111111111111111111111111111111111111");

#[program]
pub mod spl_token_vault {
    use super::*;
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("SPL Token Vault initialized");
        Ok(())
    }
}
#[derive(Accounts)]
pub struct Initialize {}`
        },
        {
          path: 'tests/spl_token_vault.ts',
          language: 'typescript',
          content: `import * as anchor from "@coral-xyz/anchor";
import { expect } from "chai";

describe("spl_token_vault", () => {
  it("Initializes successfully", async () => {
    expect(true).to.be.true;
  });
});`
        }
      ],
      expectedArtifacts: ['programs/spl_token_vault/src/lib.rs', 'tests/spl_token_vault.ts']
    },
    {
      id: 'SOL-ANCHOR-ESCROW',
      name: 'Anchor Escrow Benchmark',
      ecosystem: 'Solana',
      category: 'Anchor Escrow',
      description: 'Anchor Escrow program for trustless SPL token exchange using Program Derived Addresses (PDAs).',
      targetLanguage: 'rust',
      framework: 'Anchor',
      complexity: 'Complex',
      basePrompt: 'Develop a Solana Anchor Escrow program utilizing PDAs to securely lock tokens and swap them atomically.',
      sampleCode: [
        {
          path: 'programs/anchor_escrow/src/lib.rs',
          language: 'rust',
          content: `use anchor_lang::prelude::*;
declare_id!("Escrow1111111111111111111111111111111111111");

#[program]
pub mod anchor_escrow {
    use super::*;
    pub fn make(ctx: Context<Make>, seed: u64, amount: u64) -> Result<()> {
        msg!("Escrow offer created");
        Ok(())
    }
}
#[derive(Accounts)]
pub struct Make {}`
        },
        {
          path: 'tests/anchor_escrow.ts',
          language: 'typescript',
          content: `import * as anchor from "@coral-xyz/anchor";
import { expect } from "chai";

describe("anchor_escrow", () => {
  it("Executes trade offer", async () => { expect(true).to.be.true; });
});`
        }
      ],
      expectedArtifacts: ['programs/anchor_escrow/src/lib.rs', 'tests/anchor_escrow.ts']
    },
    {
      id: 'SOL-NFT-PROGRAM',
      name: 'NFT Program Benchmark',
      ecosystem: 'Solana',
      category: 'NFT Program',
      description: 'Solana Metaplex-compatible NFT Program for digital collectible minting.',
      targetLanguage: 'rust',
      framework: 'Anchor',
      complexity: 'Intermediate',
      basePrompt: 'Construct a Solana Metaplex Anchor NFT minting program with metadata account initialization and royalty enforcement.',
      sampleCode: [
        {
          path: 'programs/nft_minter/src/lib.rs',
          language: 'rust',
          content: `use anchor_lang::prelude::*;
declare_id!("NFTMinter1111111111111111111111111111111111");

#[program]
pub mod nft_minter {
    use super::*;
    pub fn mint_nft(ctx: Context<MintNFT>, name: String, symbol: String, uri: String) -> Result<()> {
        msg!("Minted NFT: {}", name);
        Ok(())
    }
}
#[derive(Accounts)]
pub struct MintNFT {}`
        },
        {
          path: 'tests/nft_minter.ts',
          language: 'typescript',
          content: `import { expect } from "chai";
describe("nft_minter", () => {
  it("Mints Metaplex NFT", async () => { expect(true).to.be.true; });
});`
        }
      ],
      expectedArtifacts: ['programs/nft_minter/src/lib.rs', 'tests/nft_minter.ts']
    },
    {
      id: 'SOL-MARKETPLACE',
      name: 'Solana Marketplace Benchmark',
      ecosystem: 'Solana',
      category: 'Marketplace',
      description: 'Solana Anchor Marketplace for NFT listings, buy, and delist.',
      targetLanguage: 'rust',
      framework: 'Anchor',
      complexity: 'Complex',
      basePrompt: 'Build a Solana Anchor Marketplace program supporting NFT listing, purchasing, and fee vaults.',
      sampleCode: [
        {
          path: 'programs/sol_marketplace/src/lib.rs',
          language: 'rust',
          content: `use anchor_lang::prelude::*;
declare_id!("Market111111111111111111111111111111111111");

#[program]
pub mod sol_marketplace {
    use super::*;
    pub fn list(ctx: Context<List>, price: u64) -> Result<()> {
        msg!("Listed for {}", price);
        Ok(())
    }
}
#[derive(Accounts)]
pub struct List {}`
        },
        {
          path: 'tests/sol_marketplace.ts',
          language: 'typescript',
          content: `import { expect } from "chai";
describe("sol_marketplace", () => {
  it("Lists NFT", async () => { expect(true).to.be.true; });
});`
        }
      ],
      expectedArtifacts: ['programs/sol_marketplace/src/lib.rs', 'tests/sol_marketplace.ts']
    },
    {
      id: 'SOL-STAKING',
      name: 'Solana Staking Benchmark',
      ecosystem: 'Solana',
      category: 'Staking',
      description: 'Solana Anchor Staking program for yield generation.',
      targetLanguage: 'rust',
      framework: 'Anchor',
      complexity: 'Complex',
      basePrompt: 'Develop a Solana Anchor Staking program that accepts token deposits and computes interest yield.',
      sampleCode: [
        {
          path: 'programs/sol_staking/src/lib.rs',
          language: 'rust',
          content: `use anchor_lang::prelude::*;
declare_id!("Stake1111111111111111111111111111111111111");

#[program]
pub mod sol_staking {
    use super::*;
    pub fn stake(ctx: Context<Stake>, amount: u64) -> Result<()> {
        msg!("Staked amount: {}", amount);
        Ok(())
    }
}
#[derive(Accounts)]
pub struct Stake {}`
        },
        {
          path: 'tests/sol_staking.ts',
          language: 'typescript',
          content: `import { expect } from "chai";
describe("sol_staking", () => {
  it("Stakes tokens", async () => { expect(true).to.be.true; });
});`
        }
      ],
      expectedArtifacts: ['programs/sol_staking/src/lib.rs', 'tests/sol_staking.ts']
    },

    // --- APTOS BENCHMARKS ---
    {
      id: 'APT-COIN',
      name: 'Aptos Coin Benchmark',
      ecosystem: 'Aptos',
      category: 'Coin',
      description: 'Aptos Move Coin standard module with mint, burn, and initialize capability.',
      targetLanguage: 'move',
      framework: 'Aptos CLI',
      complexity: 'Simple',
      basePrompt: 'Write an Aptos Move coin module defining custom currency with minting capabilities.',
      sampleCode: [
        {
          path: 'sources/governance_coin.move',
          language: 'move',
          content: `module 0x123::governance_coin {
    use aptos_framework::coin;
    use std::string;

    struct GovCoin {}

    public entry fun init_module(account: &signer) {
        let (burn_cap, freeze_cap, mint_cap) = coin::initialize<GovCoin>(
            account,
            string::utf8(b"GovCoin"),
            string::utf8(b"GOV"),
            8,
            true
        );
        coin::destroy_burn_cap(burn_cap);
        coin::destroy_freeze_cap(freeze_cap);
        coin::destroy_mint_cap(mint_cap);
    }
}`
        },
        {
          path: 'tests/governance_coin_tests.move',
          language: 'move',
          content: `#[test_only]
module 0x123::governance_coin_tests {
    #[test]
    fun test_init() { assert!(true, 0); }
}`
        }
      ],
      expectedArtifacts: ['sources/governance_coin.move', 'tests/governance_coin_tests.move']
    },
    {
      id: 'APT-MARKETPLACE',
      name: 'Aptos Marketplace Benchmark',
      ecosystem: 'Aptos',
      category: 'Marketplace',
      description: 'Aptos Move NFT Marketplace module for listing and purchasing Digital Assets.',
      targetLanguage: 'move',
      framework: 'Aptos CLI',
      complexity: 'Complex',
      basePrompt: 'Build an Aptos Move digital asset marketplace supporting listing, buying, and delisting digital tokens.',
      sampleCode: [
        {
          path: 'sources/nft_marketplace.move',
          language: 'move',
          content: `module 0x123::nft_marketplace {
    use std::signer;
    public entry fun list_token(account: &signer, price: u64) {
        let _seller = signer::address_of(account);
    }
}`
        },
        {
          path: 'tests/nft_marketplace_tests.move',
          language: 'move',
          content: `#[test_only]
module 0x123::nft_marketplace_tests {
    #[test]
    fun test_marketplace() { assert!(true, 0); }
}`
        }
      ],
      expectedArtifacts: ['sources/nft_marketplace.move', 'tests/nft_marketplace_tests.move']
    },
    {
      id: 'APT-ESCROW',
      name: 'Aptos Escrow Benchmark',
      ecosystem: 'Aptos',
      category: 'Escrow',
      description: 'Aptos Move Escrow module for secure token swaps.',
      targetLanguage: 'move',
      framework: 'Aptos CLI',
      complexity: 'Intermediate',
      basePrompt: 'Construct an Aptos Move Escrow module allowing two parties to swap tokens safely.',
      sampleCode: [
        {
          path: 'sources/token_escrow.move',
          language: 'move',
          content: `module 0x123::token_escrow {
    public entry fun create_escrow(account: &signer, amount: u64) {}
}`
        },
        {
          path: 'tests/token_escrow_tests.move',
          language: 'move',
          content: `#[test_only]
module 0x123::token_escrow_tests {
    #[test]
    fun test_escrow() { assert!(true, 0); }
}`
        }
      ],
      expectedArtifacts: ['sources/token_escrow.move', 'tests/token_escrow_tests.move']
    },
    {
      id: 'APT-DAO',
      name: 'Aptos DAO Benchmark',
      ecosystem: 'Aptos',
      category: 'DAO',
      description: 'Aptos Move DAO governance module for voting on proposals.',
      targetLanguage: 'move',
      framework: 'Aptos CLI',
      complexity: 'Complex',
      basePrompt: 'Develop an Aptos Move DAO governance framework enabling on-chain voting.',
      sampleCode: [
        {
          path: 'sources/dao_governance.move',
          language: 'move',
          content: `module 0x123::dao_governance {
    public entry fun create_proposal(account: &signer) {}
}`
        },
        {
          path: 'tests/dao_governance_tests.move',
          language: 'move',
          content: `#[test_only]
module 0x123::dao_governance_tests {
    #[test]
    fun test_dao() { assert!(true, 0); }
}`
        }
      ],
      expectedArtifacts: ['sources/dao_governance.move', 'tests/dao_governance_tests.move']
    },

    // --- SUI BENCHMARKS ---
    {
      id: 'SUI-COIN',
      name: 'Sui Coin Benchmark',
      ecosystem: 'Sui',
      category: 'Coin',
      description: 'Sui Move Coin module defining custom token object with TreasuryCap.',
      targetLanguage: 'move',
      framework: 'Sui CLI',
      complexity: 'Simple',
      basePrompt: 'Write a Sui Move Coin module defining a token using TreasuryCap and object ownership model.',
      sampleCode: [
        {
          path: 'sources/sui_token.move',
          language: 'move',
          content: `module sui_token::my_coin {
    use sui::coin;
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};

    struct MY_COIN has drop {}

    fun init(witness: MY_COIN, ctx: &mut TxContext) {
        let (treasury, metadata) = coin::create_currency(witness, 6, b"MYC", b"My Coin", b"", option::none(), ctx);
        transfer::public_freeze_object(metadata);
        transfer::public_transfer(treasury, tx_context::sender(ctx));
    }
}`
        },
        {
          path: 'tests/sui_token_tests.move',
          language: 'move',
          content: `#[test_only]
module sui_token::my_coin_tests {
    #[test]
    fun test_coin() { assert!(true, 0); }
}`
        }
      ],
      expectedArtifacts: ['sources/sui_token.move', 'tests/sui_token_tests.move']
    },
    {
      id: 'SUI-MARKETPLACE',
      name: 'Sui Marketplace Benchmark',
      ecosystem: 'Sui',
      category: 'Marketplace',
      description: 'Sui Move Object Marketplace module supporting shared listing objects and Kiosk standard.',
      targetLanguage: 'move',
      framework: 'Sui CLI',
      complexity: 'Complex',
      basePrompt: 'Build a Sui Move Object Marketplace using shared objects for listing and purchasing Sui NFTs.',
      sampleCode: [
        {
          path: 'sources/sui_marketplace.move',
          language: 'move',
          content: `module sui_marketplace::marketplace {
    use sui::object::{Self, UID};
    use sui::tx_context::TxContext;

    struct Marketplace has key { id: UID }
    public entry fun create(ctx: &mut TxContext) {}
}`
        },
        {
          path: 'tests/sui_marketplace_tests.move',
          language: 'move',
          content: `#[test_only]
module sui_marketplace::marketplace_tests {
    #[test]
    fun test_market() { assert!(true, 0); }
}`
        }
      ],
      expectedArtifacts: ['sources/sui_marketplace.move', 'tests/sui_marketplace_tests.move']
    },
    {
      id: 'SUI-ESCROW',
      name: 'Sui Escrow Benchmark',
      ecosystem: 'Sui',
      category: 'Escrow',
      description: 'Sui Move Escrow module using shared objects and object exchange mechanics.',
      targetLanguage: 'move',
      framework: 'Sui CLI',
      complexity: 'Intermediate',
      basePrompt: 'Construct a Sui Move Escrow module using object ownership transfer.',
      sampleCode: [
        {
          path: 'sources/sui_escrow.move',
          language: 'move',
          content: `module sui_escrow::escrow {
    public entry fun lock_object() {}
}`
        },
        {
          path: 'tests/sui_escrow_tests.move',
          language: 'move',
          content: `#[test_only]
module sui_escrow::escrow_tests {
    #[test]
    fun test_escrow() { assert!(true, 0); }
}`
        }
      ],
      expectedArtifacts: ['sources/sui_escrow.move', 'tests/sui_escrow_tests.move']
    },
    {
      id: 'SUI-DAO',
      name: 'Sui DAO Benchmark',
      ecosystem: 'Sui',
      category: 'DAO',
      description: 'Sui Move DAO Governance module using voting power tokens and shared proposal objects.',
      targetLanguage: 'move',
      framework: 'Sui CLI',
      complexity: 'Complex',
      basePrompt: 'Develop a Sui Move DAO Governance module for proposal creation and voting.',
      sampleCode: [
        {
          path: 'sources/sui_dao.move',
          language: 'move',
          content: `module sui_dao::governance {
    public entry fun submit_proposal() {}
}`
        },
        {
          path: 'tests/sui_dao_tests.move',
          language: 'move',
          content: `#[test_only]
module sui_dao::governance_tests {
    #[test]
    fun test_dao() { assert!(true, 0); }
}`
        }
      ],
      expectedArtifacts: ['sources/sui_dao.move', 'tests/sui_dao_tests.move']
    }
  ];

  public static getAllBenchmarks(): BenchmarkDefinition[] {
    return this.benchmarks;
  }

  public static getBenchmarksByEcosystem(ecosystem: BenchmarkEcosystemType): BenchmarkDefinition[] {
    return this.benchmarks.filter(b => b.ecosystem === ecosystem);
  }

  public static getBenchmarkById(id: string): BenchmarkDefinition | undefined {
    return this.benchmarks.find(b => b.id === id);
  }

  public static registerBenchmark(benchmark: BenchmarkDefinition): void {
    const existingIdx = this.benchmarks.findIndex(b => b.id === benchmark.id);
    if (existingIdx >= 0) {
      this.benchmarks[existingIdx] = benchmark;
    } else {
      this.benchmarks.push(benchmark);
    }
  }
}
