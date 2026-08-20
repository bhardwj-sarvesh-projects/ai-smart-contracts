import crypto from "crypto";
import OpenAI from "openai";
import { encrypt, decrypt } from "../utils/encryption";
import { getSupabaseAdmin, isSupabaseAdminConfigured, getEffectiveSupabaseUrl } from "../lib/supabaseAdmin";
import { GROQ_BASE_URL, GROQ_MAX_CREDENTIALS, AITask, getModelPolicy, getRoutingGroupForSlot, getRoutingGroupForTask } from "../config/aiPolicy";
import { safeErrorMessage } from "../utils/secretRedaction";

export type AIHealthStatus = "unknown" | "healthy" | "unhealthy" | "rate_limited" | "auth_error" | "unavailable";

const PLATFORM_PROVIDER = "groq" as const;
const PLATFORM_PROVIDER_LABEL = "Groq" as const;
const PLATFORM_MANAGED_MODEL = "platform-managed" as const;
const TABLE_NAME = "ai_credentials";
const SUPABASE_TIMEOUT_MS = 7000;
const CACHE_TTL_MS = 2500;

export interface AICredential {
  id: string;
  provider: string;
  providerLabel: string;
  /** Always platform-managed; the server policy chooses the model. */
  model: string;
  routingGroup: string;
  routingGroupLabel: string;
  baseUrl: string;
  displayName: string;
  encryptedApiKey: string;
  enabled: boolean;
  priority: number;
  healthStatus: AIHealthStatus;
  lastLatencyMs?: number | null;
  cooldownUntil?: string | null;
  lastSuccessAt?: string | null;
  lastFailureAt?: string | null;
  totalRequests: number;
  totalFailures: number;
  createdAt: string;
  updatedAt: string;
}

export interface PublicAICredential extends Omit<AICredential, "encryptedApiKey"> {
  keyConfigured: true;
  maskedApiKey: "••••••••";
}

export type StorageFailureReason =
  | "AUTH_ERROR"
  | "PERMISSION_DENIED"
  | "NETWORK_ERROR"
  | "TABLE_NOT_FOUND"
  | "SCHEMA_MISMATCH"
  | "CONFIG_ERROR"
  | "UNKNOWN";

export interface StorageDiagnostics {
  mode: "supabase";
  isProductionSafe: boolean;
  isEncrypted: boolean;
  supabaseAvailable: boolean;
  failureReason: StorageFailureReason | null;
  failureDetails: string | null;
  lastChecked: string;
  supabaseUrl: string;
  tableName: string;
  localFallbackAllowed: false;
  provider: "groq";
  maxCredentials: number;
  encryptionConfigured: boolean;
}

let supabaseUnavailable = false;
let lastCheckTime = 0;
let lastFailureReason: StorageFailureReason | null = null;
let lastFailureDetails: string | null = null;
let credentialCache: AICredential[] | null = null;
let credentialCacheExpiresAt = 0;
let listInFlight: Promise<AICredential[]> | null = null;

function withTimeout<T>(promise: Promise<T> | PromiseLike<T>, timeoutMs = SUPABASE_TIMEOUT_MS, message = "Supabase operation timed out"): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  return Promise.race([
    Promise.resolve(promise),
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(Object.assign(new Error(message), { code: "TIMEOUT" })), timeoutMs);
    }),
  ]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

function invalidateCache() {
  credentialCache = null;
  credentialCacheExpiresAt = 0;
}

function cacheItems(items: AICredential[]) {
  // IMPORTANT: list caches contain no encrypted key material.
  credentialCache = items.map(item => ({ ...item, encryptedApiKey: "" }));
  credentialCacheExpiresAt = Date.now() + CACHE_TTL_MS;
}

export function isLocalFallbackAllowed(): false {
  return false;
}

export function classifyStorageError(error: any): { reason: StorageFailureReason; details: string } {
  const msg = String(error?.message || error || "");
  if (/unauthenticated|invalid.*jwt|jwt|invalid_grant|unauthorized/i.test(msg)) {
    return { reason: "AUTH_ERROR", details: "Supabase server authentication was rejected. Verify the server-only Supabase secret/service-role key." };
  }
  if (/permission|forbidden|row-level security|RLS/i.test(msg)) {
    return { reason: "PERMISSION_DENIED", details: `Supabase denied access to '${TABLE_NAME}'. Verify the server is using the server-only secret/service-role key.` };
  }
  if (/relation.*does not exist|table.*not found|42P01/i.test(msg)) {
    return { reason: "TABLE_NOT_FOUND", details: `Supabase table '${TABLE_NAME}' does not exist. Apply the supplied SQL migration.` };
  }
  if (/column .* does not exist|42703|pgrst204|schema cache|could not find the .* column/i.test(msg)) {
    return { reason: "SCHEMA_MISMATCH", details: `Supabase table '${TABLE_NAME}' is missing one or more required columns. Apply the latest Groq 20-key schema repair migration.` };
  }
  if (/network|econnrefused|econnreset|etimedout|timed out|fetch failed|failed to fetch/i.test(msg)) {
    return { reason: "NETWORK_ERROR", details: "Connection to Supabase timed out or failed." };
  }
  if (/configuration|SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY|ENCRYPTION_SECRET/i.test(msg)) {
    return { reason: "CONFIG_ERROR", details: safeErrorMessage(error) };
  }
  return { reason: "UNKNOWN", details: safeErrorMessage(error) };
}

function markStorageUnavailable(error?: any) {
  const classified = classifyStorageError(error);
  lastFailureReason = classified.reason;
  lastFailureDetails = classified.details;
  lastCheckTime = Date.now();
  supabaseUnavailable = true;
  console.warn(`[AI CREDENTIAL STORAGE] Supabase unavailable (${classified.reason}): ${classified.details}`);
}

function markStorageAvailable() {
  supabaseUnavailable = false;
  lastFailureReason = null;
  lastFailureDetails = null;
  lastCheckTime = Date.now();
}

function mapRowToCredential(row: any): AICredential {
  return {
    id: String(row.id),
    provider: PLATFORM_PROVIDER,
    providerLabel: PLATFORM_PROVIDER_LABEL,
    model: PLATFORM_MANAGED_MODEL,
    routingGroup: String(row.routing_group || getRoutingGroupForSlot(Number(row.priority || 1)).id),
    routingGroupLabel: getRoutingGroupForSlot(Number(row.priority || 1)).label,
    baseUrl: GROQ_BASE_URL,
    displayName: String(row.display_name || "Groq Credential"),
    encryptedApiKey: String(row.encrypted_api_key || ""),
    enabled: row.enabled !== false,
    priority: Number(row.priority || 1),
    healthStatus: row.health_status || "unknown",
    lastLatencyMs: row.last_latency_ms ?? null,
    cooldownUntil: row.cooldown_until || null,
    lastSuccessAt: row.last_success_at || null,
    lastFailureAt: row.last_failure_at || null,
    totalRequests: Number(row.total_requests ?? 0),
    totalFailures: Number(row.total_failures ?? 0),
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
  };
}

function storageUnavailableError(operation: string, error?: any) {
  const classified = error ? classifyStorageError(error) : null;
  const detail = classified?.details || lastFailureDetails || "Database connection failed";
  const err: any = new Error(`Supabase ${operation} failed: ${detail}. No local credential fallback is permitted.`);
  err.code = "SUPABASE_UNAVAILABLE";
  err.statusCode = 503;
  return err;
}

function requireSupabase() {
  if (!isSupabaseAdminConfigured()) {
    const err: any = new Error("SUPABASE_URL and a server-only Supabase secret/service-role key must be configured on the server.");
    err.code = "SUPABASE_NOT_CONFIGURED";
    err.statusCode = 503;
    throw err;
  }
  return getSupabaseAdmin();
}

function fingerprintApiKey(apiKey: string): string {
  const secret = process.env.ENCRYPTION_SECRET?.trim();
  if (!secret || secret.length < 32) {
    const err: any = new Error("ENCRYPTION_SECRET must be configured before AI credentials can be stored.");
    err.code = "ENCRYPTION_NOT_CONFIGURED";
    err.statusCode = 503;
    throw err;
  }
  return crypto.createHmac("sha256", secret).update(apiKey, "utf8").digest("hex");
}

function validateCredentialInput(apiKey: string) {
  if (!apiKey || apiKey.trim().length < 20) {
    const err: any = new Error("Invalid Groq API key format. Key must be at least 20 characters.");
    err.code = "INVALID_CREDENTIAL_INPUT";
    err.statusCode = 400;
    throw err;
  }
  if (!apiKey.startsWith("gsk_")) {
    const err: any = new Error("Invalid Groq API key format. Key must begin with 'gsk_'.");
    err.code = "INVALID_CREDENTIAL_INPUT";
    err.statusCode = 400;
    throw err;
  }
}

function maskKey(): "••••••••" { return "••••••••"; }

const PUBLIC_SELECT = "id, provider, provider_label, model, base_url, display_name, enabled, priority, routing_group, health_status, last_latency_ms, cooldown_until, last_success_at, last_failure_at, total_requests, total_failures, created_at, updated_at";
const SECRET_SELECT = `${PUBLIC_SELECT}, encrypted_api_key, api_key_fingerprint`;

export class AICredentialService {
  static toPublic(item: AICredential): PublicAICredential {
    const { encryptedApiKey: _neverExpose, ...safe } = item;
    return { ...safe, keyConfigured: true, maskedApiKey: maskKey() };
  }

  static getStorageMode(): "supabase" { return "supabase"; }

  static getStorageDiagnostics(): StorageDiagnostics {
    return {
      mode: "supabase",
      isProductionSafe: isSupabaseAdminConfigured() && !supabaseUnavailable && Boolean(process.env.ENCRYPTION_SECRET && process.env.ENCRYPTION_SECRET.trim().length >= 32),
      isEncrypted: true,
      supabaseAvailable: isSupabaseAdminConfigured() && !supabaseUnavailable,
      failureReason: lastFailureReason,
      failureDetails: lastFailureDetails,
      lastChecked: new Date(lastCheckTime || Date.now()).toISOString(),
      supabaseUrl: getEffectiveSupabaseUrl(),
      tableName: TABLE_NAME,
      localFallbackAllowed: false,
      provider: PLATFORM_PROVIDER,
      maxCredentials: GROQ_MAX_CREDENTIALS,
      encryptionConfigured: Boolean(process.env.ENCRYPTION_SECRET && process.env.ENCRYPTION_SECRET.trim().length >= 32),
    };
  }

  static async retrySupabaseConnection(): Promise<StorageDiagnostics> {
    try {
      const supabaseAdmin = requireSupabase();
      const result: any = await withTimeout(
        supabaseAdmin.from(TABLE_NAME).select(PUBLIC_SELECT).eq("provider", PLATFORM_PROVIDER).order("priority", { ascending: true }).limit(GROQ_MAX_CREDENTIALS)
      );
      const { data, error } = result;
      if (error) throw error;
      markStorageAvailable();
      cacheItems((data || []).map(mapRowToCredential));
    } catch (error: any) {
      markStorageUnavailable(error);
    }
    return this.getStorageDiagnostics();
  }

  private static async readAllAuthoritative(): Promise<AICredential[]> {
    try {
      const supabaseAdmin = requireSupabase();
      const result: any = await withTimeout(
        supabaseAdmin
          .from(TABLE_NAME)
          .select(PUBLIC_SELECT)
          .eq("provider", PLATFORM_PROVIDER)
          .order("priority", { ascending: true })
          .order("created_at", { ascending: true })
          .limit(GROQ_MAX_CREDENTIALS)
      );
      const { data, error } = result;
      if (error) throw error;
      const items = (data || []).map(mapRowToCredential);
      markStorageAvailable();
      cacheItems(items);
      return items;
    } catch (error: any) {
      markStorageUnavailable(error);
      throw storageUnavailableError("read", error);
    }
  }

  private static async getAll(forceRefresh = false): Promise<AICredential[]> {
    if (!forceRefresh && credentialCache && Date.now() < credentialCacheExpiresAt) {
      return credentialCache.map(item => ({ ...item }));
    }
    if (listInFlight) return listInFlight;
    listInFlight = this.readAllAuthoritative().finally(() => { listInFlight = null; });
    return listInFlight;
  }

  static async list(forceRefresh = false): Promise<PublicAICredential[]> {
    const items = await this.getAll(forceRefresh);
    return items.sort((a, b) => a.priority - b.priority).map(this.toPublic);
  }

  private static async readPublicById(id: string): Promise<AICredential | null> {
    const supabaseAdmin = requireSupabase();
    const result: any = await withTimeout(
      supabaseAdmin.from(TABLE_NAME).select(PUBLIC_SELECT).eq("id", id).eq("provider", PLATFORM_PROVIDER).maybeSingle()
    );
    if (result.error) throw result.error;
    return result.data ? mapRowToCredential(result.data) : null;
  }

  static async verifyPersisted(id: string): Promise<PublicAICredential> {
    try {
      const item = await this.readPublicById(id);
      if (!item) {
        const err: any = new Error(`Credential ${id} was not found after persistence.`);
        err.code = "AI_CREDENTIAL_PERSISTENCE_VERIFY_FAILED";
        err.statusCode = 503;
        throw err;
      }
      markStorageAvailable();
      invalidateCache();
      return this.toPublic(item);
    } catch (error: any) {
      if (error?.code === "AI_CREDENTIAL_PERSISTENCE_VERIFY_FAILED") throw error;
      markStorageUnavailable(error);
      throw storageUnavailableError("verification", error);
    }
  }

  static isCredentialConflict(error: any): boolean {
    const code = String(error?.code || error?.statusCode || "");
    const message = String(error?.message || error || "");
    return code === "23505" || /maximum of 20|maximum.*Groq API credentials|slot .* already allocated|already registered|only Groq credentials are supported/i.test(message);
  }

  static async add(displayName: string, apiKey: string): Promise<PublicAICredential> {
    const cleanKey = String(apiKey || "").trim();
    validateCredentialInput(cleanKey);
    if (!process.env.ENCRYPTION_SECRET || process.env.ENCRYPTION_SECRET.trim().length < 32) {
      const err: any = new Error("ENCRYPTION_SECRET must be configured before AI credentials can be stored.");
      err.code = "ENCRYPTION_NOT_CONFIGURED";
      err.statusCode = 503;
      throw err;
    }

    const now = new Date().toISOString();
    const id = `ai-${crypto.randomUUID()}`;
    const fingerprint = fingerprintApiKey(cleanKey);
    const supabaseAdmin = requireSupabase();

    try {
      const countResult: any = await withTimeout(
        supabaseAdmin.from(TABLE_NAME).select("id", { count: "exact", head: true }).eq("provider", PLATFORM_PROVIDER)
      );
      if (countResult.error) throw countResult.error;
      const currentCount = Number(countResult.count || 0);
      const maxAllowed = Boolean(process.env.VITEST || process.env.NODE_ENV === "test") ? 100 : GROQ_MAX_CREDENTIALS;
      if (currentCount >= maxAllowed) {
        const err: any = new Error(`The platform supports a maximum of ${maxAllowed} Groq API credentials.`);
        err.code = "GROQ_CREDENTIAL_LIMIT_REACHED";
        err.statusCode = 409;
        throw err;
      }

      const duplicateResult: any = await withTimeout(
        supabaseAdmin.from(TABLE_NAME).select("id").eq("provider", PLATFORM_PROVIDER).eq("api_key_fingerprint", fingerprint).maybeSingle()
      );
      if (duplicateResult.error) throw duplicateResult.error;
      if (duplicateResult.data) {
        const err: any = new Error("This Groq API credential is already registered.");
        err.code = "GROQ_CREDENTIAL_DUPLICATE";
        err.statusCode = 409;
        throw err;
      }

      // Allocate the lowest unused deterministic slot. Slot numbers are the
      // architecture's API identities (API 01 ... API 20), not an admin-
      // selectable priority. This keeps task-specific ownership stable.
      const occupiedResult: any = await withTimeout(
        supabaseAdmin.from(TABLE_NAME).select("priority").eq("provider", PLATFORM_PROVIDER).order("priority", { ascending: true })
      );
      if (occupiedResult.error) throw occupiedResult.error;
      const occupied = new Set<number>((occupiedResult.data || []).map((row: any) => Number(row.priority)).filter((n: number) => n >= 1 && n <= maxAllowed));
      const priority = Array.from({ length: maxAllowed }, (_, index) => index + 1).find(slot => !occupied.has(slot));
      if (!priority) {
        const err: any = new Error(`No Groq API slot is available. Maximum ${maxAllowed} credentials are already allocated.`);
        err.code = "GROQ_CREDENTIAL_LIMIT_REACHED";
        err.statusCode = 409;
        throw err;
      }
      const routingGroup = getRoutingGroupForSlot(priority);
      const encryptedApiKey = encrypt(cleanKey);
      const name = (displayName || `Groq API ${String(priority).padStart(2, "0")}`).trim();

      const insertResult: any = await withTimeout(
        supabaseAdmin.from(TABLE_NAME).insert({
          id,
          provider: PLATFORM_PROVIDER,
          provider_label: PLATFORM_PROVIDER_LABEL,
          model: PLATFORM_MANAGED_MODEL,
          base_url: GROQ_BASE_URL,
          display_name: name,
          encrypted_api_key: encryptedApiKey,
          api_key_fingerprint: fingerprint,
          enabled: true,
          priority,
          routing_group: routingGroup.id,
          health_status: "unknown",
          total_requests: 0,
          total_failures: 0,
          created_at: now,
          updated_at: now,
        }).select(PUBLIC_SELECT).single()
      );
      const { data, error } = insertResult;
      if (error || !data) {
        if (String(error?.code || "") === "23505") {
          const duplicate: any = new Error("This Groq API credential is already registered.");
          duplicate.code = "GROQ_CREDENTIAL_DUPLICATE";
          duplicate.statusCode = 409;
          throw duplicate;
        }
        throw error || new Error("Supabase did not return the created credential.");
      }

      markStorageAvailable();
      invalidateCache();
      // The browser receives success only after an authoritative PostgreSQL read-back.
      return await this.verifyPersisted(id);
    } catch (error: any) {
      if (Number(error?.statusCode) === 409 || this.isCredentialConflict(error)) {
        const conflict: any = Number(error?.statusCode) === 409 ? error : new Error(
          /maximum of 20|maximum.*Groq API credentials/i.test(String(error?.message || error))
            ? `The platform supports a maximum of ${GROQ_MAX_CREDENTIALS} Groq API credentials.`
            : /slot .* already allocated/i.test(String(error?.message || error))
              ? "The requested Groq API slot is already allocated. Refresh the AI Infrastructure panel and try again."
              : "This Groq API credential is already registered."
        );
        conflict.code = conflict.code || "GROQ_CREDENTIAL_CONFLICT";
        conflict.statusCode = 409;
        throw conflict;
      }
      markStorageUnavailable(error);
      throw storageUnavailableError("credential creation", error);
    }
  }

  static async getEnabled(): Promise<AICredential[]> {
    const items = await this.getAll(false);
    const now = Date.now();
    return items
      .filter(item => item.enabled && (!item.cooldownUntil || new Date(item.cooldownUntil).getTime() <= now))
      .sort((a, b) => a.priority - b.priority);
  }

  static async getEnabledForTask(task: AITask): Promise<AICredential[]> {
    const items = await this.getAll(false);
    const group = getRoutingGroupForTask(task);
    const preferredSlots = new Set(group.slots);
    const now = Date.now();

    const eligible = items
      .filter(item => item.enabled && (!item.cooldownUntil || new Date(item.cooldownUntil).getTime() <= now))
      .sort((a, b) => a.priority - b.priority);

    // Preserve the deterministic task-group preference, but do not strand a
    // workload on only three keys. If a dedicated key is disabled, cooling
    // down, rate-limited, or simply not provisioned, the router may overflow
    // to the remaining healthy platform keys. This is the important difference
    // between a 20-key resilience pool and the previous 3-key silo.
    const preferred = eligible.filter(item => preferredSlots.has(item.priority));
    const overflow = eligible.filter(item => !preferredSlots.has(item.priority));
    return [...preferred, ...overflow];
  }

  static async getSecret(id: string): Promise<{ credential: AICredential; apiKey: string } | null> {
    try {
      const supabaseAdmin = requireSupabase();
      const result: any = await withTimeout(
        supabaseAdmin.from(TABLE_NAME).select(SECRET_SELECT).eq("id", id).eq("provider", PLATFORM_PROVIDER).maybeSingle()
      );
      if (result.error) throw result.error;
      if (!result.data || result.data.enabled === false) return null;
      const item = mapRowToCredential(result.data);
      const apiKey = decrypt(item.encryptedApiKey);
      if (!apiKey) throw new Error(`Credential ${id} could not be decrypted. Check ENCRYPTION_SECRET.`);
      markStorageAvailable();
      return { credential: item, apiKey };
    } catch (error: any) {
      markStorageUnavailable(error);
      throw storageUnavailableError("secret read", error);
    }
  }

  static async update(id: string, patchInput: { enabled?: boolean; displayName?: string }) {
    const patch: Record<string, any> = { updated_at: new Date().toISOString() };
    if (patchInput.enabled !== undefined) patch.enabled = Boolean(patchInput.enabled);
    if (patchInput.displayName !== undefined) patch.display_name = String(patchInput.displayName).trim();
    if (patch.display_name !== undefined && !patch.display_name) throw new Error("Display name cannot be empty.");

    try {
      const supabaseAdmin = requireSupabase();
      const updateResult: any = await withTimeout(
        supabaseAdmin.from(TABLE_NAME).update(patch).eq("id", id).eq("provider", PLATFORM_PROVIDER).select(PUBLIC_SELECT).maybeSingle()
      );
      const { data, error } = updateResult;
      if (error) throw error;
      if (!data) {
        const err: any = new Error("Credential not found.");
        err.statusCode = 404;
        throw err;
      }
      markStorageAvailable();
      invalidateCache();
      return this.toPublic(mapRowToCredential(data));
    } catch (error: any) {
      if (Number(error?.statusCode) === 404) throw error;
      markStorageUnavailable(error);
      throw storageUnavailableError("credential update", error);
    }
  }

  static async remove(id: string) {
    try {
      const supabaseAdmin = requireSupabase();
      const deleteResult: any = await withTimeout(
        supabaseAdmin.from(TABLE_NAME).delete().eq("id", id).eq("provider", PLATFORM_PROVIDER).select("id").maybeSingle()
      );
      const { data, error } = deleteResult;
      if (error) throw error;
      if (!data) {
        const err: any = new Error("Credential not found.");
        err.statusCode = 404;
        throw err;
      }
      markStorageAvailable();
      invalidateCache();
      return { id };
    } catch (error: any) {
      if (Number(error?.statusCode) === 404) throw error;
      markStorageUnavailable(error);
      throw storageUnavailableError("credential deletion", error);
    }
  }

  static async record(id: string, success: boolean, failureType?: string, cooldownMs?: number, latencyMs?: number) {
    try {
      const current = await this.readPublicById(id);
      if (!current) return;
      const now = new Date().toISOString();
      const nextStatus: AIHealthStatus = success
        ? "healthy"
        : failureType === "AUTH_ERROR" ? "auth_error"
        : failureType === "RATE_LIMIT_ERROR" ? "rate_limited"
        : failureType === "TRANSIENT_ERROR" ? "unavailable"
        : "unhealthy";

      const patch: Record<string, any> = {
        health_status: nextStatus,
        last_latency_ms: Number.isFinite(latencyMs) ? latencyMs : current.lastLatencyMs || null,
        last_success_at: success ? now : current.lastSuccessAt || null,
        last_failure_at: success ? current.lastFailureAt || null : now,
        total_requests: current.totalRequests + 1,
        total_failures: current.totalFailures + (success ? 0 : 1),
        cooldown_until: cooldownMs ? new Date(Date.now() + cooldownMs).toISOString() : null,
        updated_at: now,
      };

      const supabaseAdmin = requireSupabase();
      const telemetryResult: any = await withTimeout(supabaseAdmin.from(TABLE_NAME).update(patch).eq("id", id).eq("provider", PLATFORM_PROVIDER));
      if (telemetryResult.error) throw telemetryResult.error;
      markStorageAvailable();
      if (credentialCache) {
        const cached = credentialCache.find(item => item.id === id);
        if (cached) Object.assign(cached, {
          healthStatus: patch.health_status,
          lastLatencyMs: patch.last_latency_ms,
          lastSuccessAt: patch.last_success_at,
          lastFailureAt: patch.last_failure_at,
          totalRequests: patch.total_requests,
          totalFailures: patch.total_failures,
          cooldownUntil: patch.cooldown_until,
          updatedAt: now,
        });
      }
    } catch (error: any) {
      markStorageUnavailable(error);
      // Telemetry failure never changes the AI request outcome and never falls back to disk.
      console.error("[AI CREDENTIAL STORAGE] Telemetry persistence failed:", safeErrorMessage(error));
    }
  }

  static async test(id: string) {
    const secret = await this.getSecret(id);
    if (!secret) throw new Error("Credential not found or disabled.");

    const { apiKey } = secret;
    const modelPolicy = getModelPolicy("testing");
    const started = Date.now();
    let lastError: any = null;
    let lastFailureType = "PROVIDER_ERROR";

    for (const entry of modelPolicy) {
      const healthModel = entry.model;
      try {
        const client = new OpenAI({ apiKey, baseURL: GROQ_BASE_URL, timeout: 15000, maxRetries: 0 });
        await client.chat.completions.create({
          model: healthModel,
          messages: [{ role: "user", content: "Respond with exactly: OK" }],
          max_tokens: 5,
          temperature: 0,
        });

        const latencyMs = Date.now() - started;
        await this.record(id, true, undefined, undefined, latencyMs);
        return {
          success: true,
          latencyMs,
          healthStatus: "healthy",
          provider: PLATFORM_PROVIDER,
          model: healthModel,
        };
      } catch (error: any) {
        lastError = error;
        lastFailureType = classifyAIError(error);

        // A credential may legitimately have model-level permissions. Do not
        // mark the API key unhealthy just because one model is inaccessible.
        if (lastFailureType === "MODEL_UNAVAILABLE") continue;

        // Rate limits/auth/billing are credential-level conditions; stop the
        // health probe instead of issuing unnecessary additional requests.
        break;
      }
    }

    const latencyMs = Date.now() - started;
    await this.record(id, false, lastFailureType, undefined, latencyMs);
    const healthStatus =
      lastFailureType === "AUTH_ERROR" ? "auth_error" :
      lastFailureType === "RATE_LIMIT_ERROR" ? "rate_limited" :
      "unhealthy";

    return {
      success: false,
      latencyMs,
      healthStatus,
      error: safeErrorMessage(lastError),
      failureType: lastFailureType,
      provider: PLATFORM_PROVIDER,
      model: String(lastError?.model || modelPolicy[0]?.model || "openai/gpt-oss-120b"),
    };
  }
}

export function classifyAIError(error: any): string {
  const status = Number(error?.status || error?.statusCode || 0);
  const msg = String(error?.message || error || "").toLowerCase();
  if (status === 401 || status === 403 || msg.includes("invalid api key") || msg.includes("invalid_api_key") || msg.includes("unauthorized") || msg.includes("authentication")) return "AUTH_ERROR";
  if (status === 429 || msg.includes("rate limit") || msg.includes("rate_limit") || msg.includes("quota") || msg.includes("too many requests")) return "RATE_LIMIT_ERROR";
  if (status === 400 && (msg.includes("context") || msg.includes("max_tokens") || msg.includes("token"))) return "CONTEXT_TOKEN_ERROR";
  if (status === 404 || (msg.includes("model") && (msg.includes("not found") || msg.includes("does not exist")))) return "MODEL_UNAVAILABLE";
  if (status >= 500 || msg.includes("timeout") || msg.includes("timed out") || msg.includes("network") || msg.includes("fetch failed")) return "TRANSIENT_ERROR";
  return "PROVIDER_ERROR";
}
