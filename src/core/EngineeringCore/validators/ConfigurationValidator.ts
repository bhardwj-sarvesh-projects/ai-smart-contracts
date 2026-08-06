import { ProjectFile } from '../../../types';
import { MarkdownFenceStripper } from '../parsers/MarkdownFenceStripper';

export class ConfigurationValidator {
  public static validate(path: string, content: string, language: string): ProjectFile {
    const normalizedPath = path.replace(/\\/g, '/');
    const filename = normalizedPath.split('/').pop() || '';
    const lowerFilename = filename.toLowerCase();
    const ext = lowerFilename.includes('.') ? lowerFilename.split('.').pop()! : '';
    const trimmedContent = MarkdownFenceStripper.strip(content, path);

    if (!trimmedContent && lowerFilename !== '.env' && lowerFilename !== '.env.example') {
      throw new Error(`INVALID_AI_RESPONSE: Configuration file ${path} is empty`);
    }

    if (ext === 'json') {
      try {
        JSON.parse(trimmedContent);
      } catch (e: any) {
        throw new Error(`INVALID_AI_RESPONSE: JSON configuration file ${path} is invalid JSON: ${e.message}`);
      }
    } else if (ext === 'toml') {
      const hasSections = trimmedContent.includes('[') || trimmedContent.includes('=');
      if (!hasSections) {
        throw new Error(`INVALID_AI_RESPONSE: TOML file ${path} does not contain valid key-value pairs or headers`);
      }
    } else if (ext === 'yaml' || ext === 'yml') {
      const hasYamlStructure = trimmedContent.includes(':') || trimmedContent.includes('- ');
      if (!hasYamlStructure) {
        throw new Error(`INVALID_AI_RESPONSE: YAML file ${path} does not contain valid YAML formatting`);
      }
    } else if (lowerFilename === '.env' || lowerFilename === '.env.example') {
      if (trimmedContent.length > 0 && !trimmedContent.includes('=') && !trimmedContent.startsWith('#')) {
        throw new Error(`INVALID_AI_RESPONSE: Environment configuration file ${path} does not contain valid key-value definitions`);
      }
    }

    return {
      path: normalizedPath,
      content: trimmedContent,
      language: language || (ext === 'json' ? 'json' : ext === 'toml' ? 'toml' : (ext === 'yaml' || ext === 'yml') ? 'yaml' : 'plaintext')
    };
  }
}
