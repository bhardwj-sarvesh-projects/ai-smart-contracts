import { ArchitecturePlan, ProjectRequirements, SecurityPlan, UserIntent } from '../types';
import { EcosystemKnowledge } from '../knowledge/KnowledgeEngine';

export class EnterprisePromptBuilder {
  static buildPrompt(
    userPrompt: string,
    intent: UserIntent,
    req: ProjectRequirements,
    arch: ArchitecturePlan,
    sec: SecurityPlan,
    knowledge: EcosystemKnowledge
  ): { systemInstruction: string; userPromptText: string } {
    const chainName = (req.blockchain || 'ethereum').toLowerCase();
    const folderFilesList = arch.folderStructure.map(path => `- ${path}`).join('\n');

    const systemInstruction = `
You are an elite, world-class Principal Smart Contract Architect and Lead Protocol Engineer with 15+ years of experience building secure, multi-billion-dollar DeFi protocols, L1/L2 platforms, and enterprise solutions.

Your absolute directive is to generate a COMPLETE, fully functional, enterprise-grade, mainnet production-ready smart contract project workspace.

CRITICAL ARCHITECTURE DIRECTIVE:
- You must NEVER generate only a single contract file or skip files.
- You MUST generate EVERY single file listed in the ARCHITECTURE & FILE TREE. Every single one.
- Every file must be fully written out with 100% complete, meaningful, professional, production-ready content.
- Do NOT use placeholder text, "// TODO", or "simplified for example" comments. Everything must look like it was written by a senior protocol engineering team.
- For all generated contracts, implement state-of-the-art patterns: latest stable compilers, explicit interfaces, modifiers, Custom Errors instead of revert strings to save gas, secure access controls, and detailed NatSpec documentation (@title, @notice, @param, @return, @dev) for all public functions.

PROJECT LAYOUT ADAPTIVITY:
We are generating a project for the "${req.blockchain}" ecosystem using "${req.language}" and "${req.framework}".
You must output a valid JSON containing:
1. name: The name of the project.
2. description: A clear engineering description of what the project does.
3. files: An array of objects: { "path": "path/to/file", "content": "full content", "language": "solidity|rust|move|javascript|typescript|json|markdown" }
`.trim();

    const userPromptText = `
User Prompt: "${userPrompt}"
Intent: ${intent}

TARGET SPECIFICATIONS:
- Blockchain Target: ${req.blockchain.toUpperCase()} (${knowledge.blockchain})
- Language: ${req.language} (${knowledge.compilerVersion})
- Framework: ${req.framework} (${knowledge.framework})
- Contract Type: ${req.contractType}

REQUIRED FILE ARCHITECTURE:
You MUST generate every single one of these files with complete code, config, scripts, or markdown as appropriate:
${folderFilesList}

DETAILED SPECIFICATIONS PER FILE:
1. Core Contract File(s):
   - Fully written, comprehensive implementation (180 to 700+ lines of real code).
   - Use latest stable version-locked compiler directives (e.g., ^0.8.20 for Solidity, modern Cargo editions for Rust, Move 2024, etc.).
   - Include custom modifiers (e.g. nonReentrant, onlyAuthorized), custom errors (e.g. error Unauthorized(), error LimitExceeded()), and specific custom events.
   - Separate storage, logic, and interface definitions.

2. Interface File(s):
   - Define full interface declarations matching all external/public functions of the core contract, complete with custom errors and event signatures.

3. Configuration / Manifest Files:
   - Complete foundry.toml, hardhat.config.ts, Move.toml, Anchor.toml, Cargo.toml, or Scarb.toml matching the ecosystem. No empty blocks. Put correct dependency links and settings.
   - For Solana: provide correct Anchor.toml with [programs.localnet] and Cargo.toml with real workspace dependencies.
   - For EVM: provide correct foundry.toml and hardhat.config.ts with complete network profiles and compiler settings.

4. Script / Deployment Files:
   - Detailed deployment scripts (e.g. TypeScript deploy.ts with ethers/viem or Solidity Deploy.s.sol script with broadcast controls) configured for multi-network support.

5. Test Suite File(s):
   - Comprehensive test cases (unit + fuzz / property-based tests if applicable). No simple dummy tests. Mock variables and assert outcomes explicitly.

6. Enterprise Markdown Documentation:
   - README.md: Executive summary, file layout, installation, compile, and deploy commands.
   - ARCHITECTURE.md: Detailing contract interactions, storage layout, actor profiles, and sequence flow.
   - SECURITY.md: Audit readiness report, risk matrices, threat models, reentrancy guards, and access permissions.
   - DEPLOYMENT.md: Detailed deployment playbook, verifying instructions, gas estimates, and mainnet checklists.

JSON FORMAT REQUIREMENT:
Return ONLY a valid JSON object matching this schema. No backticks, no markdown, no other conversational text:
{
  "name": "${req.contractType}",
  "description": "Production-ready ${req.contractType} protocol project for ${knowledge.blockchain}",
  "files": [
    {
      "path": "path/to/file",
      "content": "full complete file content here",
      "language": "solidity|rust|move|javascript|typescript|json|markdown"
    }
  ],
  "audit": {
    "score": 96,
    "codeQuality": 95,
    "gasOptimization": 95,
    "complexity": 3,
    "summary": "Enterprise quality gate baseline audit passed.",
    "vulnerabilities": []
  }
}
`.trim();

    return { systemInstruction, userPromptText };
  }
}
