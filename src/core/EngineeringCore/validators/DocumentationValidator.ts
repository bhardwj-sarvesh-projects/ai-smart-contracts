import { ProjectFile } from '../../../types';
import { MarkdownFenceStripper } from '../parsers/MarkdownFenceStripper';

export class DocumentationValidator {
  public static validate(path: string, content: string, language: string): ProjectFile {
    const normalizedPath = path.replace(/\\/g, '/');
    const trimmedContent = MarkdownFenceStripper.strip(content, path);

    if (!trimmedContent) {
      throw new Error(`INVALID_AI_RESPONSE: Documentation file ${path} is empty`);
    }

    const hasMarkdownFormatting =
      trimmedContent.includes('#') ||
      trimmedContent.includes('*') ||
      trimmedContent.includes('-') ||
      trimmedContent.includes('`') ||
      trimmedContent.includes('|') ||
      trimmedContent.length > 10;

    if (!hasMarkdownFormatting) {
      throw new Error(`INVALID_AI_RESPONSE: Markdown file ${path} does not contain valid markdown formatting`);
    }

    return {
      path: normalizedPath,
      content: trimmedContent,
      language: language || 'markdown'
    };
  }
}
