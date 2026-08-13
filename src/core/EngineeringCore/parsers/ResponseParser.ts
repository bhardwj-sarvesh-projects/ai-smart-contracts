import { StructuredProjectOutput, ProjectProfile } from '../types';
import { ProjectFile } from '../../../types';
import { CategoryClassifier } from '../validators/CategoryClassifier';
import { MarkdownFenceStripper } from './MarkdownFenceStripper';
import { WhitespaceNormalizer } from './WhitespaceNormalizer';
import { UnicodeNormalizer } from './UnicodeNormalizer';
import { LanguageExtractor } from './LanguageExtractor';
import { LanguageRepairEngine } from './LanguageRepairEngine';
import { SmartContractValidator } from '../validators/SmartContractValidator';
import { FrontendValidator } from '../validators/FrontendValidator';
import { ConfigurationValidator } from '../validators/ConfigurationValidator';
import { DocumentationValidator } from '../validators/DocumentationValidator';
import { AssetValidator } from '../validators/AssetValidator';
import { ArchitecturePlanner } from '../planners/ArchitecturePlanner';

export class ResponseParser {
  /**
   * Extracts clean source code from raw LLM output, applying full normalization pipeline.
   */
  static extractSource(rawResponse: string, path?: string): string {
    if (!path) {
      return LanguageExtractor.extractAndNormalize(rawResponse, 'code.txt');
    }
    const extracted = LanguageExtractor.extractAndNormalize(rawResponse, path);
    return LanguageRepairEngine.repair(path, extracted);
  }

  /**
   * Validates the source code for a specific file path and language using category-aware dispatch.
   * Normalizes, extracts, repairs, and validates.
   */
  static validateSource(path: string, content: string, language: string, profile?: ProjectProfile): ProjectFile {
    if (profile) {
      ArchitecturePlanner.validateProfileFileMismatch(profile, path);
    }

    // Normalization & Repair Pipeline
    let processed = LanguageExtractor.extractAndNormalize(content, path);
    processed = LanguageRepairEngine.repair(path, processed);

    const category = CategoryClassifier.classify(path);

    switch (category) {
      case 'SMART_CONTRACT':
        return SmartContractValidator.validate(path, processed, language);
      case 'FRONTEND':
        return FrontendValidator.validate(path, processed, language);
      case 'CONFIGURATION':
        return ConfigurationValidator.validate(path, processed, language);
      case 'DOCUMENTATION':
        return DocumentationValidator.validate(path, processed, language);
      case 'ASSET':
        return AssetValidator.validate(path, processed, language);
      default:
        return ConfigurationValidator.validate(path, processed, language);
    }
  }

  /**
   * Legacy V1 JSON project parsing is decommissioned in Generation Pipeline V2.
   * UniversalPipeline uses Planner-owned single-file incremental generation.
   */
  static parseAndNormalize(rawResponse: string, fallbackName: string = 'Smart Contract Workspace'): StructuredProjectOutput {
    // Pipeline V2: Standard operation uses direct single-file extraction via extractSource / validateSource.
    const sourceContent = MarkdownFenceStripper.strip(rawResponse);
    return {
      name: fallbackName,
      description: 'Production-ready project (Pipeline V2)',
      blockchain: 'ethereum',
      language: 'solidity',
      framework: 'foundry',
      contractType: fallbackName,
      files: [
        ResponseParser.validateSource('contracts/Contract.sol', sourceContent, 'solidity')
      ]
    };
  }
}

