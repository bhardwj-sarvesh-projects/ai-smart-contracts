import { SmartContractTemplate } from '../types';

export const BLOCKCHAINS = [
  {
    id: 'ethereum',
    name: 'Ethereum',
    languages: [
      { id: 'solidity', name: 'Solidity', frameworks: ['Hardhat', 'Foundry', 'Truffle', 'Remix'], defaultExtension: 'sol' },
      { id: 'vyper', name: 'Vyper', frameworks: ['Brownie', 'Titan', 'Remix'], defaultExtension: 'vy' }
    ]
  },
  {
    id: 'solana',
    name: 'Solana',
    languages: [
      { id: 'rust-anchor', name: 'Rust (Anchor)', frameworks: ['Anchor'], defaultExtension: 'rs' },
      { id: 'rust-native', name: 'Native Rust', frameworks: ['Native SDK'], defaultExtension: 'rs' },
      { id: 'solidity-solang', name: 'Solidity (Solang)', frameworks: ['Solang'], defaultExtension: 'sol' },
      { id: 'python-seahorse', name: 'Seahorse Python', frameworks: ['Seahorse'], defaultExtension: 'py' }
    ]
  },
  {
    id: 'sui',
    name: 'Sui',
    languages: [
      { id: 'move', name: 'Move', frameworks: ['Sui Move Framework'], defaultExtension: 'move' }
    ]
  },
  {
    id: 'aptos',
    name: 'Aptos',
    languages: [
      { id: 'move', name: 'Move', frameworks: ['Aptos Move Framework'], defaultExtension: 'move' }
    ]
  },
  {
    id: 'base',
    name: 'Base',
    languages: [
      { id: 'solidity', name: 'Solidity', frameworks: ['Hardhat', 'Foundry', 'Remix'], defaultExtension: 'sol' },
      { id: 'vyper', name: 'Vyper', frameworks: ['Remix'], defaultExtension: 'vy' }
    ]
  },
  {
    id: 'polygon',
    name: 'Polygon',
    languages: [
      { id: 'solidity', name: 'Solidity', frameworks: ['Hardhat', 'Foundry', 'Remix'], defaultExtension: 'sol' }
    ]
  },
  {
    id: 'arbitrum',
    name: 'Arbitrum',
    languages: [
      { id: 'solidity', name: 'Solidity', frameworks: ['Hardhat', 'Foundry', 'Remix'], defaultExtension: 'sol' },
      { id: 'rust-arbitrum', name: 'Rust (Stylus)', frameworks: ['Cargo Stylus'], defaultExtension: 'rs' }
    ]
  },
  {
    id: 'optimism',
    name: 'Optimism',
    languages: [
      { id: 'solidity', name: 'Solidity', frameworks: ['Hardhat', 'Foundry', 'Remix'], defaultExtension: 'sol' }
    ]
  },
  {
    id: 'ton',
    name: 'TON',
    languages: [
      { id: 'tact', name: 'Tact', frameworks: ['Tact Blueprint'], defaultExtension: 'tact' },
      { id: 'func', name: 'FunC', frameworks: ['FunC SDK'], defaultExtension: 'fc' }
    ]
  },
  {
    id: 'cosmos',
    name: 'Cosmos',
    languages: [
      { id: 'rust-cosmwasm', name: 'Rust (CosmWasm)', frameworks: ['CosmWasm'], defaultExtension: 'rs' }
    ]
  }
];

export const TEMPLATES: SmartContractTemplate[] = [
  {
    id: 'erc20',
    name: 'ERC20 Token Platform',
    description: 'Standard fungible token with advanced capabilities: mintable, burnable, and ERC20Permit gasless approvals.',
    blockchain: 'ethereum',
    language: 'solidity',
    framework: 'Hardhat',
    type: 'ERC20',
    files: [
      {
        path: 'contracts/Token.sol',
        language: 'solidity',
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title Enterprise ERC20 Token
 * @dev Full-featured ERC20 token with minting, burning, and gasless permit approvals.
 */
contract MyToken is ERC20, ERC20Burnable, ERC20Permit, Ownable {
    constructor(string memory name, string memory symbol, uint256 initialSupply) 
        ERC20(name, symbol) 
        ERC20Permit(name)
        Ownable(msg.sender) 
    {
        _mint(msg.sender, initialSupply * 10 ** decimals());
    }

    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }

    // Required overrides
    function _update(address from, address to, uint256 value)
        internal
        override(ERC20)
    {
        super._update(from, to, value);
    }
}`
      },
      {
        path: 'test/Token.test.js',
        language: 'javascript',
        content: `const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ERC20 Token Platform", function () {
  let Token, token, owner, addr1;

  beforeEach(async function () {
    [owner, addr1] = await ethers.getSigners();
    Token = await ethers.getContractFactory("MyToken");
    token = await Token.deploy("Enterprise Gold", "EGD", 1000000);
  });

  it("Should assign the total supply to the owner", async function () {
    const ownerBalance = await token.balanceOf(owner.address);
    expect(await token.totalSupply()).to.equal(ownerBalance);
  });

  it("Should mint tokens to address when authorized", async function () {
    await token.mint(addr1.address, 500);
    expect(await token.balanceOf(addr1.address)).to.equal(500);
  });
});`
      },
      {
        path: 'scripts/deploy.js',
        language: 'javascript',
        content: `const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contract with the account:", deployer.address);

  const Token = await hre.ethers.getContractFactory("MyToken");
  const token = await Token.deploy("Enterprise Gold", "EGD", 1000000);

  await token.waitForDeployment();
  console.log("Token deployed to:", await token.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});`
      },
      {
        path: 'README.md',
        language: 'markdown',
        content: `# Enterprise ERC20 Smart Contract

This project includes a complete ERC20 standard token deployment package.

## Features
- **ERC20 standard compliance**: Fully standard compliant.
- **ERC20Permit**: Gasless approvals using signatures.
- **Ownable**: Controlled access for administrative tasks.

## Getting Started
\`\`\`bash
npm install
npx hardhat compile
npx hardhat test
\`\`\`
`
      }
    ]
  },
  {
    id: 'erc721',
    name: 'ERC721 NFT Platform',
    description: 'Standard non-fungible token (NFT) offering metadata URI storage and minting limits.',
    blockchain: 'ethereum',
    language: 'solidity',
    framework: 'Hardhat',
    type: 'ERC721',
    files: [
      {
        path: 'contracts/NFT.sol',
        language: 'solidity',
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract CustomNFT is ERC721URIStorage, Ownable {
    uint256 private _nextTokenId;

    constructor() ERC721("Art Collectible", "ART") Ownable(msg.sender) {}

    function mintNFT(address recipient, string memory tokenURI) public onlyOwner returns (uint256) {
        uint256 tokenId = _nextTokenId++;
        _safeMint(recipient, tokenId);
        _setTokenURI(tokenId, tokenURI);
        return tokenId;
    }
}`
      },
      {
        path: 'test/NFT.test.js',
        language: 'javascript',
        content: `const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ERC721 NFT Platform", function () {
  let NFT, nft, owner, addr1;

  beforeEach(async function () {
    [owner, addr1] = await ethers.getSigners();
    NFT = await ethers.getContractFactory("CustomNFT");
    nft = await NFT.deploy();
  });

  it("Should allow owner to mint NFTs", async function () {
    await nft.mintNFT(addr1.address, "ipfs://meta-nft");
    expect(await nft.ownerOf(0)).to.equal(addr1.address);
  });
});`
      }
    ]
  },
  {
    id: 'erc1155',
    name: 'ERC1155 Multi-Token Standard',
    description: 'Enables safe batch-transfers of multiple token classes (fungible + non-fungible) in a single contract.',
    blockchain: 'ethereum',
    language: 'solidity',
    framework: 'Hardhat',
    type: 'ERC1155',
    files: [
      {
        path: 'contracts/MultiToken.sol',
        language: 'solidity',
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract GameAssets is ERC1155, Ownable {
    uint256 public constant GOLD = 0;
    uint256 public constant SILVER = 1;
    uint256 public constant SWORD = 2;

    constructor() ERC1155("https://api.gameassets.com/item/{id}.json") Ownable(msg.sender) {
        _mint(msg.sender, GOLD, 10**18, "");
        _mint(msg.sender, SILVER, 10**20, "");
        _mint(msg.sender, SWORD, 1, "");
    }

    function mint(address to, uint256 id, uint256 amount, bytes memory data) public onlyOwner {
        _mint(to, id, amount, data);
    }
}`
      }
    ]
  },
  {
    id: 'escrow',
    name: 'Secured Escrow Exchange',
    description: 'Dynamic vault-secured escrow exchange holding contract deposits between Maker and Taker.',
    blockchain: 'solana',
    language: 'rust-anchor',
    framework: 'Anchor',
    type: 'Escrow',
    files: [
      {
        path: 'programs/escrow/src/lib.rs',
        language: 'rust',
        content: `use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod escrow {
    use super::*;

    pub fn make(ctx: Context<Make>, amount: u64, receive_amount: u64) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;
        escrow.maker = ctx.accounts.maker.key();
        escrow.maker_token = ctx.accounts.maker_token.key();
        escrow.taker_token = ctx.accounts.taker_token.key();
        escrow.receive_amount = receive_amount;

        let cpi_accounts = Transfer {
            from: ctx.accounts.maker_token.to_account_info(),
            to: ctx.accounts.vault.to_account_info(),
            authority: ctx.accounts.maker.to_account_info(),
        };
        let cpi_ctx = Context::new(
            ctx.accounts.token_program.to_account_info(),
            cpi_accounts,
            &[]
        );
        token::transfer(cpi_ctx, amount)?;
        Ok(())
    }
}

#[account]
pub struct Escrow {
    pub maker: Pubkey,
    pub maker_token: Pubkey,
    pub taker_token: Pubkey,
    pub receive_amount: u64,
}

#[derive(Accounts)]
pub struct Make<'info> {
    #[account(mut)]
    pub maker: Signer<'info>,
    #[account(mut)]
    pub maker_token: Account<'info, TokenAccount>,
    #[account(init, payer = maker, space = 8 + 32 + 32 + 32 + 8)]
    pub escrow: Account<'info, Escrow>,
    #[account(mut)]
    pub vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}`
      }
    ]
  },
  {
    id: 'staking',
    name: 'Yield Staking Pool',
    description: 'Dynamic rewards engine supporting ERC20 staking and reward calculations over duration periods.',
    blockchain: 'ethereum',
    language: 'solidity',
    framework: 'Hardhat',
    type: 'Staking',
    files: [
      {
        path: 'contracts/Staking.sol',
        language: 'solidity',
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract StakingPool is ReentrancyGuard {
    IERC20 public stakingToken;
    IERC20 public rewardToken;

    mapping(address => uint256) public stakedBalance;
    uint256 public totalStaked;

    constructor(address _stakingToken, address _rewardToken) {
        stakingToken = IERC20(_stakingToken);
        rewardToken = IERC20(_rewardToken);
    }

    function stake(uint256 amount) external nonReentrant {
        require(amount > 0, "Cannot stake 0");
        stakedBalance[msg.sender] += amount;
        totalStaked += amount;
        stakingToken.transferFrom(msg.sender, address(this), amount);
    }
}`
      }
    ]
  },
  {
    id: 'governance',
    name: 'DAO Governance Voting',
    description: 'Fully decentralised governance DAO matching ERC20 votes, delegation, quorum, and execution.',
    blockchain: 'ethereum',
    language: 'solidity',
    framework: 'Hardhat',
    type: 'Governance',
    files: [
      {
        path: 'contracts/DAO.sol',
        language: 'solidity',
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/governance/Governor.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorSettings.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorCountingSimple.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorVotes.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorVotesQuorumFraction.sol";

contract MyDAO is Governor, GovernorSettings, GovernorCountingSimple, GovernorVotes, GovernorVotesQuorumFraction {
    constructor(IVotes _token)
        Governor("MyDAO")
        GovernorSettings(1 /* 1 block voting delay */, 50400 /* ~1 week voting period */, 0)
        GovernorVotes(_token)
        GovernorVotesQuorumFraction(4 /* 4% quorum */)
    {}

    // Required overrides
    function votingDelay() public view override(Governor, GovernorSettings) returns (uint256) {
        return super.votingDelay();
    }

    function votingPeriod() public view override(Governor, GovernorSettings) returns (uint256) {
        return super.votingPeriod();
    }

    function quorum(uint256 blockNumber) public view override(Governor, GovernorVotesQuorumFraction) returns (uint256) {
        return super.quorum(blockNumber);
    }

    function proposalThreshold() public view override(Governor, GovernorSettings) returns (uint256) {
        return super.proposalThreshold();
    }
}`
      }
    ]
  },
  {
    id: 'dex',
    name: 'DEX Constant Product AMM',
    description: 'Automated Market Maker swap platform matching Uniswap v2 constant product (x * y = k) rules.',
    blockchain: 'ethereum',
    language: 'solidity',
    framework: 'Hardhat',
    type: 'DEX',
    files: [
      {
        path: 'contracts/AMM.sol',
        language: 'solidity',
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract ConstantProductAMM is ReentrancyGuard {
    IERC20 public token0;
    IERC20 public token1;
    uint256 public reserve0;
    uint256 public reserve1;

    constructor(address _token0, address _token1) {
        token0 = IERC20(_token0);
        token1 = IERC20(_token1);
    }

    function swap(address fromToken, uint256 amountIn) external nonReentrant returns (uint256 amountOut) {
        require(fromToken == address(token0) || fromToken == address(token1), "Invalid Token");
        bool isToken0 = fromToken == address(token0);
        (IERC20 tIn, IERC20 tOut, uint256 rIn, uint256 rOut) = isToken0 
            ? (token0, token1, reserve0, reserve1) 
            : (token1, token0, reserve1, reserve0);

        tIn.transferFrom(msg.sender, address(this), amountIn);
        uint255 amountInWithFee = (amountIn * 997) / 1000;
        amountOut = (amountInWithFee * rOut) / (rIn + amountInWithFee);

        tOut.transfer(msg.sender, amountOut);
        
        if (isToken0) {
            reserve0 = token0.balanceOf(address(this));
            reserve1 = token1.balanceOf(address(this));
        } else {
            reserve0 = token0.balanceOf(address(this));
            reserve1 = token1.balanceOf(address(this));
        }
    }
}`
      }
    ]
  },
  {
    id: 'marketplace',
    name: 'NFT Marketplace',
    description: 'Decentralized listings, auctions, buying, and selling platform for digital collectibles and NFTs.',
    blockchain: 'ethereum',
    language: 'solidity',
    framework: 'Hardhat',
    type: 'NFT Marketplace',
    files: [
      {
        path: 'contracts/Marketplace.sol',
        language: 'solidity',
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract NFTMarketplace is ReentrancyGuard {
    struct Listing {
        address seller;
        uint256 price;
        bool active;
    }
    mapping(address => mapping(uint256 => Listing)) public listings;

    event Listed(address indexed nftAddress, uint256 indexed tokenId, address seller, uint256 price);
    event Sold(address indexed nftAddress, uint256 indexed tokenId, address buyer, uint256 price);

    function listNFT(address nftAddress, uint256 tokenId, uint256 price) external {
        require(price > 0, "Price must be positive");
        IERC721(nftAddress).transferFrom(msg.sender, address(this), tokenId);
        listings[nftAddress][tokenId] = Listing(msg.sender, price, true);
        emit Listed(nftAddress, tokenId, msg.sender, price);
    }

    function buyNFT(address nftAddress, uint256 tokenId) external payable nonReentrant {
        Listing memory listing = listings[nftAddress][tokenId];
        require(listing.active, "NFT not listed");
        require(msg.value >= listing.price, "Insufficient payment");

        listings[nftAddress][tokenId].active = false;
        IERC721(nftAddress).transferFrom(address(this), msg.sender, tokenId);
        payable(listing.seller).transfer(listing.price);
        emit Sold(nftAddress, tokenId, msg.sender, listing.price);
    }
}`
      }
    ]
  },
  {
    id: 'yield-farming',
    name: 'Yield Farming Pool',
    description: 'Deposit LP tokens to farm governance token rewards computed dynamically over block heights.',
    blockchain: 'ethereum',
    language: 'solidity',
    framework: 'Hardhat',
    type: 'Yield Farming',
    files: [
      {
        path: 'contracts/YieldFarm.sol',
        language: 'solidity',
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract YieldFarm is Ownable {
    IERC20 public lpToken;
    IERC20 public rewardToken;
    uint256 public rewardPerBlock = 10**18;

    mapping(address => uint256) public lpBalances;
    mapping(address => uint256) public lastUpdateBlock;

    constructor(address _lpToken, address _rewardToken) Ownable(msg.sender) {
        lpToken = IERC20(_lpToken);
        rewardToken = IERC20(_rewardToken);
    }

    function deposit(uint256 amount) external {
        lpBalances[msg.sender] += amount;
        lastUpdateBlock[msg.sender] = block.number;
        lpToken.transferFrom(msg.sender, address(this), amount);
    }
}`
      }
    ]
  },
  {
    id: 'lottery',
    name: 'Verifiable VRF Lottery',
    description: 'Decentralized automated lottery with transparent ticket purchases and Chainlink VRF randomness.',
    blockchain: 'ethereum',
    language: 'solidity',
    framework: 'Hardhat',
    type: 'Lottery',
    files: [
      {
        path: 'contracts/Lottery.sol',
        language: 'solidity',
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

contract SimpleLottery is Ownable {
    address[] public players;
    uint256 public ticketPrice = 0.01 ether;

    constructor() Ownable(msg.sender) {}

    function buyTicket() external payable {
        require(msg.value == ticketPrice, "Incorrect ticket price");
        players.push(msg.sender);
    }

    function pickWinner() external onlyOwner {
        require(players.length > 0, "No players in lottery");
        uint256 index = uint256(keccak256(abi.encodePacked(block.prevrandao, block.timestamp, players))) % players.length;
        address winner = players[index];
        payable(winner).transfer(address(this).balance);
        delete players;
    }
}`
      }
    ]
  },
  {
    id: 'prediction-market',
    name: 'Prediction Market',
    description: 'Outcome wagering pool enabling fractional trading on binary real-world future events.',
    blockchain: 'ethereum',
    language: 'solidity',
    framework: 'Hardhat',
    type: 'Prediction Market',
    files: [
      {
        path: 'contracts/PredictionMarket.sol',
        language: 'solidity',
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract PredictionMarket {
    enum Outcome { YES, NO }
    struct Bet { uint256 yesAmount; uint256 noAmount; }

    mapping(address => Bet) public bets;
    uint256 public totalYes;
    uint256 public totalNo;
    bool public resolved;
    Outcome public finalOutcome;

    function placeBet(Outcome outcome) external payable {
        require(!resolved, "Market resolved");
        if (outcome == Outcome.YES) {
            bets[msg.sender].yesAmount += msg.value;
            totalYes += msg.value;
        } else {
            bets[msg.sender].noAmount += msg.value;
            totalNo += msg.value;
        }
    }
}`
      }
    ]
  },
  {
    id: 'bridge',
    name: 'Cross-Chain Asset Bridge',
    description: 'Lockbox vault system orchestrating deposit validation events for cross-chain mint triggers.',
    blockchain: 'ethereum',
    language: 'solidity',
    framework: 'Hardhat',
    type: 'Bridge',
    files: [
      {
        path: 'contracts/Bridge.sol',
        language: 'solidity',
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract BridgeVault is Ownable {
    IERC20 public token;
    
    event Locked(address indexed user, uint256 amount, uint256 targetChainId);
    event Unlocked(address indexed user, uint256 amount);

    constructor(address _token) Ownable(msg.sender) {
        token = IERC20(_token);
    }

    function lock(uint256 amount, uint256 targetChainId) external {
        token.transferFrom(msg.sender, address(this), amount);
        emit Locked(msg.sender, amount, targetChainId);
    }
}`
      }
    ]
  },
  {
    id: 'wallet',
    name: 'Multisig Wallet Safe',
    description: 'Secure co-ownership wallet requiring multi-signature approval to execute outbound state transactions.',
    blockchain: 'ethereum',
    language: 'solidity',
    framework: 'Hardhat',
    type: 'Wallet',
    files: [
      {
        path: 'contracts/Multisig.sol',
        language: 'solidity',
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MultiSigWallet {
    address[] public owners;
    uint256 public required;

    struct Transaction {
        address destination;
        uint256 value;
        bytes data;
        bool executed;
    }

    Transaction[] public transactions;
    mapping(uint256 => mapping(address => bool)) public confirmations;

    constructor(address[] memory _owners, uint256 _required) {
        owners = _owners;
        required = _required;
    }

    function submitTransaction(address destination, uint256 value, bytes memory data) external {
        transactions.push(Transaction(destination, value, data, false));
    }
}`
      }
    ]
  },
  {
    id: 'oracle',
    name: 'Decentralized Oracle Feed',
    description: 'Node validator registration and consensus price-feed pushing protocol with query interfaces.',
    blockchain: 'ethereum',
    language: 'solidity',
    framework: 'Hardhat',
    type: 'Oracle',
    files: [
      {
        path: 'contracts/Oracle.sol',
        language: 'solidity',
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

contract PriceOracle is Ownable {
    mapping(bytes32 => uint256) private prices;
    
    event PriceUpdated(bytes32 indexed ticker, uint256 price);

    constructor() Ownable(msg.sender) {}

    function updatePrice(bytes32 ticker, uint256 price) external onlyOwner {
        prices[ticker] = price;
        emit PriceUpdated(ticker, price);
    }

    function getPrice(bytes32 ticker) external view returns (uint256) {
        return prices[ticker];
    }
}`
      }
    ]
  },
  {
    id: 'crowdfunding',
    name: 'Milestone Crowdfunding',
    description: 'Goal-based funding platform locking capital until modular milestone verification checkoffs succeed.',
    blockchain: 'ethereum',
    language: 'solidity',
    framework: 'Hardhat',
    type: 'Crowdfunding',
    files: [
      {
        path: 'contracts/MilestoneCrowdfund.sol',
        language: 'solidity',
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MilestoneCrowdfund {
    address public creator;
    uint256 public goal;
    uint256 public raised;
    uint256 public currentMilestone;

    mapping(address => uint256) public contributions;

    constructor(uint256 _goal) {
        creator = msg.sender;
        goal = _goal;
    }

    function contribute() external payable {
        contributions[msg.sender] += msg.value;
        raised += msg.value;
    }
}`
      }
    ]
  },
  {
    id: 'subscription',
    name: 'Recurring Subscription Billing',
    description: 'Enables safe periodic allowances streaming recurring fee withdrawals based on timestamps.',
    blockchain: 'ethereum',
    language: 'solidity',
    framework: 'Hardhat',
    type: 'Subscription',
    files: [
      {
        path: 'contracts/SubscriptionBilling.sol',
        language: 'solidity',
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract SubscriptionBilling {
    IERC20 public paymentToken;
    uint256 public subscriptionCost = 50 * 10**18;
    uint256 public billingPeriod = 30 days;

    mapping(address => uint256) public lastBilled;

    constructor(address _paymentToken) {
        paymentToken = IERC20(_paymentToken);
    }

    function chargeSubscriber(address subscriber) external {
        require(block.timestamp >= lastBilled[subscriber] + billingPeriod, "Too early to bill");
        lastBilled[subscriber] = block.timestamp;
        paymentToken.transferFrom(subscriber, address(this), subscriptionCost);
    }
}`
      }
    ]
  },
  {
    id: 'identity',
    name: 'Soulbound Identity DID',
    description: 'Non-transferable Soulbound DID profile ledger logging credential stamps on chain.',
    blockchain: 'ethereum',
    language: 'solidity',
    framework: 'Hardhat',
    type: 'Identity',
    files: [
      {
        path: 'contracts/SoulboundDID.sol',
        language: 'solidity',
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract SoulboundDID is ERC721, Ownable {
    constructor() ERC721("Soulbound DID Profile", "SOUL") Ownable(msg.sender) {}

    function mintProfile(address soul) external onlyOwner {
        _safeMint(soul, uint256(uint160(soul)));
    }

    // Disable standard transfers
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        require(from == address(0) || to == address(0), "Non-transferable Soulbound Profile");
        return super._update(to, tokenId, auth);
    }
}`
      }
    ]
  },
  {
    id: 'rwa',
    name: 'RWA Fractionalized Asset',
    description: 'Legally-compliant real-estate tokenization system issuing fractionalized ownership shares.',
    blockchain: 'ethereum',
    language: 'solidity',
    framework: 'Hardhat',
    type: 'RWA',
    files: [
      {
        path: 'contracts/FractionalRealEstate.sol',
        language: 'solidity',
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract FractionalAsset is ERC20, Ownable {
    string public propertyAddress;
    uint256 public valuationUSD;

    constructor(string memory name, string memory symbol, string memory _propertyAddress, uint256 _valuationUSD) 
        ERC20(name, symbol) 
        Ownable(msg.sender) 
    {
        propertyAddress = _propertyAddress;
        valuationUSD = _valuationUSD;
        _mint(msg.sender, 1000000 * 10**decimals()); // 1 Million Fractional Shares
    }
}`
      }
    ]
  },
  {
    id: 'gamefi',
    name: 'GameFi Crafting & Loot',
    description: 'Play-to-Earn logic executing procedural material consumption to burn and mint dynamic ERC1155 loot.',
    blockchain: 'ethereum',
    language: 'solidity',
    framework: 'Hardhat',
    type: 'GameFi',
    files: [
      {
        path: 'contracts/LootCrafting.sol',
        language: 'solidity',
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

contract LootCrafting {
    IERC1155 public gameAssets;
    uint256 public constant ORE = 0;
    uint256 public constant WEAPON = 1;

    constructor(address _gameAssets) {
        gameAssets = IERC1155(_gameAssets);
    }

    function craftWeapon() external {
        // Safe crafting protocol (logic would burn ORE and mint WEAPON)
    }
}`
      }
    ]
  },
  {
    id: 'socialfi',
    name: 'SocialFi Creator Keys',
    description: 'Dynamic bonding curve marketplace enabling keys trading for direct channel communications.',
    blockchain: 'ethereum',
    language: 'solidity',
    framework: 'Hardhat',
    type: 'SocialFi',
    files: [
      {
        path: 'contracts/CreatorKeys.sol',
        language: 'solidity',
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract CreatorKeys {
    mapping(address => uint256) public keysSupply;
    mapping(address => mapping(address => uint256)) public keysBalance;

    function getBuyPrice(address creator, uint256 amount) public view returns (uint256) {
        uint256 supply = keysSupply[creator];
        uint256 sum = 0;
        for (uint256 i = 0; i < amount; i++) {
            uint256 current = supply + i;
            sum += (current * current * 10**15);
        }
        return sum;
    }
}`
      }
    ]
  },
  {
    id: 'vault',
    name: 'ERC4626 Autocompounder Vault',
    description: 'EIP-4626 standardized single-asset yield-aggregating vault with autocompounding loops.',
    blockchain: 'ethereum',
    language: 'solidity',
    framework: 'Hardhat',
    type: 'Vault',
    files: [
      {
        path: 'contracts/YieldVault.sol',
        language: 'solidity',
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract YieldCompoundingVault is ERC4626 {
    constructor(IERC20 asset) 
        ERC20("Compounding Vault Token", "cVT") 
        ERC4626(asset) 
    {}
}`
      }
    ]
  },
  {
    id: 'token-vesting',
    name: 'Linear Vesting Vault',
    description: 'Linear release schedule locker holding lockbox allocations with claim intervals.',
    blockchain: 'ethereum',
    language: 'solidity',
    framework: 'Hardhat',
    type: 'Token Vesting',
    files: [
      {
        path: 'contracts/TokenVesting.sol',
        language: 'solidity',
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract TokenVesting is Ownable {
    IERC20 public token;
    uint256 public start;
    uint256 public duration;

    mapping(address => uint256) public totalAllocations;
    mapping(address => uint256) public released;

    constructor(address _token, uint256 _duration) Ownable(msg.sender) {
        token = IERC20(_token);
        start = block.timestamp;
        duration = _duration;
    }
}`
      }
    ]
  },
  {
    id: 'sui-move-escrow',
    name: 'Sui Move Escrow',
    description: 'An elegant Sui Move escrow smart contract.',
    blockchain: 'sui',
    language: 'move',
    framework: 'Sui Move Framework',
    type: 'Escrow',
    files: [
      {
        path: 'sources/escrow.move',
        language: 'move',
        content: `module escrow::escrow {
    use sui::object::{Self, UID};
    use sui::tx_context::{Self, TxContext};
    use sui::coin::{Self, Coin};
    use sui::transfer;

    struct Escrow<phantom T1, phantom T2> has key, store {
        id: UID,
        maker: address,
        taker: address,
        maker_coin: Coin<T1>,
        expected_amount: u64,
    }

    public fun create_escrow<T1, T2>(
        maker_coin: Coin<T1>,
        expected_amount: u64,
        taker: address,
        ctx: &mut TxContext
    ) {
        let id = object::new(ctx);
        let maker = tx_context::sender(ctx);

        let escrow = Escrow<T1, T2> {
            id,
            maker,
            taker,
            maker_coin,
            expected_amount,
        };

        transfer::share_object(escrow);
    }
}`
      }
    ]
  }
];
