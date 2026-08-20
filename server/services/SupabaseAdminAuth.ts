import { Request, Response, NextFunction } from "express";
import { getSupabaseAdmin, isSupabaseAdminConfigured, getEffectiveSupabaseUrl } from "../lib/supabaseAdmin";

export interface AuthenticatedUser {
  id: string;
  uid: string;
  email: string;
  role: string;
  name?: string;
  picture?: string;
  user_metadata?: Record<string, any>;
  app_metadata?: Record<string, any>;
}

export interface SupabaseAuthRequest extends Request {
  user?: AuthenticatedUser;
  supabaseUser?: AuthenticatedUser;
}

const ADMIN_EMAILS = new Set<string>([
  "sarveshtiwarisarvesh@gmail.com",
]);

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.has(email.trim().toLowerCase());
}

/**
 * Extracts and verifies the Supabase JWT from the Authorization header.
 */
export async function requireAuthenticatedUser(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) {
    res.status(401).json({
      success: false,
      code: "AUTH_REQUIRED",
      error: {
        code: "AUTH_REQUIRED",
        message: "Authentication required. Authorization header with Bearer token is required."
      }
    });
    return;
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    res.status(401).json({
      success: false,
      code: "INVALID_TOKEN",
      error: {
        code: "INVALID_TOKEN",
        message: "Bearer token is empty."
      }
    });
    return;
  }

  // Allow test tokens in non-production environments or when Supabase admin is not configured
  if (process.env.NODE_ENV !== "production" && token.includes("admin-test")) {
    const isTestAdmin = true;
    const testUser: AuthenticatedUser = {
      id: "admin-test-user-id",
      uid: "admin-test-user-id",
      email: "sarveshtiwarisarvesh@gmail.com",
      role: "admin",
      name: "Admin Developer",
      picture: "",
    };
    (req as any).user = testUser;
    (req as any).supabaseUser = testUser;
    next();
    return;
  }

  // If Supabase is not configured in local/dev test environments, allow test token bypass or decode
  if (!isSupabaseAdminConfigured()) {
    if (process.env.NODE_ENV !== "production") {
      // In local dev/test without live Supabase credentials, construct mock user from token or defaults
      const isTestAdmin = token.includes("admin");
      const testEmail = isTestAdmin ? "sarveshtiwarisarvesh@gmail.com" : "developer@local.test";
      const testUser: AuthenticatedUser = {
        id: isTestAdmin ? "admin-test-user-id" : "dev-test-user-id",
        uid: isTestAdmin ? "admin-test-user-id" : "dev-test-user-id",
        email: testEmail,
        role: isTestAdmin ? "admin" : "user",
        name: isTestAdmin ? "Admin Developer" : "Local Developer",
        picture: "",
      };
      (req as any).user = testUser;
      (req as any).supabaseUser = testUser;
      next();
      return;
    }

    res.status(503).json({
      success: false,
      code: "SUPABASE_UNAVAILABLE",
      error: "Supabase service is not configured on the server.",
    });
    return;
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !data?.user) {
      res.status(401).json({
        success: false,
        code: "INVALID_TOKEN",
        error: error?.message || "Invalid or expired Supabase authentication token.",
      });
      return;
    }

    const sbUser = data.user;
    const email = (sbUser.email || "").trim().toLowerCase();

    // Application role/status comes from the server-side profiles table, with
    // fallback to email identity and metadata when profiles are being initialized.
    let profile: any = null;
    try {
      const { data: profileData, error: profileError } = await supabaseAdmin
        .from("profiles")
        .select("*")
        .eq("id", sbUser.id)
        .maybeSingle();

      if (!profileError && profileData) {
        profile = profileData;
      } else if (email) {
        // Fallback: check profile by email if id query was empty or encountered a column mismatch
        const { data: emailProfile } = await supabaseAdmin
          .from("profiles")
          .select("*")
          .eq("email", email)
          .maybeSingle();
        if (emailProfile) {
          profile = emailProfile;
        }
      }
    } catch (lookupErr: any) {
      console.warn("[AUTH] Profile lookup warning:", lookupErr?.message || lookupErr);
    }

    const role = profile?.role === "admin" || isAdminEmail(email) ? "admin" : "user";
    const isActive = profile?.is_active ?? true;
    if (!isActive) {
      res.status(403).json({ success: false, code: "ACCOUNT_DISABLED", error: "This account has been disabled by an administrator." });
      return;
    }

    const authUser: AuthenticatedUser = {
      id: sbUser.id,
      uid: sbUser.id,
      email: sbUser.email || "",
      role,
      name: profile?.full_name || profile?.displayName || sbUser.user_metadata?.full_name || sbUser.email?.split("@")[0] || "User",
      picture: profile?.photo_url || profile?.avatar_url || sbUser.user_metadata?.avatar_url || "",
      user_metadata: sbUser.user_metadata,
      app_metadata: sbUser.app_metadata,
    };

    (req as any).user = authUser;
    (req as any).supabaseUser = authUser;
    next();
  } catch (err: any) {
    res.status(401).json({
      success: false,
      code: "AUTH_VERIFICATION_FAILED",
      error: err.message || "Failed to verify Supabase authentication token.",
    });
  }
}

/**
 * Ensures the authenticated user has administrative privileges.
 */
export async function requireAdminUser(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  await requireAuthenticatedUser(req, res, async () => {
    const user = (req as any).user as AuthenticatedUser | undefined;
    if (!user) {
      res.status(401).json({
        success: false,
        code: "AUTH_REQUIRED",
        error: {
          code: "AUTH_REQUIRED",
          message: "Authentication required"
        }
      });
      return;
    }
    if (user.role !== "admin") {
      // The role was already derived from the authoritative profiles row.
      res.status(403).json({
        success: false,
        code: "ADMIN_REQUIRED",
        error: {
          code: "ADMIN_REQUIRED",
          message: "Administrator privileges required"
        }
      });
      return;
    }
    next();
  });
}

export function getSupabaseAuthDiagnostics() {
  return {
    configured: isSupabaseAdminConfigured(),
    url: getEffectiveSupabaseUrl(),
  };
}
