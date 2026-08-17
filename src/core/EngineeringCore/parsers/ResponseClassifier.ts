export type ResponseClassification =
  | 'VALID_RAW_SOURCE'
  | 'MARKDOWN_WRAPPED_SOURCE'
  | 'STRUCTURED_JSON_METADATA'
  | 'PROVIDER_ERROR'
  | 'RATE_LIMIT_ERROR'
  | 'CONTEXT_TOKEN_ERROR'
  | 'EMPTY_RESPONSE'
  | 'UNKNOWN_RESPONSE';

function looksLikeTransportError(text: string): boolean {
  const value = text.trim();
  if (/^\s*(?:Error|TypeError|Full Groq error|OpenAI error):/i.test(value)) return true;
  if (/^(?:401|403|429|500|502|503)\s*(?:[:\-]|$)/i.test(value)) return true;
  if (/at\s+(?:Function\.|OpenAI\.|process\.)/i.test(value) && /\n\s*at\s+/i.test(value)) return true;
  return false;
}

export class ResponseClassifier {
  public static classify(rawResponse: string, expectedPath?: string): ResponseClassification {
    if (!rawResponse || !rawResponse.trim()) return 'EMPTY_RESPONSE';
    const trimmed = rawResponse.trim();
    const lower = trimmed.toLowerCase();

    // Transport/provider failures are recognized only when the response has an
    // error-shaped structure. Never classify source code by searching for words
    // such as "Unauthorized" or "Invalid" because those are valid Solidity,
    // Rust, Move and TypeScript identifiers/messages.
    if (
      /\b429\b/.test(lower) && /rate[_ -]?limit|too many requests|quota/.test(lower)
      || /rate[_ -]?limit[_ -]?exceeded/.test(lower)
      || /tokens per day|tpm|tpd/.test(lower) && /exceeded|limit/.test(lower)
    ) return 'RATE_LIMIT_ERROR';

    if (
      /context[_ -]?length[_ -]?exceeded/.test(lower)
      || /maximum context length/.test(lower)
      || /prompt is too long/.test(lower)
      || /max[_ -]?tokens/.test(lower) && /exceed|limit|maximum/.test(lower)
    ) return 'CONTEXT_TOKEN_ERROR';

    if (looksLikeTransportError(trimmed)) return 'PROVIDER_ERROR';

    // JSON inspection is only authoritative when the response itself is valid
    // JSON. A normal source file containing JSON-like strings must not be treated
    // as a provider error.
    const isJsonPath = !!expectedPath && expectedPath.toLowerCase().endsWith('.json');
    if (trimmed.startsWith('{') || (trimmed.startsWith('```json') && trimmed.endsWith('```'))) {
      let candidate = trimmed;
      if (candidate.startsWith('```json')) candidate = candidate.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();
      try {
        const obj = JSON.parse(candidate);
        if (obj && typeof obj === 'object') {
          const status = Number((obj as any).status || (obj as any).statusCode || 0);
          const errorText = JSON.stringify((obj as any).error || (obj as any).message || obj).toLowerCase();
          if (status === 429 || /rate[_ -]?limit|quota|too many requests/.test(errorText)) return 'RATE_LIMIT_ERROR';
          if ((status === 401 || status === 403) && ((obj as any).error || (obj as any).error_code || (obj as any).statusCode)) return 'PROVIDER_ERROR';

          if (isJsonPath) return 'VALID_RAW_SOURCE';
          if (typeof (obj as any).content === 'string' || typeof (obj as any).code === 'string' || typeof (obj as any).source === 'string') return 'STRUCTURED_JSON_METADATA';
          if ((obj as any).files || (obj as any).audit || (obj as any).validationReport || (obj as any).name) return 'STRUCTURED_JSON_METADATA';
          return 'STRUCTURED_JSON_METADATA';
        }
      } catch {
        // Not JSON; continue with source classification.
      }
    }

    if (/^\s*```[a-zA-Z0-9_\-+#]*\n[\s\S]*?\n\s*```\s*$/i.test(trimmed)) return 'MARKDOWN_WRAPPED_SOURCE';
    return 'VALID_RAW_SOURCE';
  }
}
