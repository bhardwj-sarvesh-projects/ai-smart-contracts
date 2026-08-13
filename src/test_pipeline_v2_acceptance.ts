import { UniversalPipeline } from './core/EngineeringCore/pipeline/UniversalPipeline';
import { SmartContractValidator } from './core/EngineeringCore/validators/SmartContractValidator';
import { FrontendValidator } from './core/EngineeringCore/validators/FrontendValidator';
import { ConfigurationValidator } from './core/EngineeringCore/validators/ConfigurationValidator';
import { DocumentationValidator } from './core/EngineeringCore/validators/DocumentationValidator';
import { AssetValidator } from './core/EngineeringCore/validators/AssetValidator';
import { EngineeringCertificationEngine } from './core/EngineeringCore/certification/EngineeringCertificationEngine';
import { DeploymentEngine } from './core/EngineeringCore/deployment/DeploymentEngine';

async function runAcceptanceTests() {
  console.log('=== RUNNING GENERATION PIPELINE V2 ACCEPTANCE TESTS ===\n');
  let allPassed = true;

  // TEST 1: Generate ERC20 -> Verify pragma solidity
  console.log('--- TEST 1: Solidity ERC20 Validation ---');
  const solContent = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MyERC20 is ERC20 {
    constructor() ERC20("MyToken", "MTK") {}
}
`;
  try {
    const res = SmartContractValidator.validate('contracts/MyERC20.sol', solContent, 'solidity');
    if (res.content.includes('pragma solidity ^0.8.20;')) {
      console.log('✅ PASS: ERC20 contract validated with pragma solidity.');
    } else {
      console.error('❌ FAIL: ERC20 contract validation failed.');
      allPassed = false;
    }
  } catch (err: any) {
    console.error('❌ FAIL: ERC20 validation threw error:', err.message);
    allPassed = false;
  }

  // TEST 2: Generate Anchor Rust -> Verify anchor_lang
  console.log('\n--- TEST 2: Anchor Rust Validation ---');
  const rustContent = `use anchor_lang::prelude::*;

declare_id!("11111111111111111111111111111111");

#[program]
pub mod my_anchor_prog {
    use super::*;
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        Ok(())
    }
}
`;
  try {
    const res = SmartContractValidator.validate('programs/my_prog/src/lib.rs', rustContent, 'rust');
    if (res.content.includes('anchor_lang')) {
      console.log('✅ PASS: Anchor Rust program validated with anchor_lang.');
    } else {
      console.error('❌ FAIL: Anchor Rust validation failed.');
      allPassed = false;
    }
  } catch (err: any) {
    console.error('❌ FAIL: Anchor Rust validation threw error:', err.message);
    allPassed = false;
  }

  // TEST 3: Generate Move -> Verify module
  console.log('\n--- TEST 3: Aptos Move Validation ---');
  const moveContent = `module my_addr::my_module {
    use std::signer;

    struct Coin has key { value: u64 }
}
`;
  try {
    const res = SmartContractValidator.validate('sources/my_module.move', moveContent, 'move');
    if (res.content.startsWith('module')) {
      console.log('✅ PASS: Move module validated starting with module.');
    } else {
      console.error('❌ FAIL: Move module validation failed.');
      allPassed = false;
    }
  } catch (err: any) {
    console.error('❌ FAIL: Move validation threw error:', err.message);
    allPassed = false;
  }

  // TEST 4: Generate README -> Verify Markdown only (no raw unformatted Solidity)
  console.log('\n--- TEST 4: README Markdown Validation ---');
  const mdContent = `# My Project Documentation

## Features
- Modular Smart Contracts
- Automated Tests

\`\`\`solidity
// Code snippet inside fence is allowed
pragma solidity ^0.8.20;
\`\`\`
`;
  try {
    const res = DocumentationValidator.validate('README.md', mdContent, 'markdown');
    if (res.content.includes('# My Project Documentation')) {
      console.log('✅ PASS: README validated cleanly as Markdown.');
    } else {
      console.error('❌ FAIL: README validation failed.');
      allPassed = false;
    }
  } catch (err: any) {
    console.error('❌ FAIL: README validation threw error:', err.message);
    allPassed = false;
  }

  // TEST 5: Generate HTML -> Verify <!DOCTYPE or <html start
  console.log('\n--- TEST 5: HTML Frontend Validation ---');
  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>DApp Dashboard</title>
</head>
<body>
    <div id="app"></div>
</body>
</html>
`;
  try {
    const res = FrontendValidator.validate('index.html', htmlContent, 'html');
    if (res.content.startsWith('<!DOCTYPE html>')) {
      console.log('✅ PASS: HTML validated starting with <!DOCTYPE.');
    } else {
      console.error('❌ FAIL: HTML validation failed.');
      allPassed = false;
    }
  } catch (err: any) {
    console.error('❌ FAIL: HTML validation threw error:', err.message);
    allPassed = false;
  }

  // TEST 6: Generate TOML -> Verify Valid TOML
  console.log('\n--- TEST 6: TOML Configuration Validation ---');
  const tomlContent = `[profile.default]
src = "src"
out = "out"
libs = ["lib"]
`;
  try {
    const res = ConfigurationValidator.validate('foundry.toml', tomlContent, 'toml');
    if (res.content.includes('[profile.default]')) {
      console.log('✅ PASS: foundry.toml validated as valid TOML.');
    } else {
      console.error('❌ FAIL: foundry.toml validation failed.');
      allPassed = false;
    }
  } catch (err: any) {
    console.error('❌ FAIL: foundry.toml validation threw error:', err.message);
    allPassed = false;
  }

  // TEST 7: Generate .env -> Verify Environment variables only
  console.log('\n--- TEST 7: Environment Variables (.env.example) Validation ---');
  const envContent = `# API Keys
SEPOLIA_RPC_URL=https://rpc.sepolia.org
PRIVATE_KEY=0x0000000000000000000000000000000000000000000000000000000000000000
ETHERSCAN_API_KEY=ABC123XYZ
`;
  try {
    const res = ConfigurationValidator.validate('.env.example', envContent, 'plaintext');
    if (res.content.includes('SEPOLIA_RPC_URL=')) {
      console.log('✅ PASS: .env.example validated cleanly.');
    } else {
      console.error('❌ FAIL: .env.example validation failed.');
      allPassed = false;
    }
  } catch (err: any) {
    console.error('❌ FAIL: .env.example validation threw error:', err.message);
    allPassed = false;
  }

  // TEST 8: Full Universal Pipeline End-to-End Execution
  console.log('\n--- TEST 8: Universal Pipeline End-to-End Execution ---');
  const mockAiExecutor = async (systemInstruction: string, prompt: string) => {
    const taskMatch = prompt.match(/Please generate "([^"]+)" now/);
    const targetFile = taskMatch ? taskMatch[1] : '';

    if (targetFile.endsWith('.toml')) {
      return `[profile.default]
src = "src"
out = "out"
libs = ["lib"]
`;
    }
    if (targetFile.endsWith('.env') || targetFile.includes('env')) {
      return `SEPOLIA_RPC_URL=https://rpc.sepolia.org\nPRIVATE_KEY=0x123\n`;
    }
    if (targetFile.endsWith('.json')) {
      return `{\n  "name": "test-project",\n  "version": "1.0.0"\n}`;
    }
    if (targetFile.endsWith('.md')) {
      return `# Project Documentation\nThis project contains smart contracts.\n`;
    }
    if (targetFile.endsWith('.rs')) {
      return `use anchor_lang::prelude::*;
declare_id!("11111111111111111111111111111111");
#[program]
pub mod my_program {
    use super::*;
}
`;
    }
    if (targetFile.endsWith('.move')) {
      return `module my_addr::my_module {
    use std::signer;
}
`;
    }
    if (targetFile.endsWith('.ts') || targetFile.endsWith('.js')) {
      return `import { ethers } from "hardhat";\nasync function main() { console.log("Deploying..."); }\nmain().catch(console.error);\n`;
    }
    if (targetFile.includes('IERC') || targetFile.includes('interface')) {
      return `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function totalSupply() external view returns (uint256);
}
`;
    }
    if (targetFile.endsWith('.sol')) {
      return `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MyERC20 is ERC20 {
    constructor() ERC20("MyToken", "MTK") {}
}
`;
    }
    return `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract SimpleContract {}
`;
  };

  try {
    const result = await UniversalPipeline.execute({
      userPrompt: 'Create a production ready ERC20 token with Foundry on Ethereum',
      blockchain: 'Ethereum',
      language: 'Solidity',
      framework: 'Foundry',
      aiExecutor: mockAiExecutor
    });

    if (result && result.files && result.files.length > 0) {
      console.log(`✅ PASS: UniversalPipeline executed successfully. Generated ${result.files.length} project files.`);
      const mainContract = result.files.find(f => f.path.endsWith('.sol'));
      if (mainContract && mainContract.content.includes('pragma solidity ^0.8.20;')) {
        console.log('✅ PASS: Main contract file generated with pragma solidity.');
      } else {
        console.error('❌ FAIL: Main contract file missing pragma solidity.');
        allPassed = false;
      }
    } else {
      console.error('❌ FAIL: UniversalPipeline returned no files.');
      allPassed = false;
    }
  } catch (err: any) {
    console.error('❌ FAIL: UniversalPipeline execution threw error:', err.message);
    allPassed = false;
  }

  console.log(`\n==========================================================`);
  console.log(`ACCEPTANCE TEST RESULT: ${allPassed ? '✅ ALL ACCEPTANCE TESTS PASSED' : '❌ TESTS FAILED'}`);
  console.log(`==========================================================\n`);

  if (!allPassed) {
    process.exit(1);
  }
}

runAcceptanceTests();
