import { describe, expect, it, beforeAll, afterAll } from "vitest";
import http from "http";
import express from "express";
import { requireAdminUser } from "./services/SupabaseAdminAuth";

const app = express();
app.use(express.json());

const apiRouter = express.Router();

apiRouter.use((_req, res, next) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
  next();
});

apiRouter.get("/admin/users", requireAdminUser, (_req, res) => {
  res.json([{ id: "u1", email: "test@example.com" }]);
});

apiRouter.use((req, res) => {
  return res.status(404).json({
    success: false,
    error: {
      code: "API_ROUTE_NOT_FOUND",
      message: `API route not found: ${req.method} ${req.originalUrl || req.path}`
    }
  });
});

app.use("/api", apiRouter);

// SPA Fallback that returns HTML (should NEVER be reached for /api requests)
app.get("*", (_req, res) => {
  res.send("<!doctype html><html><body>SPA FALLBACK</body></html>");
});

describe("API Boundary Integrity", () => {
  let server: http.Server;
  let baseUrl: string;

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

  it("GET /api/does-not-exist returns HTTP 404 JSON and NEVER returns HTML SPA index", async () => {
    const res = await fetch(`${baseUrl}/api/does-not-exist`);
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toMatch(/json/);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("API_ROUTE_NOT_FOUND");
    expect(body.error.message).toMatch(/API route not found/i);
  });

  it("POST /api/unmapped-endpoint returns HTTP 404 JSON", async () => {
    const res = await fetch(`${baseUrl}/api/unmapped-endpoint`, { method: "POST" });
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toMatch(/json/);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("API_ROUTE_NOT_FOUND");
  });

  it("Unauthenticated request to /api/admin/users returns HTTP 401 JSON and not HTML", async () => {
    const res = await fetch(`${baseUrl}/api/admin/users`);
    expect(res.status).toBe(401);
    expect(res.headers.get("content-type")).toMatch(/json/);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.code).toBe("AUTH_REQUIRED");
    expect(body.error.code).toBe("AUTH_REQUIRED");
  });
});
