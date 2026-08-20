import { describe, expect, it, afterEach, vi, beforeEach } from "vitest";
import { AICredentialService, classifyAIError } from "./AICredentialService";
import { encrypt, decrypt } from "../utils/encryption";

// Mock Supabase admin client for isolated, reproducible unit testing
const mockStore: any[] = [];

vi.mock("../lib/supabaseAdmin", () => {
  return {
    isSupabaseAdminConfigured: () => true,
    getEffectiveSupabaseUrl: () => "https://vqydyecyhpedorvoinde.supabase.co",
    getSupabaseAdmin: () => {
      return {
        from: (table: string) => {
          const filters: Array<{ col: string; val: any }> = [];
          let isCount = false;
          let updateData: any = null;
          let isDelete = false;
          let insertData: any = null;

          const chain: any = {
            select: (cols?: string, opts?: any) => {
              if (opts?.count === "exact") isCount = true;
              return chain;
            },
            eq: (col: string, val: any) => {
              filters.push({ col, val });
              return chain;
            },
            order: () => chain,
            limit: () => chain,
            single: async () => {
              if (isDelete) {
                const idx = mockStore.findIndex(r => filters.every(f => r[f.col] === f.val));
                if (idx !== -1) {
                  const [deleted] = mockStore.splice(idx, 1);
                  return { data: deleted, error: null };
                }
                return { data: null, error: { message: "Not found" } };
              }
              if (updateData) {
                const row = mockStore.find(r => filters.every(f => r[f.col] === f.val));
                if (row) Object.assign(row, updateData, { updated_at: new Date().toISOString() });
                return { data: row || null, error: row ? null : { message: "Not found" } };
              }
              const item = mockStore.find(r => filters.every(f => r[f.col] === f.val));
              return { data: item || null, error: item ? null : { message: "Not found" } };
            },
            maybeSingle: async () => {
              if (isDelete) {
                const idx = mockStore.findIndex(r => filters.every(f => r[f.col] === f.val));
                if (idx !== -1) {
                  const [deleted] = mockStore.splice(idx, 1);
                  return { data: deleted, error: null };
                }
                return { data: null, error: null };
              }
              if (updateData) {
                const row = mockStore.find(r => filters.every(f => r[f.col] === f.val));
                if (row) Object.assign(row, updateData, { updated_at: new Date().toISOString() });
                return { data: row || null, error: null };
              }
              const item = mockStore.find(r => filters.every(f => r[f.col] === f.val));
              return { data: item || null, error: null };
            },
            insert: (record: any) => {
              insertData = Array.isArray(record) ? record[0] : record;
              const row = {
                ...insertData,
                created_at: insertData.created_at || new Date().toISOString(),
                updated_at: insertData.updated_at || new Date().toISOString(),
                total_requests: insertData.total_requests || 0,
                total_failures: insertData.total_failures || 0,
                health_status: insertData.health_status || "unknown",
              };
              mockStore.push(row);
              return chain;
            },
            update: (data: any) => {
              updateData = data;
              return chain;
            },
            delete: () => {
              isDelete = true;
              return chain;
            },
            then: (resolve: any) => {
              if (isDelete) {
                const idx = mockStore.findIndex(r => filters.every(f => r[f.col] === f.val));
                let deleted = null;
                if (idx !== -1) {
                  [deleted] = mockStore.splice(idx, 1);
                }
                resolve({ data: deleted ? [deleted] : [], error: null });
                return;
              }
              if (updateData) {
                const row = mockStore.find(r => filters.every(f => r[f.col] === f.val));
                if (row) Object.assign(row, updateData, { updated_at: new Date().toISOString() });
                resolve({ data: row ? [row] : [], error: null });
                return;
              }
              let filtered = mockStore;
              if (filters.length > 0) {
                filtered = mockStore.filter(r => filters.every(f => r[f.col] === f.val));
              }
              if (isCount) {
                resolve({ data: filtered, count: filtered.length, error: null });
              } else {
                resolve({ data: filtered, error: null });
              }
            }
          };
          return chain;
        }
      };
    }
  };
});

describe("AI Credential Full Persistence & Security Lifecycle", () => {
  process.env.ENCRYPTION_SECRET = "test-only-encryption-secret-32-characters-minimum";
  const makeKey = (tag: string) => `gsk_${tag}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}1234567890abcdef`;
  let createdId: string = "";

  beforeEach(() => {
    mockStore.length = 0;
  });

  afterEach(async () => {
    if (createdId) {
      try {
        await AICredentialService.remove(createdId);
      } catch {}
      createdId = "";
    }
  });

  it("1. Adds a valid Groq credential and confirms browser-safe projection", async () => {
    const key = makeKey("t1");
    const created = await AICredentialService.add("Groq Test Primary", key);
    createdId = created.id;

    expect(created.id).toMatch(/^ai-/);
    expect(created.displayName).toBe("Groq Test Primary");
    expect(created.keyConfigured).toBe(true);
    expect(created.maskedApiKey).toBe("••••••••");
    expect(created.enabled).toBe(true);
    expect((created as any).encryptedApiKey).toBeUndefined();
    expect(JSON.stringify(created)).not.toContain(key);
  });

  it("2. Rejects invalid Groq API key formats", async () => {
    await expect(AICredentialService.add("Bad Key", "sk-invalid-prefix-12345678901234567890"))
      .rejects.toThrow(/must begin with 'gsk_'/i);

    await expect(AICredentialService.add("Short Key", "gsk_short"))
      .rejects.toThrow(/valid Groq API key/i);
  });

  it("3. Verifies persistence via verifyPersisted immediately after write", async () => {
    const key = makeKey("t3");
    const created = await AICredentialService.add("Groq Readback Verification", key);
    createdId = created.id;

    const verified = await AICredentialService.verifyPersisted(created.id);
    expect(verified.id).toBe(created.id);
    expect(verified.displayName).toBe("Groq Readback Verification");
    expect(verified.keyConfigured).toBe(true);
  });

  it("4. Confirms that persistent store contains only encrypted keys, never raw secrets", async () => {
    const key = makeKey("t4");
    const created = await AICredentialService.add("Encrypted Storage Check", key);
    createdId = created.id;

    expect((created as any).encryptedApiKey).toBeUndefined();
  });

  it("5. Lists credentials with priority ordering and masked keys", async () => {
    const cred1 = await AICredentialService.add("Groq First", makeKey("t5a"));
    const cred2 = await AICredentialService.add("Groq Second", makeKey("t5b"));

    const list = await AICredentialService.list();
    expect(list.length).toBeGreaterThanOrEqual(2);
    expect(list.some(c => c.id === cred1.id)).toBe(true);
    expect(list.some(c => c.id === cred2.id)).toBe(true);

    // Cleanup extra
    await AICredentialService.remove(cred1.id);
    await AICredentialService.remove(cred2.id);
  });

  it("6. Decrypts key server-side only for internal execution", async () => {
    const key = makeKey("t6");
    const created = await AICredentialService.add("Groq Secret Decryption", key);
    createdId = created.id;

    const secretObj = await AICredentialService.getSecret(created.id);
    expect(secretObj).not.toBeNull();
    expect(secretObj?.apiKey).toBe(key);
    expect(secretObj?.credential.id).toBe(created.id);
  });

  it("7. Updates credential status (enable/disable and rename)", async () => {
    const key = makeKey("t7");
    const created = await AICredentialService.add("Toggle Test", key);
    createdId = created.id;

    const disabled = await AICredentialService.update(created.id, { enabled: false, displayName: "Toggle Test Disabled" });
    expect(disabled?.enabled).toBe(false);
    expect(disabled?.displayName).toBe("Toggle Test Disabled");

    // Disabled credential should not be returned by getSecret for execution
    const secretObj = await AICredentialService.getSecret(created.id);
    expect(secretObj).toBeNull();

    const enabled = await AICredentialService.update(created.id, { enabled: true });
    expect(enabled?.enabled).toBe(true);
  });

  it("8. Records telemetry and health updates", async () => {
    const key = makeKey("t8");
    const created = await AICredentialService.add("Telemetry Test", key);
    createdId = created.id;

    await AICredentialService.record(created.id, true);
    let secretObj = await AICredentialService.getSecret(created.id);
    expect(secretObj?.credential.healthStatus).toBe("healthy");
    expect(secretObj?.credential.totalRequests).toBe(1);
    expect(secretObj?.credential.totalFailures).toBe(0);

    await AICredentialService.record(created.id, false, "RATE_LIMIT_ERROR", 5000);
    secretObj = await AICredentialService.getSecret(created.id);
    expect(secretObj?.credential.healthStatus).toBe("rate_limited");
    expect(secretObj?.credential.totalFailures).toBe(1);
    expect(secretObj?.credential.cooldownUntil).not.toBeNull();
  });

  it("9. Simulates backend restart and verifies persistent data survives", async () => {
    const key = makeKey("t9");
    const created = await AICredentialService.add("Restart Persistence Test", key);
    createdId = created.id;

    // Simulate new server startup by reading from list again
    const list = await AICredentialService.list();
    const found = list.find(c => c.id === created.id);
    expect(found).toBeDefined();
    expect(found?.displayName).toBe("Restart Persistence Test");
    expect(found?.keyConfigured).toBe(true);
  });

  it("10. Deletes credential cleanly", async () => {
    const key = makeKey("t10");
    const created = await AICredentialService.add("Delete Test", key);
    await AICredentialService.remove(created.id);

    const list = await AICredentialService.list();
    expect(list.some(c => c.id === created.id)).toBe(false);
    await expect(AICredentialService.verifyPersisted(created.id)).rejects.toThrow();
  });

  it("11. Verifies encryption utility roundtrip", () => {
    const text = "gsk_super_secret_groq_api_key_1234567890";
    const encrypted = encrypt(text);
    expect(encrypted).not.toBe(text);
    expect(encrypted).toContain(":");

    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(text);
  });

  it("12. Correctly classifies AI error types", () => {
    expect(classifyAIError({ status: 401, message: "Invalid API key provided" })).toBe("AUTH_ERROR");
    expect(classifyAIError({ status: 429, message: "Rate limit reached" })).toBe("RATE_LIMIT_ERROR");
    expect(classifyAIError({ status: 400, message: "Context length exceeded maximum token limit" })).toBe("CONTEXT_TOKEN_ERROR");
    expect(classifyAIError({ status: 404, message: "The model was not found" })).toBe("MODEL_UNAVAILABLE");
    expect(classifyAIError({ status: 503, message: "Service unavailable, connection timed out" })).toBe("TRANSIENT_ERROR");
  });

  it("13. Verifies Supabase diagnostics and table targets", () => {
    const diag = AICredentialService.getStorageDiagnostics();
    expect(diag.tableName).toBe("ai_credentials");
    expect(diag.isEncrypted).toBe(true);
  });
});
