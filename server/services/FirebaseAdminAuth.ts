import { applicationDefault, cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type DecodedIdToken } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

/**
 * Server-side Firebase authentication for protected APIs.
 *
 * Credential resolution order:
 * 1. FIREBASE_SERVICE_ACCOUNT_JSON
 * 2. FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY
 * 3. Google Application Default Credentials
 *
 * Never accept Firebase Admin credentials from the browser.
 */

const DEFAULT_ADMIN_EMAIL = "sarveshtiwarisarvesh@gmail.com";
let cachedApp: App | null = null;
let initializationError: Error | null = null;

function getConfiguredAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || DEFAULT_ADMIN_EMAIL)
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

function parseServiceAccountJson(raw: string) {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is missing project_id, client_email, or private_key.");
    }
    return {
      projectId: parsed.project_id,
      clientEmail: parsed.client_email,
      privateKey: String(parsed.private_key).replace(/\\n/g, "\n"),
    };
  } catch (error: any) {
    throw new Error(`Invalid FIREBASE_SERVICE_ACCOUNT_JSON: ${error?.message || String(error)}`);
  }
}

function getAdminApp(): App {
  if (cachedApp) return cachedApp;
  if (initializationError) throw initializationError;

  try {
    const existing = getApps()[0];
    if (existing) {
      cachedApp = existing;
      return existing;
    }

    const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();

    if (rawJson) {
      const account = parseServiceAccountJson(rawJson);
      cachedApp = initializeApp({
        credential: cert(account),
      });
      return cachedApp;
    }

    const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.trim();

    if (projectId && clientEmail && privateKey) {
      cachedApp = initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey: privateKey.replace(/\\n/g, "\n"),
        }),
      });
      return cachedApp;
    }

    // This works in Google-managed environments such as Cloud Run/App Hosting.
    cachedApp = initializeApp({ credential: applicationDefault() });
    return cachedApp;
  } catch (error: any) {
    initializationError = new Error(
      `Firebase Admin initialization failed. Configure FIREBASE_SERVICE_ACCOUNT_JSON, ` +
      `or FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY, ` +
      `or provide Google Application Default Credentials. ${error?.message || String(error)}`
    );
    throw initializationError;
  }
}

export function getAdminAuth() {
  return getAuth(getAdminApp());
}

export function getAdminFirestore() {
  return getFirestore(getAdminApp());
}

export async function verifyBearerToken(authorization?: string): Promise<DecodedIdToken> {
  if (!authorization || !authorization.startsWith("Bearer ")) {
    const error = new Error("Missing Firebase bearer token.");
    (error as any).code = "AUTH_MISSING_TOKEN";
    throw error;
  }

  const token = authorization.slice("Bearer ".length).trim();
  if (!token) {
    const error = new Error("Missing Firebase bearer token.");
    (error as any).code = "AUTH_MISSING_TOKEN";
    throw error;
  }

  // Do not force revocation checking here. It adds a network dependency to every
  // protected request and can turn a valid ID token into a false authentication
  // failure. Firebase Admin still verifies the token signature, issuer, audience,
  // expiry, and subject. Disabled-user handling is checked separately below.
  return getAdminAuth().verifyIdToken(token);
}

function isInitializationError(error: any): boolean {
  const message = String(error?.message || "");
  return (
    error?.code === "app/invalid-credential" ||
    message.includes("Firebase Admin initialization failed") ||
    message.includes("Could not load the default credentials") ||
    message.includes("Failed to determine project ID") ||
    message.includes("Invalid FIREBASE_SERVICE_ACCOUNT_JSON")
  );
}

export async function requireAuthenticatedUser(req: any, res: any, next: any) {
  try {
    const decoded = await verifyBearerToken(req.headers.authorization);

    // Verify the current account is not disabled. This is intentionally done
    // after cryptographic token verification so client-supplied headers never
    // participate in authentication.
    const account = await getAdminAuth().getUser(decoded.uid);
    if (account.disabled) {
      return res.status(403).json({
        error: "Account disabled",
        message: "This Firebase account has been disabled.",
      });
    }

    req.firebaseUser = decoded;
    next();
  } catch (error: any) {
    if (isInitializationError(error) || initializationError) {
      return res.status(503).json({
        error: "Firebase Admin authentication unavailable",
        code: "FIREBASE_ADMIN_NOT_CONFIGURED",
        message: "The server cannot verify Firebase users because Firebase Admin credentials are not configured correctly.",
      });
    }

    return res.status(401).json({
      error: "Unauthorized",
      code: error?.code || "AUTH_INVALID_TOKEN",
      message: "Your Firebase session could not be verified. Please sign out and sign in again.",
    });
  }
}

export async function requireAdminUser(req: any, res: any, next: any) {
  try {
    const decoded = await verifyBearerToken(req.headers.authorization);

    const account = await getAdminAuth().getUser(decoded.uid);
    if (account.disabled) {
      return res.status(403).json({
        error: "Account disabled",
        code: "ACCOUNT_DISABLED",
        message: "This Firebase account has been disabled.",
      });
    }

    const configuredAdminEmails = getConfiguredAdminEmails();
    const tokenEmail = String(decoded.email || "").trim().toLowerCase();
    const isAdminClaim = decoded.admin === true || decoded.role === "admin";
    const isAdminEmail = Boolean(tokenEmail) && configuredAdminEmails.includes(tokenEmail);

    if (!isAdminClaim && !isAdminEmail) {
      return res.status(403).json({
        error: "Access denied",
        code: "ADMIN_REQUIRED",
        message: "The authenticated Firebase account is not listed as an administrator.",
      });
    }

    req.firebaseUser = decoded;
    req.isAdmin = true;
    next();
  } catch (error: any) {
    if (isInitializationError(error) || initializationError) {
      return res.status(503).json({
        error: "Firebase Admin authentication unavailable",
        code: "FIREBASE_ADMIN_NOT_CONFIGURED",
        message: "The server cannot verify administrator access because Firebase Admin credentials are not configured correctly.",
      });
    }

    return res.status(401).json({
      error: "Unauthorized",
      code: error?.code || "AUTH_INVALID_TOKEN",
      message: "Your Firebase administrator session could not be verified. Please sign out and sign in again.",
    });
  }
}
