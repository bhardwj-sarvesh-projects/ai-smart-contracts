import fs from "fs";
import path from "path";
import crypto from "crypto";
import OpenAI from "openai";
import { encrypt, decrypt } from "../utils/encryption";
import { getAdminFirestore } from "./FirebaseAdminAuth";

export interface AICredential {
  id: string;
  provider: "groq";
  displayName: string;
  encryptedApiKey: string;
  enabled: boolean;
  priority: number;
  healthStatus: "unknown" | "healthy" | "rate_limited" | "auth_error" | "unavailable";
  cooldownUntil?: string;
  lastSuccessAt?: string;
  lastFailureAt?: string;
  totalRequests: number;
  totalFailures: number;
  createdAt: string;
  updatedAt: string;
}

export interface PublicAICredential extends Omit<AICredential, "encryptedApiKey"> {
  maskedApiKey: string;
}

const LOCAL_PATH = path.join(process.cwd(), "data", "ai_credentials.json");
const COLLECTION = "aiCredentials";

function firestoreCollection() {
  try {
    return getAdminFirestore().collection(COLLECTION);
  } catch {
    return null;
  }
}

export class AICredentialService {
  private static ensureLocal() {
    const dir = path.dirname(LOCAL_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(LOCAL_PATH)) fs.writeFileSync(LOCAL_PATH, "{}", "utf8");
  }

  private static readLocal(): Record<string, AICredential> {
    this.ensureLocal();
    try { return JSON.parse(fs.readFileSync(LOCAL_PATH, "utf8")) || {}; }
    catch { return {}; }
  }

  private static writeLocal(data: Record<string, AICredential>) {
    this.ensureLocal();
    fs.writeFileSync(LOCAL_PATH, JSON.stringify(data, null, 2), "utf8");
  }

  static mask(key: string) {
    if (!key) return "";
    if (key.length <= 10) return "••••••••";
    return `${key.slice(0, 4)}••••••••${key.slice(-4)}`;
  }

  static toPublic(item: AICredential): PublicAICredential {
    let raw = "";
    try { raw = decrypt(item.encryptedApiKey); } catch { raw = ""; }
    const { encryptedApiKey: _, ...rest } = item;
    return { ...rest, maskedApiKey: this.mask(raw) };
  }

  static async list(): Promise<PublicAICredential[]> {
    const collection = firestoreCollection();
    let items: AICredential[];
    if (collection) {
      const snapshot = await collection.get();
      items = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as AICredential));
    } else {
      items = Object.values(this.readLocal());
    }
    return items.sort((a, b) => a.priority - b.priority).map(this.toPublic.bind(this));
  }

  static async getEnabled(): Promise<AICredential[]> {
    const collection = firestoreCollection();
    let items: AICredential[];
    if (collection) {
      const snapshot = await collection.where("enabled", "==", true).get();
      items = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as AICredential));
    } else {
      items = Object.values(this.readLocal()).filter(v => v.enabled);
    }
    const now = Date.now();
    return items
      .filter(item => !item.cooldownUntil || new Date(item.cooldownUntil).getTime() <= now)
      .sort((a, b) => a.priority - b.priority);
  }

  static async getSecret(id: string): Promise<{ credential: AICredential; apiKey: string } | null> {
    const collection = firestoreCollection();
    let item: AICredential | undefined;
    if (collection) {
      const doc = await collection.doc(id).get();
      if (doc.exists) item = { id: doc.id, ...(doc.data() as any) } as AICredential;
    } else {
      item = this.readLocal()[id];
    }
    if (!item || !item.enabled) return null;
    return { credential: item, apiKey: decrypt(item.encryptedApiKey) };
  }

  static async add(displayName: string, apiKey: string): Promise<PublicAICredential> {
    if (!apiKey || !apiKey.startsWith("gsk_")) throw new Error("A valid Groq API key is required.");
    const existing = await this.list();
    const now = new Date().toISOString();
    const id = `groq-${crypto.randomUUID()}`;
    const item: AICredential = {
      id,
      provider: "groq",
      displayName: displayName.trim() || `Groq API ${existing.length + 1}`,
      encryptedApiKey: encrypt(apiKey),
      enabled: true,
      priority: existing.length + 1,
      healthStatus: "unknown",
      totalRequests: 0,
      totalFailures: 0,
      createdAt: now,
      updatedAt: now,
    };
    const collection = firestoreCollection();
    if (collection) await collection.doc(id).set(item);
    else {
      const data = this.readLocal(); data[id] = item; this.writeLocal(data);
    }
    return this.toPublic(item);
  }

  static async update(id: string, update: Partial<Pick<AICredential, "enabled" | "priority" | "displayName">>) {
    const collection = firestoreCollection();
    const patch = { ...update, updatedAt: new Date().toISOString() };
    if (collection) await collection.doc(id).update(patch);
    else {
      const data = this.readLocal(); if (!data[id]) throw new Error("Credential not found.");
      data[id] = { ...data[id], ...patch }; this.writeLocal(data);
    }
    return (await this.list()).find(v => v.id === id) || null;
  }

  static async remove(id: string) {
    const collection = firestoreCollection();
    if (collection) await collection.doc(id).delete();
    else {
      const data = this.readLocal(); delete data[id]; this.writeLocal(data);
    }
  }

  static async record(id: string, success: boolean, failureType?: string, cooldownMs?: number) {
    const collection = firestoreCollection();
    const now = new Date().toISOString();
    const current = await this.getSecret(id);
    if (!current) return;
    const patch: any = {
      healthStatus: success ? "healthy" : failureType === "AUTH_ERROR" ? "auth_error" : failureType === "RATE_LIMIT_ERROR" ? "rate_limited" : "unavailable",
      lastSuccessAt: success ? now : current.credential.lastSuccessAt || null,
      lastFailureAt: success ? current.credential.lastFailureAt || null : now,
      totalRequests: (current.credential.totalRequests || 0) + 1,
      totalFailures: (current.credential.totalFailures || 0) + (success ? 0 : 1),
      cooldownUntil: cooldownMs ? new Date(Date.now() + cooldownMs).toISOString() : null,
      updatedAt: now,
    };
    if (success) patch.totalFailures = current.credential.totalFailures || 0;
    if (collection) await collection.doc(id).update(patch);
    else {
      const data = this.readLocal(); data[id] = { ...data[id], ...patch }; this.writeLocal(data);
    }
  }

  static async test(id: string) {
    const secret = await this.getSecret(id);
    if (!secret) throw new Error("Credential not found or disabled.");
    const client = new OpenAI({ apiKey: secret.apiKey, baseURL: "https://api.groq.com/openai/v1", timeout: 10000 });
    const started = Date.now();
    try {
      await client.chat.completions.create({
        model: "openai/gpt-oss-20b",
        messages: [{ role: "user", content: "Respond with the single word: OK" }],
        temperature: 0.1,
        max_tokens: 8,
      });
      await this.record(id, true);
      return { success: true, latencyMs: Date.now() - started };
    } catch (error: any) {
      await this.record(id, false, classifyAIError(error));
      return { success: false, latencyMs: Date.now() - started, error: error.message || String(error) };
    }
  }
}

export function classifyAIError(error: any): string {
  const status = Number(error?.status || error?.statusCode || 0);
  const msg = String(error?.message || error || "").toLowerCase();
  if (status === 401 || status === 403 || msg.includes("invalid api key") || msg.includes("invalid_api_key") || msg.includes("unauthorized")) return "AUTH_ERROR";
  if (status === 429 || msg.includes("rate limit") || msg.includes("rate_limit") || msg.includes("quota") || msg.includes("too many requests")) return "RATE_LIMIT_ERROR";
  if (status === 400 && (msg.includes("context") || msg.includes("max_tokens") || msg.includes("token"))) return "CONTEXT_TOKEN_ERROR";
  if (status === 404 || msg.includes("model") && (msg.includes("not found") || msg.includes("does not exist"))) return "MODEL_UNAVAILABLE";
  if (status >= 500 || msg.includes("timeout") || msg.includes("timed out") || msg.includes("network")) return "TRANSIENT_ERROR";
  return "PROVIDER_ERROR";
}
