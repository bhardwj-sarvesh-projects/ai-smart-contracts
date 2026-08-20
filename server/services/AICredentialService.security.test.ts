import { describe, expect, it } from "vitest";
import { AICredentialService } from "./AICredentialService";
import { ProviderFactory } from "../providers/ProviderFactory";

describe("AI credential security boundary", () => {
  process.env.ENCRYPTION_SECRET = "test-only-encryption-secret-32-characters-minimum";
  it("never exposes encrypted credential material in the public projection", () => {
    const publicCredential = AICredentialService.toPublic({
      id: "groq-test",
      provider: "groq",
      providerLabel: "Groq",
      model: "openai/gpt-oss-120b",
      routingGroup: "architecture",
      routingGroupLabel: "Architecture & Repository Analysis",
      baseUrl: "https://api.groq.com/openai/v1",
      displayName: "Test",
      encryptedApiKey: "ENCRYPTED_gsk_SUPER_SECRET",
      enabled: true,
      priority: 1,
      healthStatus: "unknown",
      totalRequests: 0,
      totalFailures: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    expect(publicCredential.maskedApiKey).toBe("••••••••");
    expect(publicCredential.keyConfigured).toBe(true);
    expect(JSON.stringify(publicCredential)).not.toContain("gsk_");
    expect(JSON.stringify(publicCredential)).not.toContain("ENCRYPTED_");
    expect((publicCredential as any).encryptedApiKey).toBeUndefined();
  });

  it("rejects direct provider construction", () => {
    expect(() => ProviderFactory.getProvider({ apiKey: "gsk_should_never_be_used" })).toThrow(
      "Direct provider access is disabled"
    );
  });
});
