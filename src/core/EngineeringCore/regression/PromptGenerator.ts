import { BenchmarkDefinition } from './BenchmarkManager';

export type PromptCategory =
  | 'Simple'
  | 'Intermediate'
  | 'Complex'
  | 'Enterprise'
  | 'Edge Cases'
  | 'Invalid Inputs'
  | 'Ambiguous Requirements'
  | 'Large Multi-Contract Systems';

export interface PromptVariation {
  id: string;
  benchmarkId: string;
  category: PromptCategory;
  promptText: string;
  expectedBehavior: 'ExpectSuccess' | 'ExpectValidationError' | 'ExpectSelfHealing' | 'ExpectWarning';
  metadata: {
    complexityScore: number; // 1-10
    rolesCount: number;
    contractsCount: number;
    specialDirectives: string[];
  };
}

export class PromptGenerator {
  private static categories: PromptCategory[] = [
    'Simple',
    'Intermediate',
    'Complex',
    'Enterprise',
    'Edge Cases',
    'Invalid Inputs',
    'Ambiguous Requirements',
    'Large Multi-Contract Systems'
  ];

  public static generateVariationsForBenchmark(
    benchmark: BenchmarkDefinition,
    countPerCategory: number = 2
  ): PromptVariation[] {
    const variations: PromptVariation[] = [];

    this.categories.forEach(category => {
      for (let i = 1; i <= countPerCategory; i++) {
        variations.push(this.buildVariation(benchmark, category, i));
      }
    });

    return variations;
  }

  public static generateHundredsOfVariations(
    benchmarks: BenchmarkDefinition[],
    targetTotal: number = 300
  ): PromptVariation[] {
    const allVariations: PromptVariation[] = [];
    const countPerBenchmarkPerCat = Math.max(1, Math.ceil(targetTotal / (benchmarks.length * this.categories.length)));

    benchmarks.forEach(bm => {
      this.categories.forEach(cat => {
        for (let i = 1; i <= countPerBenchmarkPerCat; i++) {
          if (allVariations.length < targetTotal) {
            allVariations.push(this.buildVariation(bm, cat, i));
          }
        }
      });
    });

    return allVariations;
  }

  private static buildVariation(
    benchmark: BenchmarkDefinition,
    category: PromptCategory,
    variantIndex: number
  ): PromptVariation {
    const varId = `PV-${benchmark.id}-${category.replace(/\s+/g, '')}-${variantIndex}`;
    let promptText = '';
    let expectedBehavior: PromptVariation['expectedBehavior'] = 'ExpectSuccess';
    let complexityScore = 5;
    let rolesCount = 2;
    let contractsCount = 1;
    let specialDirectives: string[] = [];

    switch (category) {
      case 'Simple':
        promptText = `${benchmark.basePrompt} (Variant ${variantIndex}: Minimal setup, zero external dependencies, baseline functionality).`;
        expectedBehavior = 'ExpectSuccess';
        complexityScore = 2;
        rolesCount = 1;
        contractsCount = 1;
        specialDirectives = ['Clean simple single contract structure'];
        break;

      case 'Intermediate':
        promptText = `${benchmark.basePrompt} (Variant ${variantIndex}: Include access controls, emergency pause mechanisms, custom event logging, and reentrancy guards).`;
        expectedBehavior = 'ExpectSuccess';
        complexityScore = 5;
        rolesCount = 2;
        contractsCount = 1;
        specialDirectives = ['AccessControl', 'ReentrancyGuard', 'Pausable'];
        break;

      case 'Complex':
        promptText = `${benchmark.basePrompt} (Variant ${variantIndex}: Add dynamic fee structures, timelocked governance veto powers, multi-tier permissions, and automated state machine transitions).`;
        expectedBehavior = 'ExpectSuccess';
        complexityScore = 8;
        rolesCount = 4;
        contractsCount = 2;
        specialDirectives = ['Dynamic Fees', 'Timelock Veto', 'State Machine'];
        break;

      case 'Enterprise':
        promptText = `${benchmark.basePrompt} (Variant ${variantIndex}: Enterprise institutional edition with UUPS upgradeability, compliance sanctions blacklist, multi-sig admin multi-key execution, and automated emergency vault drain).`;
        expectedBehavior = 'ExpectSuccess';
        complexityScore = 10;
        rolesCount = 5;
        contractsCount = 3;
        specialDirectives = ['UUPS Proxy', 'Compliance Blacklist', 'MultiSig Admin', 'Emergency Vault Drain'];
        break;

      case 'Edge Cases':
        promptText = `${benchmark.basePrompt} (Variant ${variantIndex}: Handle edge cases explicitly: zero-address input handling, max integer supply boundary conditions, zero-value transfers, and gas-limit optimization loops).`;
        expectedBehavior = 'ExpectSuccess';
        complexityScore = 7;
        rolesCount = 2;
        contractsCount = 1;
        specialDirectives = ['Zero Address Checks', 'Boundary Condition Guarding', 'Gas Optimization'];
        break;

      case 'Invalid Inputs':
        promptText = `${benchmark.basePrompt} (Variant ${variantIndex}: CRITICAL TEST - Malformed prompt containing invalid syntax references, non-existent token standards, and conflicting access parameters).`;
        expectedBehavior = 'ExpectValidationError';
        complexityScore = 6;
        rolesCount = 1;
        contractsCount = 1;
        specialDirectives = ['Syntax Error Guard', 'Invalid Spec Detection'];
        break;

      case 'Ambiguous Requirements':
        promptText = `${benchmark.basePrompt} (Variant ${variantIndex}: Ambiguous prompt omitting target chain decimals, unassigned admin roles, unspecified fee percentages, and open-ended execution conditions).`;
        expectedBehavior = 'ExpectSelfHealing';
        complexityScore = 6;
        rolesCount = 2;
        contractsCount = 1;
        specialDirectives = ['Self-Healing Defaults', 'Ambiguity Resolution'];
        break;

      case 'Large Multi-Contract Systems':
        promptText = `${benchmark.basePrompt} (Variant ${variantIndex}: Ecosystem suite connecting Token, Staking Vault, Liquidity Pool Router, NFT Royalty Vault, and Timelocked Governance DAO in a multi-contract web).`;
        expectedBehavior = 'ExpectSuccess';
        complexityScore = 10;
        rolesCount = 6;
        contractsCount = 5;
        specialDirectives = ['Multi-Contract Architecture', 'Cross-Contract Interface Binding'];
        break;
    }

    return {
      id: varId,
      benchmarkId: benchmark.id,
      category,
      promptText,
      expectedBehavior,
      metadata: {
        complexityScore,
        rolesCount,
        contractsCount,
        specialDirectives
      }
    };
  }
}
