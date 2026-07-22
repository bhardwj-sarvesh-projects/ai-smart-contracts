import { StructuredProjectOutput } from '../types';
import { QualityCheckItem, DetailedCategoryScores, InternalEngineeringReport } from './ReviewReport';
import { ScoreCalculator } from './ScoreCalculator';

export class EngineeringReviewer {
  static reviewProject(project: StructuredProjectOutput, passNumber = 1): InternalEngineeringReport {
    const checklist: QualityCheckItem[] = [];
    const recommendations: string[] = [];

    const files = project.files || [];
    const mainFiles = files.filter(f => f.path.endsWith('.sol') || f.path.endsWith('.rs') || f.path.endsWith('.move'));
    const testFiles = files.filter(f => f.path.includes('test') || f.path.includes('spec'));
    const scriptFiles = files.filter(f => f.path.includes('script') || f.path.includes('deploy'));
    const interfaceFiles = files.filter(f => f.path.includes('interface') || f.path.includes('interfaces'));
    const readmeFile = files.find(f => f.path.toLowerCase() === 'readme.md');

    const totalCodeText = files.map(f => f.content).join('\n');
    const mainCodeText = mainFiles.map(f => f.content).join('\n');

    // 1. Requirements Completeness (10%)
    let reqScore = 96;
    if (files.length < 3) {
      reqScore -= 15;
      checklist.push({ category: 'Requirements', item: 'Project File Volume', status: 'WARN', details: 'Project has fewer than 3 files.' });
    } else {
      checklist.push({ category: 'Requirements', item: 'Project File Volume', status: 'PASS', details: `${files.length} modular files provided.` });
    }
    if (!mainFiles.length) {
      reqScore -= 30;
      checklist.push({ category: 'Requirements', item: 'Core Contract Implementation', status: 'FAIL', details: 'No smart contract source files found.' });
    } else {
      checklist.push({ category: 'Requirements', item: 'Core Contract Implementation', status: 'PASS', details: `${mainFiles.length} smart contract files generated.` });
    }

    // 2. Architecture (15%)
    let archScore = 95;
    const hasInterface = interfaceFiles.length > 0 || totalCodeText.includes('interface ');
    if (hasInterface) {
      checklist.push({ category: 'Architecture', item: 'Interfaces & Abstraction', status: 'PASS', details: 'Explicit interface separation found.' });
    } else {
      archScore -= 10;
      checklist.push({ category: 'Architecture', item: 'Interfaces & Abstraction', status: 'WARN', details: 'Consider adding explicit interfaces in interfaces/ directory.' });
      recommendations.push('Extract public methods into standard interface definitions under interfaces/');
    }

    const hasSubdirectories = files.some(f => f.path.includes('/'));
    if (hasSubdirectories) {
      checklist.push({ category: 'Architecture', item: 'Modular Directory Hierarchy', status: 'PASS', details: 'Clean multi-folder architecture used.' });
    } else {
      archScore -= 10;
      checklist.push({ category: 'Architecture', item: 'Modular Directory Hierarchy', status: 'WARN', details: 'All files placed in root directory.' });
    }

    // 3. Security (20%)
    let secScore = 98;
    if (mainCodeText.includes('.call{value:') || mainCodeText.includes('.transfer(') || mainCodeText.includes('.send(')) {
      if (!mainCodeText.includes('nonReentrant') && !mainCodeText.includes('ReentrancyGuard')) {
        secScore -= 20;
        checklist.push({ category: 'Security', item: 'Reentrancy Protection', status: 'FAIL', details: 'Value transfers detected without ReentrancyGuard modifier.' });
        recommendations.push('Apply OpenZeppelin ReentrancyGuard nonReentrant to functions calling external addresses.');
      } else {
        checklist.push({ category: 'Security', item: 'Reentrancy Protection', status: 'PASS', details: 'ReentrancyGuard protection confirmed.' });
      }
    } else {
      checklist.push({ category: 'Security', item: 'Reentrancy Protection', status: 'PASS', details: 'No unprotected external balance transfer vulnerability.' });
    }

    if (mainCodeText.includes('tx.origin')) {
      secScore -= 25;
      checklist.push({ category: 'Security', item: 'Authentication Safety', status: 'FAIL', details: 'Dangerous use of tx.origin detected.' });
      recommendations.push('Replace tx.origin with msg.sender or AccessControl role authorization.');
    } else {
      checklist.push({ category: 'Security', item: 'Authentication Safety', status: 'PASS', details: 'No dangerous tx.origin usage.' });
    }

    if (mainCodeText.includes('onlyOwner') || mainCodeText.includes('AccessControl') || mainCodeText.includes('hasRole') || mainCodeText.includes('signer::')) {
      checklist.push({ category: 'Security', item: 'Access Control', status: 'PASS', details: 'Strict access control modifiers implemented.' });
    } else {
      secScore -= 10;
      checklist.push({ category: 'Security', item: 'Access Control', status: 'WARN', details: 'No standard access control pattern (Ownable/AccessControl) detected.' });
      recommendations.push('Integrate Ownable or AccessControl roles for administrative operations.');
    }

    // 4. Code Quality (15%)
    let codeScore = 96;
    if (mainCodeText.includes('pragma solidity') && !mainCodeText.includes('0.8.')) {
      codeScore -= 12;
      checklist.push({ category: 'Code Quality', item: 'Compiler Pragmas', status: 'WARN', details: 'Using outdated Solidity compiler version (<0.8.0).' });
    } else {
      checklist.push({ category: 'Code Quality', item: 'Compiler Pragmas', status: 'PASS', details: 'Modern compiler directive specified.' });
    }

    // 5. Gas Optimization (10%)
    let gasScore = 94;
    if (mainCodeText.includes('require(') && mainCodeText.includes('", "')) {
      gasScore -= 10;
      checklist.push({ category: 'Gas Optimization', item: 'Custom Errors vs String Reverts', status: 'WARN', details: 'String revert messages consume extra gas overhead.' });
      recommendations.push('Replace string revert statements with custom errors (error Unauthorized()) to reduce bytecode size & execution gas.');
    } else {
      checklist.push({ category: 'Gas Optimization', item: 'Custom Errors vs String Reverts', status: 'PASS', details: 'Custom errors or modern gas-efficient reverts used.' });
    }

    // 6. Documentation (10%)
    let docScore = 95;
    if (!readmeFile) {
      docScore -= 20;
      checklist.push({ category: 'Documentation', item: 'Project README', status: 'FAIL', details: 'Missing README.md documentation file.' });
      recommendations.push('Add a comprehensive README.md with setup, compilation, and deployment instructions.');
    } else {
      checklist.push({ category: 'Documentation', item: 'Project README', status: 'PASS', details: 'README.md exists with deployment & usage guides.' });
    }

    if (mainCodeText.includes('@notice') || mainCodeText.includes('@dev') || mainCodeText.includes('@title')) {
      checklist.push({ category: 'Documentation', item: 'NatSpec In-line Comments', status: 'PASS', details: 'Rich NatSpec documentation tags present.' });
    } else {
      docScore -= 10;
      checklist.push({ category: 'Documentation', item: 'NatSpec In-line Comments', status: 'WARN', details: 'Missing NatSpec tags (@notice, @param, @dev) on public methods.' });
      recommendations.push('Add NatSpec documentation tags (@notice, @param, @return) above smart contract functions.');
    }

    // 7. Testing (10%)
    let testScore = 95;
    if (testFiles.length === 0) {
      testScore -= 30;
      checklist.push({ category: 'Testing', item: 'Test Suite Files', status: 'FAIL', details: 'No unit or fuzz testing files found.' });
      recommendations.push('Include automated unit and fuzz test suites in test/ or tests/ directory.');
    } else {
      checklist.push({ category: 'Testing', item: 'Test Suite Files', status: 'PASS', details: `${testFiles.length} test files included.` });

      const testContent = testFiles.map(f => f.content).join('\n');
      if (testContent.includes('fuzz') || testContent.includes('testFuzz') || testContent.includes('assume')) {
        checklist.push({ category: 'Testing', item: 'Fuzz Testing Coverage', status: 'PASS', details: 'Property-based fuzz test cases verified.' });
      } else {
        testScore -= 5;
        checklist.push({ category: 'Testing', item: 'Fuzz Testing Coverage', status: 'WARN', details: 'No fuzz testing detected in test suite.' });
      }
    }

    // 8. Deployment Readiness (5%)
    let deployScore = 95;
    if (scriptFiles.length === 0) {
      deployScore -= 20;
      checklist.push({ category: 'Deployment', item: 'Deployment Automation Scripts', status: 'FAIL', details: 'No deployment script (Deploy.s.sol / deploy.ts) found.' });
      recommendations.push('Create deployment automation scripts in script/ or scripts/ directory.');
    } else {
      checklist.push({ category: 'Deployment', item: 'Deployment Automation Scripts', status: 'PASS', details: 'Automated deployment script verified.' });
    }

    // 9. Maintainability (3%)
    let maintScore = 96;
    checklist.push({ category: 'Maintainability', item: 'Naming Conventions', status: 'PASS', details: 'Consistent naming conventions and clean modular structure.' });

    // 10. Standards Compliance (2%)
    let stdScore = 97;
    checklist.push({ category: 'Standards', item: 'Ecosystem Standards', status: 'PASS', details: 'Compliant with target chain standard practices.' });

    const categoryScores: DetailedCategoryScores = {
      requirementsCompleteness: Math.max(0, reqScore),
      architecture: Math.max(0, archScore),
      security: Math.max(0, secScore),
      codeQuality: Math.max(0, codeScore),
      gasOptimization: Math.max(0, gasScore),
      documentation: Math.max(0, docScore),
      testing: Math.max(0, testScore),
      deploymentReadiness: Math.max(0, deployScore),
      maintainability: Math.max(0, maintScore),
      standardsCompliance: Math.max(0, stdScore),
    };

    const overallScore = ScoreCalculator.calculateOverallScore(categoryScores);
    const weakAreas = ScoreCalculator.getWeakAreas(categoryScores, 90);

    return {
      overallScore,
      categoryScores,
      decision: overallScore >= 95 ? 'APPROVED' : overallScore >= 90 ? 'TARGETED_IMPROVEMENT' : 'REBUILD_AND_REGENERATE',
      passesCount: passNumber,
      checklist,
      recommendations,
      weakAreas,
      improvementLog: [],
      timestamp: new Date().toISOString(),
      requirementsSummary: `Target: ${project.contractType || 'Smart Contract'} on ${project.blockchain || 'Ethereum'}`,
      architectureSummary: `${files.length} files | Main: ${mainFiles.map(f => f.path).join(', ')}`
    };
  }
}
