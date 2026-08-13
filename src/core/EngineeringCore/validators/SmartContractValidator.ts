import { ProjectFile } from '../../../types';
import { MarkdownFenceStripper } from '../parsers/MarkdownFenceStripper';

export class SmartContractValidator {
  public static validate(path: string, content: string, language: string): ProjectFile {
    const normalizedPath = path.replace(/\\/g, '/');
    const filename = normalizedPath.split('/').pop() || '';
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const trimmedContent = MarkdownFenceStripper.strip(content, path);

    // Placeholder check
    const placeholderRegex = /^(contract|token|nft|smartcontract|workspace|contract_\d+|token_\d+|nft_\d+)\.sol$/i;
    const indexPlaceholderRegex = /_[1-9]\.sol$/i;
    if (placeholderRegex.test(filename) || indexPlaceholderRegex.test(filename)) {
      throw new Error(`INVALID_AI_RESPONSE: Placeholder filename rejected: ${filename}`);
    }

    if (ext === 'sol') {
      const lines = trimmedContent.split('\n');
      let foundPragma = false;
      let nonCommentLinesChecked = 0;
      let inMultiComment = false;

      for (const rawLine of lines) {
        if (nonCommentLinesChecked >= 10) break;
        let line = rawLine.trim();
        if (!line) continue;

        if (inMultiComment) {
          const endCommentIdx = line.indexOf('*/');
          if (endCommentIdx !== -1) {
            inMultiComment = false;
            line = line.substring(endCommentIdx + 2).trim();
            if (!line) continue;
          } else {
            continue;
          }
        }

        while (line.startsWith('/*')) {
          const endCommentIdx = line.indexOf('*/');
          if (endCommentIdx !== -1) {
            line = line.substring(endCommentIdx + 2).trim();
          } else {
            inMultiComment = true;
            line = '';
            break;
          }
        }

        if (!line) continue;
        if (line.startsWith('//')) {
          continue;
        }

        nonCommentLinesChecked++;
        if (line.startsWith('pragma solidity')) {
          foundPragma = true;
          break;
        }
      }

      if (!foundPragma) {
        throw new Error(`INVALID_AI_RESPONSE: Solidity file ${path} must include pragma solidity in the first 10 non-comment lines`);
      }
      if (trimmedContent.startsWith('{') || trimmedContent.startsWith('[') || trimmedContent.includes('"files":')) {
        throw new Error(`INVALID_AI_RESPONSE: Solidity file ${path} contains JSON leakage`);
      }
      if (trimmedContent.includes('[profile.') || trimmedContent.includes('[package]')) {
        throw new Error(`INVALID_AI_RESPONSE: Solidity file ${path} contains TOML leakage`);
      }
      if (/^[A-Z0-9_]+=\s*\S+/m.test(trimmedContent) && !trimmedContent.includes('function ') && !trimmedContent.includes('contract ')) {
        throw new Error(`INVALID_AI_RESPONSE: Solidity file ${path} contains ENV variables leakage`);
      }
      if (trimmedContent.toLowerCase().includes('readme') || trimmedContent.includes('# README')) {
        throw new Error(`INVALID_AI_RESPONSE: Solidity file ${path} contains README/Markdown leakage`);
      }
    } else if (ext === 'rs') {
      if (!trimmedContent.includes('anchor_lang') && !trimmedContent.includes('use') && !trimmedContent.includes('pub fn') && !trimmedContent.includes('fn ')) {
        throw new Error(`INVALID_AI_RESPONSE: Rust file ${path} must contain 'anchor_lang', 'use', or valid Rust definitions`);
      }
    } else if (ext === 'move') {
      const cleanMove = trimmedContent.replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, '').trim();
      if (!cleanMove.startsWith('module') && !cleanMove.startsWith('///') && !cleanMove.startsWith('//')) {
        throw new Error(`INVALID_AI_RESPONSE: Move file ${path} must begin with 'module'`);
      }
    }

    return {
      path: normalizedPath,
      content: trimmedContent,
      language: language || (ext === 'sol' ? 'solidity' : ext === 'rs' ? 'rust' : 'move')
    };
  }
}
