import crypto from "crypto";

const ALGORITHM = "aes-256-cbc";
// Derives a standard 32-byte key from ENCRYPTION_SECRET or a robust fallback
const ENCRYPTION_KEY = process.env.ENCRYPTION_SECRET
  ? crypto.scryptSync(process.env.ENCRYPTION_SECRET, "salt", 32)
  : crypto.scryptSync("smartcontract-ai-studio-fallback-secret-2026", "salt", 32);

export function encrypt(text: string): string {
  if (!text) return "";
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return `${iv.toString("hex")}:${encrypted}`;
}

export function decrypt(encryptedText: string): string {
  if (!encryptedText) return "";
  const parts = encryptedText.split(":");
  if (parts.length !== 2) {
    // If not in the format of "iv:encrypted", return as is (useful for empty/plain during migration)
    return encryptedText;
  }
  try {
    const iv = Buffer.from(parts[0], "hex");
    const encrypted = parts[1];
    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (err) {
    console.error("Decryption failed:", err);
    return "";
  }
}
