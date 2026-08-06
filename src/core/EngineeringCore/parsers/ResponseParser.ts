import { StructuredProjectOutput, ProjectProfile } from '../types';
import { ProjectFile } from '../../../types';
import { CategoryClassifier } from '../validators/CategoryClassifier';
import { MarkdownFenceStripper } from './MarkdownFenceStripper';
import { SmartContractValidator } from '../validators/SmartContractValidator';
import { FrontendValidator } from '../validators/FrontendValidator';
import { ConfigurationValidator } from '../validators/ConfigurationValidator';
import { DocumentationValidator } from '../validators/DocumentationValidator';
import { AssetValidator } from '../validators/AssetValidator';
import { ArchitecturePlanner } from '../planners/ArchitecturePlanner';

export class ResponseParser {
  /**
   * Extracts clean source code from raw LLM output, removing any markdown code fences.
   */
  static extractSource(rawResponse: string, path?: string): string {
    return MarkdownFenceStripper.strip(rawResponse, path);
  }

  /**
   * Validates the source code for a specific file path and language using category-aware dispatch.
   * Strips markdown fences before validation.
   */
  static validateSource(path: string, content: string, language: string, profile?: ProjectProfile): ProjectFile {
    if (profile) {
      ArchitecturePlanner.validateProfileFileMismatch(profile, path);
    }
    const strippedContent = MarkdownFenceStripper.strip(content, path);
    const category = CategoryClassifier.classify(path);

    switch (category) {
      case 'SMART_CONTRACT':
        return SmartContractValidator.validate(path, strippedContent, language);
      case 'FRONTEND':
        return FrontendValidator.validate(path, strippedContent, language);
      case 'CONFIGURATION':
        return ConfigurationValidator.validate(path, strippedContent, language);
      case 'DOCUMENTATION':
        return DocumentationValidator.validate(path, strippedContent, language);
      case 'ASSET':
        return AssetValidator.validate(path, strippedContent, language);
      default:
        return ConfigurationValidator.validate(path, strippedContent, language);
    }
  }

  /**
   * Backward-compatible parse method if needed for other code layers.
   */
  static parseAndNormalize(rawResponse: string, fallbackName: string = 'Smart Contract Workspace'): StructuredProjectOutput {
    // Return a structured schema placeholder, but standard operations should use direct extraction
    try {
      const cleaned = rawResponse.trim();
      if (cleaned.startsWith('{')) {
        const parsed = JSON.parse(cleaned);
        const proj = parsed.project || parsed;
        const files: ProjectFile[] = (proj.files || []).map((f: any) => {
          const p = String(f.path || '').trim();
          const c = String(f.content || '').trim();
          const l = String(f.language || '').trim();
          return ResponseParser.validateSource(p, c, l);
        });

        return {
          name: String(proj.name || fallbackName),
          description: String(proj.description || 'Production-ready project'),
          blockchain: String(proj.blockchain || proj.ecosystem || 'ethereum').toLowerCase(),
          language: String(proj.language || 'solidity').toLowerCase(),
          framework: String(proj.framework || 'foundry').toLowerCase(),
          contractType: String(proj.name || fallbackName),
          files
        };
      }
    } catch (e) {
      // Suppress and fallback
    }

    // Default basic structure
    return {
      name: fallbackName,
      description: 'Production-ready project',
      blockchain: 'ethereum',
      language: 'solidity',
      framework: 'foundry',
      contractType: fallbackName,
      files: []
    };
  }
}

