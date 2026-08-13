import { MarkdownFenceStripper } from './MarkdownFenceStripper';
import { WhitespaceNormalizer } from './WhitespaceNormalizer';
import { UnicodeNormalizer } from './UnicodeNormalizer';
import { ResponseClassifier } from './ResponseClassifier';

export class LanguageExtractor {
  public static extractAndNormalize(content: string, path: string): string {
    if (!content) return '';

    // Run ResponseClassifier first (Bug 3)
    const classification = ResponseClassifier.classify(content, path);
    if (classification === 'STRUCTURED_JSON_METADATA') {
      throw new Error(`STRUCTURED_JSON_METADATA: AI returned JSON metadata instead of raw source code for ${path}`);
    }
    if (classification === 'PROVIDER_ERROR' || classification === 'RATE_LIMIT_ERROR' || classification === 'CONTEXT_TOKEN_ERROR') {
      throw new Error(`${classification}: AI returned a provider error instead of raw source code for ${path}`);
    }
    if (classification === 'EMPTY_RESPONSE') {
      throw new Error(`EMPTY_RESPONSE: AI returned empty response for ${path}`);
    }

    let result = UnicodeNormalizer.normalize(content);
    
    // First strip fences
    result = MarkdownFenceStripper.strip(result, path);

    const isJsonFile = path ? path.toLowerCase().endsWith('.json') : false;
    const isTomlFile = path ? path.toLowerCase().endsWith('.toml') : false;

    // JSON must NEVER be unwrapped into source (Bug 2)
    if (!isJsonFile && !isTomlFile) {
      const trimmed = result.trim();
      if (trimmed.startsWith('{') || (trimmed.startsWith('[') && !isTomlFile) || trimmed.includes('"content"') || trimmed.includes('"error":')) {
        throw new Error(`STRUCTURED_JSON_METADATA: JSON content rejected for source file ${path}`);
      }
    }

    result = MarkdownFenceStripper.strip(result, path);
    result = WhitespaceNormalizer.normalize(result);
    return result;
  }
}


