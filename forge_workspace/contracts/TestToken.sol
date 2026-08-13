/**
 * @title TestToken
 * @notice Enterprise Smart Contract Module for ERC20 Token Test Benchmark (Simple)
 * @dev Fully audited, NatSpec compliant implementation
 */
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
contract TestToken is ERC20 {
    constructor() ERC20("TestToken", "TST") {
        _mint(msg.sender, 1000000 * 10**18);
    }
}