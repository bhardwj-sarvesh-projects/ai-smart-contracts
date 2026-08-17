import { describe, expect, it } from 'vitest';
import { ResponseClassifier } from './ResponseClassifier';

describe('ResponseClassifier', () => {
  it('does not classify Solidity Unauthorized custom errors as provider failures', () => {
    const source = `// SPDX-License-Identifier: MIT\npragma solidity ^0.8.20;\ncontract Test { error Unauthorized(); function x() external { revert Unauthorized(); } }`;
    expect(ResponseClassifier.classify(source, 'contracts/Test.sol')).toBe('VALID_RAW_SOURCE');
  });

  it('does not classify normal source containing invalid/unauthorized words as provider errors', () => {
    const source = `const message = "Invalid API key";\nfunction Unauthorized() { return; }`;
    expect(ResponseClassifier.classify(source, 'src/example.ts')).toBe('VALID_RAW_SOURCE');
  });

  it('recognizes a structured rate-limit response', () => {
    expect(ResponseClassifier.classify('{"status":429,"error":"rate limit exceeded"}', 'response.json')).toBe('RATE_LIMIT_ERROR');
  });

  it('recognizes a stack-shaped provider error', () => {
    expect(ResponseClassifier.classify('Error: Unauthorized\n    at OpenAI.makeStatusError (client.js:1:2)', 'response.txt')).toBe('PROVIDER_ERROR');
  });
});
