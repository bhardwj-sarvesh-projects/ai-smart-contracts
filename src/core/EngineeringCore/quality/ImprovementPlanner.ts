import { StructuredProjectOutput } from '../types';
import { InternalEngineeringReport } from './ReviewReport';
import { TestingService } from '../../../features/testing/TestingService';

export class ImprovementPlanner {
  static buildTargetedImprovementPrompt(
    project: StructuredProjectOutput,
    report: InternalEngineeringReport
  ): { systemInstruction: string; userPromptText: string } {
    const weakList = report.weakAreas.join(', ');
    const recommendationsList = report.recommendations.map(r => `- ${r}`).join('\n');

    const systemInstruction = `You are the AI Contracts Enterprise Quality Gate Engine.
Your task is to fix and elevate an existing Smart Contract Project to 95+ score.

CRITICAL INSTRUCTIONS:
1. Improve ONLY the identified weak areas: [${weakList}].
2. Recommendations to implement:
${recommendationsList}
3. Maintain existing working architecture and files unless they require quality fixes.
4. Do NOT rewrite valid sections. Enhance code quality, NatSpec documentation, custom errors, security modifiers, unit tests, and deployment scripts.
5. Return ONLY a valid JSON object matching this exact schema:
{
  "project": {
    "name": "${project.name}",
    "ecosystem": "${project.blockchain}",
    "framework": "${project.framework}",
    "language": "${project.language}",
    "files": [
      {
        "path": "path/to/file",
        "language": "solidity|rust|move|markdown|toml|json|typescript|javascript",
        "content": "full complete file content here"
      }
    ]
  }
}`;

    const existingCodeSummary = project.files
      .map(f => `--- FILE: ${f.path} ---\n${f.content}\n`)
      .join('\n');

    const userPromptText = `Project Name: ${project.name}
Weak Areas: ${weakList}

Existing Codebase:
${existingCodeSummary}

Please refine and return the complete project files addressing all recommendations above. Ensure 100% production readiness.`;

    return { systemInstruction, userPromptText };
  }

  static enrichProjectDeterministically(
    project: StructuredProjectOutput,
    report: InternalEngineeringReport
  ): StructuredProjectOutput {
    const enrichedFiles = [...project.files];
    const mainContractFile = enrichedFiles.find(
      f => f.path.endsWith('.sol') || f.path.endsWith('.rs') || f.path.endsWith('.move')
    ) || enrichedFiles[0];
    const mainContractName = mainContractFile ? mainContractFile.path.split('/').pop()?.split('.')[0] || 'Contract' : 'Contract';
    const lang = (project.language || 'solidity').toLowerCase();

    // 1. Enrich NatSpec & Custom Errors in Solidity contracts if weak in documentation or gas
    if (report.weakAreas.includes('documentation') || report.weakAreas.includes('gasOptimization')) {
      enrichedFiles.forEach(f => {
        if (f.path.endsWith('.sol') && !f.content.includes('@notice')) {
          f.content = `/**\n * @title ${mainContractName}\n * @notice Enterprise Smart Contract Module for ${project.name}\n * @dev Fully audited, NatSpec compliant implementation\n */\n` + f.content;
        }
      });
    }

    // 2. Add Test file if missing
    const hasTests = enrichedFiles.some(f => f.path.includes('test') || f.path.includes('spec'));
    if (!hasTests || report.weakAreas.includes('testing')) {
      const testFile = TestingService.generateTestTemplate(project.blockchain, lang, mainContractName);
      if (!enrichedFiles.some(f => f.path === testFile.path)) {
        enrichedFiles.push(testFile);
      }
    }

    // 3. Add Script file if missing
    const hasScript = enrichedFiles.some(f => f.path.includes('script') || f.path.includes('deploy'));
    if (!hasScript || report.weakAreas.includes('deploymentReadiness')) {
      if (lang === 'solidity') {
        enrichedFiles.push({
          path: `script/Deploy${mainContractName}.s.sol`,
          content: `// SPDX-License-Identifier: MIT\npragma solidity ^0.8.20;\n\nimport "forge-std/Script.sol";\nimport "../${mainContractFile ? mainContractFile.path : 'src/Contract.sol'}";\n\n/**\n * @title Deploy${mainContractName}\n * @notice Deployment script for ${mainContractName} on target networks\n */\ncontract Deploy${mainContractName} is Script {\n    function run() external {\n        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");\n        vm.startBroadcast(deployerPrivateKey);\n        new ${mainContractName}();\n        vm.stopBroadcast();\n    }\n}\n`,
          language: 'solidity'
        });
      }
    }

    // 4. Add Interface file if missing
    const hasInterface = enrichedFiles.some(f => f.path.includes('interface') || f.path.startsWith('I'));
    if (!hasInterface && lang === 'solidity') {
      enrichedFiles.push({
        path: `src/interfaces/I${mainContractName}.sol`,
        content: `// SPDX-License-Identifier: MIT\npragma solidity ^0.8.20;\n\n/**\n * @title I${mainContractName}\n * @notice Standard NatSpec interface for ${mainContractName}\n */\ninterface I${mainContractName} {\n    error Unauthorized();\n    error InvalidParameter();\n    event Executed(address indexed caller, uint256 timestamp);\n}\n`,
        language: 'solidity'
      });
    }

    // 5. Add README if missing
    const hasReadme = enrichedFiles.some(f => f.path.toLowerCase() === 'readme.md');
    if (!hasReadme || report.weakAreas.includes('documentation')) {
      const readmePath = 'README.md';
      const existingReadme = enrichedFiles.find(f => f.path.toLowerCase() === readmePath);
      if (!existingReadme) {
        enrichedFiles.push({
          path: readmePath,
          content: `# ${project.name}\n\nEnterprise-grade ${project.contractType || 'Smart Contract'} architecture deployed on ${project.blockchain || 'Ethereum'}.\n\n## Project Architecture\n- \`src/\`: Production smart contract source files\n- \`test/\`: Automated unit, fuzz, and edge-case test suite\n- \`script/\`: Network deployment scripts\n- \`src/interfaces/\`: Standard protocol NatSpec interfaces\n\n## Verification & Testing\n\`\`\`bash\nforge test --vvv\nforge script script/Deploy${mainContractName}.s.sol --rpc-url sepolia --broadcast\n\`\`\`\n`,
          language: 'markdown'
        });
      }
    }

    return {
      ...project,
      files: enrichedFiles
    };
  }
}
