export type ResponseClassification =
  | 'VALID_RAW_SOURCE'
  | 'MARKDOWN_WRAPPED_SOURCE'
  | 'STRUCTURED_JSON_METADATA'
  | 'PROVIDER_ERROR'
  | 'RATE_LIMIT_ERROR'
  | 'CONTEXT_TOKEN_ERROR'
  | 'EMPTY_RESPONSE'
  | 'UNKNOWN_RESPONSE';

export class ResponseClassifier {
  public static classify(rawResponse: string, expectedPath?: string): ResponseClassification {
    if (!rawResponse || !rawResponse.trim()) {
      return 'EMPTY_RESPONSE';
    }

    const trimmed = rawResponse.trim();

    // 1. Rate Limit Checks
    if (
      trimmed.includes('Rate limit reached') ||
      trimmed.includes('429 Rate limit') ||
      trimmed.includes('rate_limit_exceeded') ||
      trimmed.includes('tokens per day (TPD)') ||
      trimmed.includes('TPD:') ||
      trimmed.includes('RateLimitError') ||
      trimmed.includes('insufficient_quota')
    ) {
      return 'RATE_LIMIT_ERROR';
    }

    // 2. Context Token Limit Checks
    if (
      trimmed.includes('context_length_exceeded') ||
      trimmed.includes('maximum context length') ||
      trimmed.includes('token limit exceeded') ||
      trimmed.includes('prompt is too long') ||
      trimmed.includes('max_tokens')
    ) {
      return 'CONTEXT_TOKEN_ERROR';
    }

    // 3. Provider Error Text / Stack Trace Checks
    if (
      /^\s*(?:Error|Full Groq error|OpenAI error|401|403|429|500|502|503):/i.test(trimmed) ||
      trimmed.includes('Unauthorized') ||
      trimmed.includes('Invalid API key') ||
      trimmed.includes('Insufficient credits') ||
      trimmed.includes('at Function.generate') ||
      trimmed.includes('at OpenAI.makeStatusError')
    ) {
      return 'PROVIDER_ERROR';
    }

    // 4. JSON Object Inspection
    const isJsonPath = expectedPath ? expectedPath.toLowerCase().endsWith('.json') : false;

    if (trimmed.startsWith('{') || (trimmed.startsWith('```json') && trimmed.endsWith('```'))) {
      let jsonCandidate = trimmed;
      if (trimmed.startsWith('```json')) {
        jsonCandidate = trimmed.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();
      }

      try {
        const jsonObj = JSON.parse(jsonCandidate);
        if (jsonObj && typeof jsonObj === 'object') {
          // Provider Error inside JSON
          if (jsonObj.error || jsonObj.error_code || jsonObj.status === 429 || jsonObj.status === 401) {
            const errStr = JSON.stringify(jsonObj.error || jsonObj);
            if (errStr.toLowerCase().includes('rate') || errStr.toLowerCase().includes('quota') || jsonObj.status === 429) {
              return 'RATE_LIMIT_ERROR';
            }
            return 'PROVIDER_ERROR';
          }

          // Structured metadata function calls or schemas
          if (
            jsonObj.type === 'function' ||
            jsonObj.parameters ||
            jsonObj.properties ||
            jsonObj.schema ||
            (jsonObj.name && jsonObj.description && !jsonObj.files && !jsonObj.content)
          ) {
            if (isJsonPath && !jsonObj.type && !jsonObj.parameters) {
              return 'VALID_RAW_SOURCE';
            }
            return 'STRUCTURED_JSON_METADATA';
          }

          // If expected file is not JSON, returning JSON object is structured JSON or wrapped JSON
          if (!isJsonPath) {
            if (typeof jsonObj.content === 'string' || typeof jsonObj.code === 'string' || typeof jsonObj.source === 'string') {
              return 'STRUCTURED_JSON_METADATA';
            }
            return 'STRUCTURED_JSON_METADATA';
          }

          if (isJsonPath) {
            return 'VALID_RAW_SOURCE';
          }
        }
      } catch {
        // Not parseable as JSON
      }
    }

    // 5. Markdown Wrapped Check
    if (/^\s*```[a-zA-Z0-9_\-+#]*\n[\s\S]*?\n\s*```\s*$/i.test(trimmed)) {
      return 'MARKDOWN_WRAPPED_SOURCE';
    }

    return 'VALID_RAW_SOURCE';
  }
}
