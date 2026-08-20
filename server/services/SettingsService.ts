import { getSupabaseAdmin, isSupabaseAdminConfigured } from "../lib/supabaseAdmin";

export interface UserConfig {
  userId: string;
  email: string;
  displayName: string;
  photo: string;
  provider: "platform-router";
  apiKey: "";
  defaultModel: "platform-router";
  temperature: number;
  maxTokens: number;
  createdDate: string;
  updatedDate: string;
  role?: string;
  isActive?: boolean;
}

function rowToConfig(data: any): UserConfig {
  return {
    userId: data.id,
    email: data.email || "",
    displayName: data.full_name || data.email?.split("@")[0] || "User",
    photo: data.photo_url || "",
    provider: "platform-router",
    apiKey: "",
    defaultModel: "platform-router",
    temperature: 0.1,
    maxTokens: 65536,
    role: data.role || "user",
    isActive: data.is_active ?? true,
    createdDate: data.created_at || new Date().toISOString(),
    updatedDate: data.updated_at || new Date().toISOString(),
  };
}

function requireConfigured() {
  if (!isSupabaseAdminConfigured()) {
    const err: any = new Error("Supabase server configuration is missing. Configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
    err.code = "SUPABASE_NOT_CONFIGURED";
    err.statusCode = 503;
    throw err;
  }
  return getSupabaseAdmin();
}

export class SettingsService {
  static async getAsync(userId: string): Promise<UserConfig | null> {
    const supabaseAdmin = requireConfigured();
    const { data, error } = await supabaseAdmin.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (error) throw error;
    return data ? rowToConfig(data) : null;
  }

  static async getAllConfigsAsync(): Promise<Record<string, UserConfig>> {
    const supabaseAdmin = requireConfigured();
    const { data, error } = await supabaseAdmin.from("profiles").select("*").order("created_at", { ascending: true });
    if (error) throw error;
    const result: Record<string, UserConfig> = {};
    for (const row of data || []) result[row.id] = rowToConfig(row);
    return result;
  }

  static async updateRoleAndStatusAsync(userId: string, update: { role?: string; isActive?: boolean }): Promise<UserConfig | null> {
    const supabaseAdmin = requireConfigured();
    const payload: Record<string, any> = { updated_at: new Date().toISOString() };
    if (update.role !== undefined) payload.role = update.role;
    if (update.isActive !== undefined) payload.is_active = update.isActive;

    const { data, error } = await supabaseAdmin.from("profiles").update(payload).eq("id", userId).select("*").maybeSingle();
    if (error) throw error;
    return data ? rowToConfig(data) : null;
  }

  static async saveAsync(userId: string, data: Partial<UserConfig> & { email: string; displayName?: string }): Promise<UserConfig> {
    const supabaseAdmin = requireConfigured();
    const now = new Date().toISOString();
    const payload = {
      id: userId,
      email: data.email,
      full_name: data.displayName || data.email.split("@")[0],
      role: data.role || "user",
      is_active: data.isActive ?? true,
      photo_url: data.photo || "",
      updated_at: now,
    };
    const { data: row, error } = await supabaseAdmin.from("profiles").upsert(payload).select("*").single();
    if (error) throw error;
    return rowToConfig(row);
  }
}
