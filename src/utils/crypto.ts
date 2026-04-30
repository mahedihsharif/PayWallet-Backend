import crypto from "crypto";
import env from "../config/env.config";

const ALGORITHM = "aes-256-gcm";
const KEY = Buffer.from(env.ENCRYPTION_KEY, "hex"); // Must be exactly 32 bytes

// ─── Encrypt a string ─────────────────────────────────────────────
export const encrypt = (plaintext: string): string => {
  const iv = crypto.randomBytes(16); // New IV for every encryption
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag(); // GCM authentication tag

  // Store as: iv:authTag:ciphertext (all hex-encoded)
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
};

// ─── Decrypt a string ─────────────────────────────────────────────
export const decrypt = (ciphertext: string): string => {
  const [ivHex, authTagHex, encrypted] = ciphertext.split(":");

  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");

  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
};
