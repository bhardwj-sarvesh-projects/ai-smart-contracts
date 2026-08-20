/**
 * Server-side secret redaction.
 * Never log or return credential material, bearer tokens, private keys, or common API-key formats.
 */
export function redactSecrets(input: unknown): string {
  let text = String(input ?? "");

  // Groq / OpenAI style API keys.
  text = text.replace(/\bgsk_[A-Za-z0-9_-]{10,}\b/g, "[REDACTED_GROQ_KEY]");
  text = text.replace(/\bsk-[A-Za-z0-9_-]{10,}\b/g, "[REDACTED_OPENAI_KEY]");

  // PEM private keys.
  text = text.replace(/-----BEGIN PRIVATE KEY-----[\s\S]*?-----END PRIVATE KEY-----/g, "[REDACTED_PRIVATE_KEY]");

  // Bearer tokens.
  text = text.replace(/Bearer\s+[A-Za-z0-9._-]{20,}/gi, "Bearer [REDACTED_TOKEN]");

  // Common secret assignments in JSON, logs, query strings, or objects.
  text = text.replace(
    /(["']?(?:api[_-]?key|private[_-]?key|client[_-]?secret|secret|password|token|authorization)["']?\s*[:=]\s*["']?)([^"'\s,}]{8,})/gi,
    "$1[REDACTED]"
  );

  return text;
}

export function safeErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && !(error instanceof Error)) {
    const obj = error as any;
    const msg = obj.message || obj.error_description || obj.error || JSON.stringify(obj);
    return redactSecrets(typeof msg === 'string' ? msg : JSON.stringify(msg)).slice(0, 1000);
  }
  const message = error instanceof Error ? error.message : String(error ?? "Unknown error");
  return redactSecrets(message).slice(0, 1000);
}
