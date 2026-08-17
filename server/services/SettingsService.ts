import fs from "fs";
import path from "path";

export interface UserConfig {
  userId: string;
  email: string;
  displayName: string;
  photo: string;
  provider: "groq";
  apiKey: "";
  defaultModel: "platform-router";
  temperature: 0.1;
  maxTokens: 65536;
  createdDate: string;
  updatedDate: string;
  role?: string;
  isActive?: boolean;
}

const USERS_DB_PATH = path.join(process.cwd(), "data", "users.json");

export class SettingsService {
  private static ensureDb() {
    const dir = path.dirname(USERS_DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(USERS_DB_PATH)) fs.writeFileSync(USERS_DB_PATH, JSON.stringify({}, null, 2), "utf8");
  }

  private static readAll(): Record<string, UserConfig> {
    this.ensureDb();
    try { return JSON.parse(fs.readFileSync(USERS_DB_PATH, "utf8")) || {}; }
    catch { return {}; }
  }

  private static writeAll(data: Record<string, UserConfig>) {
    this.ensureDb();
    fs.writeFileSync(USERS_DB_PATH, JSON.stringify(data, null, 2), "utf8");
  }

  static get(userId: string): UserConfig | null { return this.readAll()[userId] || null; }
  static getAllConfigs(): Record<string, UserConfig> { return this.readAll(); }

  static updateRoleAndStatus(userId: string, update: { role?: string; isActive?: boolean }): UserConfig | null {
    const all = this.readAll();
    if (!all[userId]) return null;
    all[userId] = { ...all[userId], ...update, updatedDate: new Date().toISOString() };
    this.writeAll(all);
    return all[userId];
  }

  static getDecrypted(userId: string): UserConfig | null { return this.get(userId); }

  static save(userId: string, data: Partial<UserConfig> & { email: string; displayName?: string }): UserConfig {
    const all = this.readAll();
    const existing = all[userId];
    const now = new Date().toISOString();
    const updated: UserConfig = {
      userId,
      email: data.email,
      displayName: data.displayName || existing?.displayName || data.email.split("@")[0],
      photo: data.photo || existing?.photo || "",
      provider: "groq",
      apiKey: "",
      defaultModel: "platform-router",
      temperature: 0.1,
      maxTokens: 65536,
      role: data.role || existing?.role || "user",
      isActive: data.isActive ?? existing?.isActive ?? true,
      createdDate: existing?.createdDate || now,
      updatedDate: now,
    };
    all[userId] = updated;
    this.writeAll(all);
    return updated;
  }
}
