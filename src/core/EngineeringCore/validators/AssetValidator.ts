import { ProjectFile } from '../../../types';
import { MarkdownFenceStripper } from '../parsers/MarkdownFenceStripper';

export class AssetValidator {
  public static validate(path: string, content: string, language: string): ProjectFile {
    const normalizedPath = path.replace(/\\/g, '/');
    const filename = normalizedPath.split('/').pop() || '';
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const trimmedContent = MarkdownFenceStripper.strip(content, path);

    if (ext === 'svg') {
      if (!trimmedContent.toLowerCase().includes('<svg') || !trimmedContent.toLowerCase().includes('</svg>')) {
        throw new Error(`INVALID_AI_RESPONSE: SVG asset ${path} does not contain valid XML SVG tags`);
      }
    } else if (ext === 'webmanifest') {
      try {
        JSON.parse(trimmedContent);
      } catch (e: any) {
        throw new Error(`INVALID_AI_RESPONSE: Webmanifest asset ${path} is invalid JSON: ${e.message}`);
      }
    } else {
      if (!trimmedContent) {
        throw new Error(`INVALID_AI_RESPONSE: Static asset ${path} is empty`);
      }
    }

    return {
      path: normalizedPath,
      content: trimmedContent,
      language: language || (ext === 'svg' ? 'svg' : ext === 'webmanifest' ? 'json' : 'plaintext')
    };
  }
}
