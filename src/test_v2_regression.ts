import { RequirementAnalyzer } from './core/EngineeringCore/analyzers/RequirementAnalyzer';
import { ArchitecturePlanner } from './core/EngineeringCore/planners/ArchitecturePlanner';
import { LanguageExtractor } from './core/EngineeringCore/parsers/LanguageExtractor';
import { SmartContractValidator } from './core/EngineeringCore/validators/SmartContractValidator';

async function runFocusedRegressionTest() {
  console.log("=== RUNNING V2 FOCUSED REGRESSION TEST ===");

  // 1. Prove Planner filename: contracts/Token.sol cannot become contracts/ERC-20Token.sol
  const req = RequirementAnalyzer.extract("Create an ERC-20 token contract");
  const plan = ArchitecturePlanner.plan(req);
  
  const contractFile = plan.profile.directoryLayout.find(f => f.endsWith('.sol'));
  console.log(`[Test 1] Generated main contract path: ${contractFile}`);
  
  if (contractFile && contractFile.includes('-')) {
    throw new Error(`REGRESSION FAILED: Contract path "${contractFile}" contains invalid hyphens!`);
  }
  if (contractFile === 'contracts/ERC-20Token.sol') {
    throw new Error(`REGRESSION FAILED: Contract path is invalid "contracts/ERC-20Token.sol"!`);
  }
  console.log(`✅ TEST 1 PASSED: Contract filename is clean ("${contractFile}"), no "ERC-20Token.sol" with hyphens.`);

  // 2. Prove LLM response: {"content": "pragma solidity..."} cannot reach the Solidity validator as source
  const rawLlmResponse = '{"content": "pragma solidity ^0.8.20; contract MyToken {}"}';
  const extractedCode = LanguageExtractor.extractAndNormalize(rawLlmResponse, "contracts/MyToken.sol");
  
  console.log(`[Test 2] Extracted code snippet:\n${extractedCode}`);

  if (extractedCode.startsWith('{') || extractedCode.includes('"content"')) {
    throw new Error(`REGRESSION FAILED: Raw JSON string reached validator as source code!`);
  }

  const validatedFile = SmartContractValidator.validate("contracts/MyToken.sol", extractedCode, "solidity");
  if (!validatedFile || !validatedFile.content.includes("pragma solidity")) {
    throw new Error(`REGRESSION FAILED: Extracted code failed validation!`);
  }
  console.log(`✅ TEST 2 PASSED: LLM JSON wrapper cleanly stripped. Extracted valid Solidity code.`);

  console.log("==========================================");
  console.log("ALL V2 FOCUSED REGRESSION TESTS PASSED!");
  console.log("==========================================");
}

runFocusedRegressionTest().catch(err => {
  console.error("❌ REGRESSION TEST FAILED:", err);
  process.exit(1);
});
