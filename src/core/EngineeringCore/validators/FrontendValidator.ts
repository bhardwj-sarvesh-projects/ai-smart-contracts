import { ProjectFile } from '../../../types';
import { MarkdownFenceStripper } from '../parsers/MarkdownFenceStripper';

export class FrontendValidator {
  public static validate(path: string, content: string, language: string): ProjectFile {
    const normalizedPath = path.replace(/\\/g, '/');
    const filename = normalizedPath.split('/').pop() || '';
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const trimmedContent = MarkdownFenceStripper.strip(content, path);

    if (!trimmedContent) {
      throw new Error(`INVALID_AI_RESPONSE: Frontend file ${path} is empty`);
    }

    if (ext === 'html') {
      // Validate HTML syntax
      const lines = trimmedContent.split('\n');
      let firstTagLine = '';
      for (const l of lines) {
        const line = l.trim();
        if (!line || line.startsWith('<!--')) continue;
        firstTagLine = line.toLowerCase();
        break;
      }

      if (!firstTagLine.startsWith('<!doctype') && !firstTagLine.startsWith('<html')) {
        throw new Error(`INVALID_AI_RESPONSE: HTML file ${path} must begin with <!DOCTYPE or <html`);
      }
    } else if (['jsx', 'tsx', 'js', 'ts'].includes(ext)) {
      // Reject if it is valid JSON
      if (trimmedContent.trim().startsWith('{')) {
        try {
          JSON.parse(trimmedContent.trim());
          throw new Error(`INVALID_AI_RESPONSE: Script file ${path} contains JSON metadata instead of executable code`);
        } catch (e: any) {
          if (e.message.includes('contains JSON metadata')) {
            throw e;
          }
          // Not valid JSON, which is expected for code
        }
      }

      // Validate React / TypeScript / JavaScript syntax presence
      const hasStatements = 
        trimmedContent.includes('import ') ||
        trimmedContent.includes('export ') ||
        trimmedContent.includes('function') ||
        trimmedContent.includes('const ') ||
        trimmedContent.includes('let ') ||
        trimmedContent.includes('var ') ||
        trimmedContent.includes('class ') ||
        trimmedContent.includes('interface ') ||
        trimmedContent.includes('type ') ||
        trimmedContent.includes('<') ||
        trimmedContent.includes('return') ||
        trimmedContent.includes('describe(') ||
        trimmedContent.includes('describe (') ||
        trimmedContent.includes('it(') ||
        trimmedContent.includes('it (') ||
        trimmedContent.includes('test(') ||
        trimmedContent.includes('test (') ||
        trimmedContent.includes('console.') ||
        trimmedContent.includes('require(') ||
        trimmedContent.includes('expect(') ||
        trimmedContent.includes('assert');

      if (!hasStatements && trimmedContent.length < 20) {
        throw new Error(`INVALID_AI_RESPONSE: Script file ${path} does not contain valid JavaScript/TypeScript code`);
      }
    } else if (['css', 'scss'].includes(ext)) {
      // Validate CSS / SCSS syntax rules
      const hasCssRules = trimmedContent.includes('{') || trimmedContent.includes(':') || trimmedContent.startsWith('@import') || trimmedContent.startsWith('@tailwind');
      if (!hasCssRules) {
        throw new Error(`INVALID_AI_RESPONSE: CSS file ${path} does not contain valid style rules`);
      }
    }

    return {
      path: normalizedPath,
      content: trimmedContent,
      language: language || (ext === 'html' ? 'html' : ['css', 'scss'].includes(ext) ? 'css' : ['ts', 'tsx'].includes(ext) ? 'typescript' : 'javascript')
    };
  }
}
