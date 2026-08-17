import crypto from "crypto";
const ALGORITHM = "aes-256-cbc";
const secret = process.env.ENCRYPTION_SECRET;
if (!secret || secret.length < 32) throw new Error("ENCRYPTION_SECRET must be configured and at least 32 characters long.");
const ENCRYPTION_KEY = crypto.scryptSync(secret, "ai-contracts-encryption-v1", 32);
export function encrypt(text: string): string {
  if (!text) return ""; const iv = crypto.randomBytes(16); const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, "utf8", "hex"); encrypted += cipher.final("hex"); return `${iv.toString("hex")}:${encrypted}`;
}
export function decrypt(encryptedText: string): string {
  if (!encryptedText) return ""; const parts = encryptedText.split(":"); if (parts.length !== 2) return "";
  try { const iv = Buffer.from(parts[0], "hex"); if (iv.length !== 16) return ""; const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv); let out=decipher.update(parts[1], "hex", "utf8"); out += decipher.final("utf8"); return out; }
  catch (err) { console.error("Decryption failed:", err); return ""; }
}
