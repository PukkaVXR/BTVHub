import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ALGO = "aes-256-gcm";
const KEY_PATH = join(dirname(fileURLToPath(import.meta.url)), "../../../data/.key");
const SALT_PATH = join(dirname(fileURLToPath(import.meta.url)), "../../../data/.salt");
const LEGACY_SALT = "btv-salt";
const ENVELOPE_PREFIX = "btv1";

function ensureSecretFile(path: string, bytes = 32): Buffer {
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  if (!existsSync(path)) {
    const value = randomBytes(bytes);
    writeSecretFile(path, value);
    return value;
  }
  const value = readFileSync(path);
  if (value.length >= bytes) return value;
  const replacement = randomBytes(bytes);
  writeSecretFile(path, replacement);
  return replacement;
}

function writeSecretFile(path: string, value: Buffer): void {
  writeFileSync(path, value, { mode: 0o600 });
  try {
    chmodSync(path, 0o600);
  } catch {
    // Best effort on Windows and restricted filesystems.
  }
}

function getMasterKey(): Buffer {
  const envKey = process.env.BTV_MASTER_KEY?.trim();
  if (envKey) {
    return Buffer.from(envKey, envKey.includes("=") ? "base64" : "utf8");
  }
  return ensureSecretFile(KEY_PATH, 32);
}

function getLegacyFileMasterKey(): Buffer | null {
  if (!existsSync(KEY_PATH)) return null;
  return readFileSync(KEY_PATH);
}

function getInstallSalt(): Buffer {
  return ensureSecretFile(SALT_PATH, 32);
}

const masterKey = getMasterKey();
const installSalt = getInstallSalt();
const encryptionKey = scryptSync(masterKey, installSalt, 32);

function legacyKeys(): Buffer[] {
  const fileMaster = getLegacyFileMasterKey();
  if (!fileMaster) return [];
  return [
    scryptSync(fileMaster, LEGACY_SALT, 32),
    scryptSync(fileMaster, installSalt, 32),
  ];
}

export function encrypt(text: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, encryptionKey, iv);
  const enc = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [ENVELOPE_PREFIX, iv.toString("base64"), tag.toString("base64"), enc.toString("base64")].join(":");
}

export function decrypt(payload: string): string {
  if (payload.startsWith(`${ENVELOPE_PREFIX}:`)) {
    const [, ivBase64, tagBase64, dataBase64] = payload.split(":");
    return decryptParts(
      encryptionKey,
      Buffer.from(ivBase64, "base64"),
      Buffer.from(tagBase64, "base64"),
      Buffer.from(dataBase64, "base64"),
    );
  }

  const buf = Buffer.from(payload, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const candidates = [encryptionKey, ...legacyKeys()];
  for (const key of candidates) {
    try {
      return decryptParts(key, iv, tag, data);
    } catch {
      // Try the next compatible key derivation.
    }
  }
  throw new Error("Unable to decrypt payload");
}

function decryptParts(key: Buffer, iv: Buffer, tag: Buffer, data: Buffer): string {
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
