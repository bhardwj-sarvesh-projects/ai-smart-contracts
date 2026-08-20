import crypto from "crypto";

/**
 * Versioned server-side encryption for administrator-managed AI credentials.
 *
 * v2 uses AES-256-GCM (authenticated encryption). Existing v1 AES-256-CBC
 * records remain decryptable so a deployment can be upgraded without losing
 * already-stored credentials. New writes always use v2.
 */
const V2_PREFIX = "v2";
const LEGACY_ALGORITHM = "aes-256-cbc";
const V2_ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getEncryptionSecret(): string {
  const secret = process.env.ENCRYPTION_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new Error("ENCRYPTION_SECRET must be configured with at least 32 characters. Refusing to use an insecure fallback encryption key.");
  }
  return secret;
}

function deriveKey(secret: string, salt: Buffer): Buffer {
  return crypto.scryptSync(secret, salt, KEY_LENGTH);
}

export function encrypt(text: string): string {
  if (!text) return "";

  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = deriveKey(getEncryptionSecret(), salt);
  const cipher = crypto.createCipheriv(V2_ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

  const ciphertext = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    V2_PREFIX,
    salt.toString("base64url"),
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(":");
}

function decryptV2(parts: string[]): string {
  if (parts.length !== 5) return "";
  const [, saltRaw, ivRaw, tagRaw, cipherRaw] = parts;
  const salt = Buffer.from(saltRaw, "base64url");
  const iv = Buffer.from(ivRaw, "base64url");
  const tag = Buffer.from(tagRaw, "base64url");
  const ciphertext = Buffer.from(cipherRaw, "base64url");

  if (salt.length !== SALT_LENGTH || iv.length !== IV_LENGTH || tag.length !== AUTH_TAG_LENGTH || ciphertext.length === 0) {
    return "";
  }

  const key = deriveKey(getEncryptionSecret(), salt);
  const decipher = crypto.createDecipheriv(V2_ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

function decryptLegacyV1(encryptedText: string): string {
  const parts = encryptedText.split(":");
  if (parts.length !== 2) return "";

  const iv = Buffer.from(parts[0], "hex");
  const ciphertext = Buffer.from(parts[1], "hex");
  if (iv.length !== 16 || ciphertext.length === 0) return "";

  const secret = getEncryptionSecret();
  const key = crypto.scryptSync(secret, "ai-contracts-encryption-v1", KEY_LENGTH);
  const decipher = crypto.createDecipheriv(LEGACY_ALGORITHM, key, iv);
  return decipher.update(ciphertext, undefined, "utf8") + decipher.final("utf8");
}

export function decrypt(encryptedText: string): string {
  if (!encryptedText) return "";

  try {
    const parts = encryptedText.split(":");
    if (parts[0] === V2_PREFIX) return decryptV2(parts);
    // Backward compatibility for credentials written by the previous release.
    return decryptLegacyV1(encryptedText);
  } catch (error) {
    console.error("[ENCRYPTION] Decryption failed:", error instanceof Error ? error.message : "unknown error");
    return "";
  }
}
