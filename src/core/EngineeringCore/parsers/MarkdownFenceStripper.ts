/**
 * MarkdownFenceStripper
 * Conservative AI Formatting Normalizer.
 * Responsibilities:
 * 1. Remove UTF-8 BOM & zero-width spaces
 * 2. Normalize CRLF -> LF
 * 3. Extract source code from outer/surrounding markdown code fences
 * 4. Remove clearly identifiable conversational preambles/postambles
 * 
 * Does NOT attempt to parse language syntax, modify valid code, balance braces,
 * or prepend code headers.
 */

export class MarkdownFenceStripper {
  /**
   * Normalize raw AI output into clean source text without mutating valid code semantics.
   */
  public static strip(content: string, path?: string): string {
    if (!content) return '';

    // 1. Remove BOM, zero-width characters, and normalize CRLF -> LF
    let cleaned = content
      .replace(/^\uFEFF/, '')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .trim();

    if (!cleaned) return '';

    const isMarkdownFile = path
      ? (path.toLowerCase().endsWith('.md') || path.toLowerCase().endsWith('.markdown'))
      : false;

    // Special handling for .md files: preserve internal markdown structure while stripping outer fence wrappers
    if (isMarkdownFile) {
      const outerMdMatch = /^\s*```(?:markdown|md)?\s*\n([\s\S]*?)\n\s*```\s*$/i.exec(cleaned);
      if (outerMdMatch && outerMdMatch[1]) {
        return outerMdMatch[1].trim();
      }
      return cleaned
        .replace(/^\s*```(?:markdown|md)?\s*\n?/i, '')
        .replace(/\n?\s*```\s*$/i, '')
        .trim();
    }

    // 2. Extract code if wrapped in outer markdown fence (e.g. ```solidity\n...\n```)
    const singleFenceRegex = /^(?:[^\n`]*\n)*?\s*```[a-zA-Z0-9_\-+#]*\s*\n([\s\S]*?)\n\s*```(?:\s*\n[^\n`]*)*$/;
    const fenceMatch = singleFenceRegex.exec(cleaned);
    if (fenceMatch && fenceMatch[1] !== undefined) {
      return fenceMatch[1].trim();
    }

    // 3. Fallback: Trim leading/trailing fence lines and conversational preamble/postamble
    const lines = cleaned.split('\n');
    let startIdx = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      if (/^```[a-zA-Z0-9_\-+#]*$/.test(line)) {
        startIdx = i + 1;
        break;
      }

      if (
        /^(?:here\s+is|here's|below\s+is|sure|certainly|this\s+file|the\s+following|i\s+have|here\s+are)\b/i.test(line) ||
        (line.endsWith(':') && !line.includes('{') && !line.includes(';') && !line.includes('('))
      ) {
        continue;
      }

      startIdx = i;
      break;
    }

    let endIdx = lines.length;
    for (let i = lines.length - 1; i >= startIdx; i--) {
      const line = lines[i].trim();
      if (!line) continue;

      if (line === '```') {
        endIdx = i;
        break;
      }

      if (
        /^(?:hope\s+this|let\s+me\s+know|note:|this\s+(?:contract|code|file)|to\s+compile|to\s+deploy|make\s+sure)\b/i.test(line)
      ) {
        endIdx = i;
        continue;
      }

      break;
    }

    return lines.slice(startIdx, endIdx).join('\n').trim();
  }
}
