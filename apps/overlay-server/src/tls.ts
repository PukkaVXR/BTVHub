import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import selfsigned from "selfsigned";

const CERT_DIR = join(dirname(fileURLToPath(import.meta.url)), "../../../data/certs");
const KEY_PATH = join(CERT_DIR, "key.pem");
const CERT_PATH = join(CERT_DIR, "cert.pem");

export interface TlsMaterial {
  key: Buffer;
  cert: Buffer;
}

export function ensureTlsMaterial(): TlsMaterial {
  if (!existsSync(CERT_DIR)) mkdirSync(CERT_DIR, { recursive: true });

  if (existsSync(KEY_PATH) && existsSync(CERT_PATH)) {
    return {
      key: readFileSync(KEY_PATH),
      cert: readFileSync(CERT_PATH),
    };
  }

  const attrs = [{ name: "commonName", value: "BTV Local Dev" }];
  const pems = selfsigned.generate(attrs, {
    days: 825,
    keySize: 2048,
    algorithm: "sha256",
    extensions: [
      {
        name: "subjectAltName",
        altNames: [
          { type: 2, value: "localhost" },
          { type: 7, ip: "127.0.0.1" },
        ],
      },
    ],
  });

  writeFileSync(KEY_PATH, pems.private);
  writeFileSync(CERT_PATH, pems.cert);

  return {
    key: Buffer.from(pems.private),
    cert: Buffer.from(pems.cert),
  };
}

export function getCertPaths() {
  return { keyPath: KEY_PATH, certPath: CERT_PATH, certDir: CERT_DIR };
}
