import { BlockchainRegistry } from '../adapters/blockchain/BlockchainRegistry';
import { LanguageRegistry } from '../adapters/language/LanguageRegistry';
import { FrameworkRegistry } from '../adapters/framework/FrameworkRegistry';

export interface EcosystemKnowledge {
  blockchain: string;
  language: string;
  framework: string;
  compilerVersion: string;
  recommendedDependencies: string[];
  securityPatterns: string[];
  bestPractices: string[];
  standards: string[];
}

export class KnowledgeEngine {
  static getKnowledge(blockchainId: string, languageId?: string, frameworkId?: string): EcosystemKnowledge {
    const chainAdapter = BlockchainRegistry.getAdapter(blockchainId);
    const langId = languageId || chainAdapter.defaultLanguage;
    const langAdapter = LanguageRegistry.getAdapter(langId);
    const fwId = frameworkId || chainAdapter.defaultFramework;
    const fwAdapter = FrameworkRegistry.getAdapter(fwId);

    return {
      blockchain: chainAdapter.name,
      language: langAdapter.name,
      framework: fwAdapter.name,
      compilerVersion: langAdapter.compilerVersion,
      recommendedDependencies: fwAdapter.recommendedDependencies,
      securityPatterns: chainAdapter.securityPatterns.concat(langAdapter.securityGuidelines),
      bestPractices: chainAdapter.bestPractices.concat(langAdapter.formattingRules),
      standards: chainAdapter.standards,
    };
  }
}
