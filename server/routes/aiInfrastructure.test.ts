import { describe, expect, it, beforeEach, beforeAll, afterAll, vi } from "vitest";
import http from "http";
import express from "express";
import aiInfrastructureRouter from "./aiInfrastructure";
import { AICredentialService } from "../services/AICredentialService";

// Mock Supabase admin client for isolated, reproducible route testing
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

const app = express();
app.use(express.json());

// Mock auth for router test
app.use((req, _res, next) => {
  (req as any).user = {
    uid: "admin-test-uid",
    id: "admin-test-uid",
    email: "sarveshtiwarisarvesh@gmail.com",
    role: "admin",
  };
  next();
});

app.use("/api/admin/ai", aiInfrastructureRouter);

// Catch-all 404 for /api
app.use("/api", (req, res) => {
  res.status(404).json({ success: false, error: `Not found: ${req.path}` });
});

describe("Admin AI Infrastructure HTTP API", () => {
  let server: http.Server;
  let baseUrl: string;
  const sampleKey = "gsk_groqHttpTestApiSecretKey998877665544332211";
  let createdId = "";

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", () => {
        const addr = server.address() as any;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  beforeEach(async () => {
    if (createdId) {
      try {
        await AICredentialService.remove(createdId);
      } catch {}
      createdId = "";
    }
  });

  it("GET /api/admin/ai/policy returns locked policy with 0.1 temp and 2000 max tokens", async () => {
    const res = await fetch(`${baseUrl}/api/admin/ai/policy`, {
      headers: { Authorization: "Bearer admin-test-token" },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/json/);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.temperature).toBe(0.1);
    expect(body.globalMaxOutputTokens).toBe(2000);
    expect(body.editable).toBe(false);
  });

  it("GET /api/admin/ai/credentials returns JSON with storage and list", async () => {
    const res = await fetch(`${baseUrl}/api/admin/ai/credentials`, {
      headers: { Authorization: "Bearer admin-test-token" },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/json/);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.credentials)).toBe(true);
  });

  it("POST /api/admin/ai/credentials rejects non-gsk API keys with HTTP 400 JSON", async () => {
    const res = await fetch(`${baseUrl}/api/admin/ai/credentials`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer admin-test-token" },
      body: JSON.stringify({ displayName: "Bad", apiKey: "sk_invalid_prefix_12345678901234567890" }),
    });

    expect(res.status).toBe(400);
    expect(res.headers.get("content-type")).toMatch(/json/);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/must begin with 'gsk_'/i);
  });

  it("POST /api/admin/ai/credentials persists and returns 201 with verified credential", async () => {
    const res = await fetch(`${baseUrl}/api/admin/ai/credentials`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer admin-test-token" },
      body: JSON.stringify({ displayName: "Groq Production 01", apiKey: sampleKey }),
    });

    expect(res.status).toBe(201);
    expect(res.headers.get("content-type")).toMatch(/json/);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.credential).toBeDefined();
    expect(body.credential.displayName).toBe("Groq Production 01");
    expect(body.credential.keyConfigured).toBe(true);
    expect(body.credential.maskedApiKey).toBe("••••••••");
    expect(body.credential.encryptedApiKey).toBeUndefined();

    createdId = body.credential.id;

    // Follow-up GET confirms credential exists
    const getRes = await fetch(`${baseUrl}/api/admin/ai/credentials`, {
      headers: { Authorization: "Bearer admin-test-token" },
    });
    expect(getRes.status).toBe(200);
    const getBody = await getRes.json();
    const found = getBody.credentials.find((c: any) => c.id === createdId);
    expect(found).toBeDefined();
    expect(found.displayName).toBe("Groq Production 01");

    // Single item GET /api/admin/ai/credentials/:id
    const singleRes = await fetch(`${baseUrl}/api/admin/ai/credentials/${createdId}`, {
      headers: { Authorization: "Bearer admin-test-token" },
    });
    expect(singleRes.status).toBe(200);
    const singleBody = await singleRes.json();
    expect(singleBody.credential.id).toBe(createdId);

    // PATCH /api/admin/ai/credentials/:id (disable)
    const patchRes = await fetch(`${baseUrl}/api/admin/ai/credentials/${createdId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: "Bearer admin-test-token" },
      body: JSON.stringify({ enabled: false, displayName: "Groq Disabled" }),
    });
    expect(patchRes.status).toBe(200);
    const patchBody = await patchRes.json();
    expect(patchBody.credential.enabled).toBe(false);

    // DELETE /api/admin/ai/credentials/:id
    const delRes = await fetch(`${baseUrl}/api/admin/ai/credentials/${createdId}`, {
      method: "DELETE",
      headers: { Authorization: "Bearer admin-test-token" },
    });
    expect(delRes.status).toBe(200);
    const delBody = await delRes.json();
    expect(delBody.success).toBe(true);

    // Follow-up GET confirms removal
    const checkRes = await fetch(`${baseUrl}/api/admin/ai/credentials`, {
      headers: { Authorization: "Bearer admin-test-token" },
    });
    const checkBody = await checkRes.json();
    expect(checkBody.credentials.some((c: any) => c.id === createdId)).toBe(false);
    createdId = "";
  });
});
