// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ITestToken
 * @notice Standard NatSpec interface for TestToken
 */
interface ITestToken {
    error Unauthorized();
    error InvalidParameter();
    event Executed(address indexed caller, uint256 timestamp);
}