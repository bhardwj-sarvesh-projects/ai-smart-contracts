# Complete API Reference & Interface Documentation

**Project Name:** ERC20 Token Test Benchmark (Simple)
**Target Ecosystem:** Ethereum/EVM
**Document Status:** Complete & Synchronized

---

## Overview
This document provides complete specification for every public and external function, event, error, modifier, parameter, return value, and authorization requirement in **ERC20 Token Test Benchmark (Simple)**.

---

## Module / Contract: `TestToken.sol`

### 1. State Variables & Public Getters
- `owner()`: Returns system owner / admin address.
- `paused()`: Returns pause state status.

### 2. Public & External Functions

#### Function: `initialize()`
- **Purpose:** Initializes contract variables and access control.
- **Parameters:** None
- **Returns:** void
- **Events Emitted:** `Initialized()`
- **Errors:** `AlreadyInitialized()`
- **Permissions:** Deployer / Owner
- **Gas Considerations:** ~50,000 gas
- **Usage Example:** `await contract.initialize();`

### 3. Events & Emissions
- `event StateChanged(address indexed caller, string action, uint256 timestamp)`: State transition logging.

### 4. Custom Errors & Revert Preconditions
- `error Unauthorized()`: Reverts when caller lacks required admin role.
- `error InvalidAmount()`: Reverts on zero or overflow parameters.

## Module / Contract: `DeployTestToken.s.sol`

### 1. State Variables & Public Getters
- `owner()`: Returns system owner / admin address.
- `paused()`: Returns pause state status.

### 2. Public & External Functions

#### Function: `run(None)`
- **Purpose:** Executes run state operation in ERC20 Token Test Benchmark (Simple).
- **Parameters:** `None`
- **Returns:** State outcome or event receipt.
- **Events Emitted:** Emits `RunExecuted` or relevant lifecycle events.
- **Custom Errors:** `InvalidParameter()`, `Unauthorized()`, `ReentrancyGuardReentrant()`.
- **Permissions:** 🌐 Public (Any Caller)
- **Gas Considerations:** ~35,000 - 85,000 gas (Optimized state storage writes).
- **Usage Example:**
```solidity
// Call from web3 client / contract caller
await contract.run();
```

### 3. Events & Emissions
- `event StateChanged(address indexed caller, string action, uint256 timestamp)`: State transition logging.

### 4. Custom Errors & Revert Preconditions
- `error Unauthorized()`: Reverts when caller lacks required admin role.
- `error InvalidAmount()`: Reverts on zero or overflow parameters.

## Module / Contract: `ITestToken.sol`

### 1. State Variables & Public Getters
- `owner()`: Returns system owner / admin address.
- `paused()`: Returns pause state status.

### 2. Public & External Functions

#### Function: `initialize()`
- **Purpose:** Initializes contract variables and access control.
- **Parameters:** None
- **Returns:** void
- **Events Emitted:** `Initialized()`
- **Errors:** `AlreadyInitialized()`
- **Permissions:** Deployer / Owner
- **Gas Considerations:** ~50,000 gas
- **Usage Example:** `await contract.initialize();`

### 3. Events & Emissions
- `event Executed(address indexed caller, uint256 timestamp)`: Indexed log event for off-chain indexers and subgraphs.

### 4. Custom Errors & Revert Preconditions
- `error Unauthorized()`: Reverts state changes when invariant precondition fails.
- `error InvalidParameter()`: Reverts state changes when invariant precondition fails.
