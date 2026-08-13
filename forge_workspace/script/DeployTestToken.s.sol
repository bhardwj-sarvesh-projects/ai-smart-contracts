// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/TestToken.sol";

/**
 * @title DeployTestToken
 * @notice Deployment script for TestToken on target networks
 */
contract DeployTestToken is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);
        new TestToken();
        vm.stopBroadcast();
    }
}