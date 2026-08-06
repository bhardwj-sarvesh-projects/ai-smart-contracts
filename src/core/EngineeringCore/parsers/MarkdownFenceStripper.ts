/**
 * MarkdownFenceStripper
 * Preprocessing engine to strip all markdown code fences, leading/trailing explanations,
 * markdown headings, bullet lists, and AI commentary from AI responses
 * BEFORE validation layers process raw source code.
 */

export class MarkdownFenceStripper {
  /**
   * Auto Cleanup engine to strip markdown code fences, leading/trailing explanations,
   * markdown headings, bullet lists, and AI commentary from source files.
   * If the file is a markdown file (.md), preserves markdown structure while removing accidental outer fences.
   */
  public static strip(content: string, path?: string): string {
    if (!content) return '';

    let cleaned = content.trim();

    // Remove BOM and zero-width characters
    cleaned = cleaned.replace(/^\uFEFF/, '').replace(/[\u200B-\u200D\uFEFF]/g, '');

    const isMarkdownFile = path ? (path.toLowerCase().endsWith('.md') || path.toLowerCase().endsWith('.markdown')) : false;

    // 1. If triple backticks exist in non-markdown code files, extract code inside code blocks
    if (!isMarkdownFile && content.includes('```')) {
      const fenceMatchRegex = /```[a-zA-Z0-9_\-]*\s*\n([\s\S]*?)\n```/g;
      const matches: string[] = [];
      let match: RegExpExecArray | null;

      while ((match = fenceMatchRegex.exec(content)) !== null) {
        if (match[1] && match[1].trim()) {
          matches.push(match[1].trim());
        }
      }

      if (matches.length > 0) {
        cleaned = matches.join('\n\n').trim();
      } else {
        // Fallback: strip line-by-line fences
        cleaned = cleaned
          .replace(/^\s*```[a-zA-Z0-9_\-]*\s*\n?/gm, '')
          .replace(/\n?\s*```\s*$/gm, '')
          .replace(/^```[a-zA-Z0-9_\-]*$/gm, '')
          .replace(/^```$/gm, '')
          .trim();
      }
    } else if (isMarkdownFile) {
      // 1. Remove leading AI commentary before the first markdown heading (#), list item, or code fence
      const lines = cleaned.split('\n');
      let startIdx = 0;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('#') || line.startsWith('```') || line.startsWith('- ') || line.startsWith('* ') || line.startsWith('1.')) {
          startIdx = i;
          break;
        }
      }
      cleaned = lines.slice(startIdx).join('\n').trim();

      // 2. If the entire content is wrapped in outer markdown fences (```markdown ... ``` or ``` ... ```):
      const outerFenceRegex = /^\s*```(?:markdown|md)?\s*\n([\s\S]*?)\n```\s*$/i;
      const match = outerFenceRegex.exec(cleaned);
      if (match && match[1]) {
        cleaned = match[1].trim();
      } else {
        const updatedLines = cleaned.split('\n');
        if (updatedLines.length > 0 && /^\s*```(?:markdown|md)?\s*$/i.test(updatedLines[0])) {
          updatedLines.shift();
          if (updatedLines.length > 0 && /^\s*```\s*$/i.test(updatedLines[updatedLines.length - 1])) {
            updatedLines.pop();
          }
          cleaned = updatedLines.join('\n').trim();
        }
      }
      return cleaned;
    }

    // 2. Non-Markdown Code Files: Clean leading explanations/prose/headings/bullet points
    const lines = cleaned.split('\n');
    let startIdx = 0;

    const ext = path ? path.split('.').pop()?.toLowerCase() || '' : '';

    // Determine code start line
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      let isCodeStart = false;

      if (ext === 'sol') {
        isCodeStart =
          line.startsWith('//') ||
          line.startsWith('/*') ||
          line.startsWith('pragma solidity') ||
          line.startsWith('import') ||
          line.startsWith('contract') ||
          line.startsWith('interface') ||
          line.startsWith('library') ||
          line.startsWith('abstract') ||
          line.startsWith('using') ||
          line.startsWith('type') ||
          line.startsWith('enum') ||
          line.startsWith('struct');
      } else if (ext === 'rs') {
        isCodeStart =
          line.startsWith('//') ||
          line.startsWith('/*') ||
          line.startsWith('use') ||
          line.startsWith('#[') ||
          line.startsWith('pub') ||
          line.startsWith('fn') ||
          line.startsWith('struct') ||
          line.startsWith('enum') ||
          line.startsWith('mod') ||
          line.startsWith('impl');
      } else if (ext === 'move') {
        isCodeStart =
          line.startsWith('//') ||
          line.startsWith('/*') ||
          line.startsWith('///') ||
          line.startsWith('module') ||
          line.startsWith('use') ||
          line.startsWith('struct') ||
          line.startsWith('fun') ||
          line.startsWith('public');
      } else if (ext === 'cairo') {
        isCodeStart =
          line.startsWith('//') ||
          line.startsWith('/*') ||
          line.startsWith('#[') ||
          line.startsWith('mod') ||
          line.startsWith('use') ||
          line.startsWith('fn') ||
          line.startsWith('struct') ||
          line.startsWith('trait');
      } else if (['ts', 'tsx', 'js', 'jsx'].includes(ext)) {
        isCodeStart =
          line.startsWith('//') ||
          line.startsWith('/*') ||
          line.startsWith('import') ||
          line.startsWith('export') ||
          line.startsWith('interface') ||
          line.startsWith('type') ||
          line.startsWith('const') ||
          line.startsWith('let') ||
          line.startsWith('var') ||
          line.startsWith('function') ||
          line.startsWith('class') ||
          line.startsWith("'use strict'") ||
          line.startsWith('"use strict"');
      } else if (ext === 'json') {
        isCodeStart = line.startsWith('{') || line.startsWith('[');
      } else if (ext === 'toml') {
        isCodeStart = line.startsWith('[') || line.startsWith('#') || /^[a-zA-Z0-9_\-]+\s*=/i.test(line);
      } else if (ext === 'yaml' || ext === 'yml') {
        isCodeStart = line.startsWith('---') || line.startsWith('#') || /^[a-zA-Z0-9_\-]+\s*:/i.test(line);
      } else {
        // Generic code fallback: if line doesn't start with '# ', '## ', '- ', '* ', or 'Here is'
        isCodeStart = !line.startsWith('#') && !line.startsWith('- ') && !line.startsWith('* ') && !/^here is/i.test(line) && !/^this file/i.test(line);
      }

      if (isCodeStart) {
        startIdx = i;
        break;
      }
    }

    const codeLines = lines.slice(startIdx);

    // 3. Clean trailing commentary after code ends
    let endIdx = codeLines.length;

    for (let i = codeLines.length - 1; i >= 0; i--) {
      const line = codeLines[i].trim();
      if (!line) continue;

      const isTrailingProse =
        line.startsWith('# ') ||
        line.startsWith('## ') ||
        line.startsWith('### ') ||
        line.startsWith('- ') ||
        line.startsWith('* ') ||
        /^hope this/i.test(line) ||
        /^this contract/i.test(line) ||
        /^note:/i.test(line) ||
        /^to compile/i.test(line) ||
        /^to deploy/i.test(line) ||
        line === '```';

      if (isTrailingProse) {
        endIdx = i;
      } else {
        break;
      }
    }

    const finalLines = codeLines.slice(0, endIdx);
    let result = finalLines.join('\n').trim();

    // Final safety check to strip stray triple backtick lines
    result = result.replace(/^```[a-zA-Z0-9_\-]*\n?/gm, '').replace(/\n?```$/gm, '').trim();

    return result;
  }
}

