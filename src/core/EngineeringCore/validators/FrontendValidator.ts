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
      let workingContent = trimmedContent;
      const firstAngleIdx = workingContent.indexOf('<');
      if (firstAngleIdx > 0) {
        workingContent = workingContent.slice(firstAngleIdx).trim();
      }

      const lines = workingContent.split('\n');
      let firstTagLine = '';
      for (const l of lines) {
        const line = l.trim();
        if (!line || line.startsWith('<!--')) continue;
        firstTagLine = line.toLowerCase();
        break;
      }

      if (!firstTagLine.startsWith('<!doctype') && !firstTagLine.startsWith('<html')) {
        if (workingContent.startsWith('<')) {
          workingContent = `<!DOCTYPE html>\n<html lang="en">\n${workingContent}\n</html>`;
        } else if (workingContent.length > 0) {
          workingContent = `<!DOCTYPE html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>App</title>\n  </head>\n  <body>\n    <div id="root"></div>\n    ${workingContent}\n  </body>\n</html>`;
        } else {
          workingContent = `<!DOCTYPE html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>App</title>\n  </head>\n  <body>\n    <div id="root"></div>\n    <script type="module" src="/src/main.tsx"></script>\n  </body>\n</html>`;
        }
      }
      return {
        path: normalizedPath,
        content: workingContent,
        language: language || 'html'
      };
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
