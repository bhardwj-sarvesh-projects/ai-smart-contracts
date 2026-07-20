import fs from "fs";
import path from "path";
import { encrypt, decrypt } from "../utils/encryption";

export interface UserConfig {
  userId: string;
  email: string;
  displayName: string;
  photo: string;
  provider: string;
  apiKey: string; // encrypted
  defaultModel: string;
  temperature: number;
  maxTokens: number;
  createdDate: string;
  updatedDate: string;
  role?: string;
  isActive?: boolean;
}

const USERS_DB_PATH = path.join(process.cwd(), "data", "users.json");

export class SettingsService {
  private static ensureDb() {
    const dir = path.dirname(USERS_DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(USERS_DB_PATH)) {
      fs.writeFileSync(USERS_DB_PATH, JSON.stringify({}, null, 2), "utf8");
    }
  }

  private static readAll(): Record<string, UserConfig> {
    this.ensureDb();
    try {
      const content = fs.readFileSync(USERS_DB_PATH, "utf8");
      return JSON.parse(content) || {};
    } catch (err) {
      console.error("Error reading users db:", err);
      return {};
    }
  }

  private static writeAll(data: Record<string, UserConfig>) {
    this.ensureDb();
    fs.writeFileSync(USERS_DB_PATH, JSON.stringify(data, null, 2), "utf8");
  }

  static get(userId: string): UserConfig | null {
    const all = this.readAll();
    const user = all[userId] || null;
    return user;
  }

  static getAllConfigs(): Record<string, UserConfig> {
    return this.readAll();
  }

  static updateRoleAndStatus(userId: string, update: { role?: string; isActive?: boolean }): UserConfig | null {
    const all = this.readAll();
    const user = all[userId];
    if (!user) return null;

    all[userId] = {
      ...user,
      ...update,
      updatedDate: new Date().toISOString()
    } as UserConfig;
    this.writeAll(all);
    return all[userId];
  }

  // Get user with decrypted API key (only for backend use)
  static getDecrypted(userId: string): UserConfig | null {
    const user = this.get(userId);
    if (!user) return null;
    return {
      ...user,
      apiKey: user.apiKey ? decrypt(user.apiKey) : "",
    };
  }

  static save(userId: string, data: Partial<UserConfig> & { email: string; displayName?: string }): UserConfig {
    const all = this.readAll();
    const existing = all[userId] || null;

    let encryptedKey = "";
    if (data.apiKey) {
      if (data.apiKey === "••••••••" || data.apiKey.includes("••")) {
        // Keep existing
        encryptedKey = existing ? existing.apiKey : "";
      } else {
        encryptedKey = encrypt(data.apiKey);
      }
    } else {
      encryptedKey = existing ? existing.apiKey : "";
    }

    const updated: UserConfig = {
      userId,
      email: data.email,
      displayName: data.displayName || existing?.displayName || data.email.split("@")[0],
      photo: data.photo || existing?.photo || "",
      provider: data.provider || existing?.provider || "openai",
      apiKey: encryptedKey,
      defaultModel: data.defaultModel || existing?.defaultModel || "",
      temperature: typeof data.temperature === "number" ? data.temperature : (existing?.temperature ?? 0.2),
      maxTokens: typeof data.maxTokens === "number" ? data.maxTokens : (existing?.maxTokens ?? 2000),
      createdDate: existing?.createdDate || new Date().toISOString(),
      updatedDate: new Date().toISOString(),
    };

    all[userId] = updated;
    this.writeAll(all);
    return updated;
  }
}
