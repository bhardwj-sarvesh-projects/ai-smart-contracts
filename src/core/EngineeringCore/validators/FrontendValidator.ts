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

    // Check for raw markdown fences leakage
    if (trimmedContent.startsWith('```') && trimmedContent.endsWith('```')) {
      throw new Error(`INVALID_AI_RESPONSE: Frontend file ${path} contains unextracted code fence wrappers`);
    }

    if (ext === 'html') {
      // Validate HTML syntax
      const hasDoctype = trimmedContent.toLowerCase().includes('<!doctype html');
      const hasTags = /<[a-z0-9]+[^>]*>/i.test(trimmedContent);
      if (!hasTags && !hasDoctype) {
        throw new Error(`INVALID_AI_RESPONSE: HTML file ${path} does not contain valid HTML tags or DOCTYPE`);
      }
      // Check unclosed markdown fence
      if (trimmedContent.includes('```')) {
        throw new Error(`INVALID_AI_RESPONSE: HTML file ${path} contains raw markdown code fences`);
      }
    } else if (['jsx', 'tsx', 'js', 'ts'].includes(ext)) {
      // Validate React / TypeScript / JavaScript syntax
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
        trimmedContent.includes('return');

      if (!hasStatements) {
        throw new Error(`INVALID_AI_RESPONSE: Script file ${path} does not contain valid JavaScript/TypeScript code`);
      }

      // Check bracket balance basics
      let braceCount = 0;
      for (const char of trimmedContent) {
        if (char === '{') braceCount++;
        if (char === '}') braceCount--;
      }
      if (braceCount !== 0) {
        throw new Error(`INVALID_AI_RESPONSE: Script file ${path} has unmatched curly braces (balance: ${braceCount})`);
      }
    } else if (['css', 'scss'].includes(ext)) {
      // Validate CSS / SCSS syntax
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
