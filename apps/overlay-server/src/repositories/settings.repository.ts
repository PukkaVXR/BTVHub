import type { DatabaseSync } from "node:sqlite";

interface SettingsRepositoryDeps {
  getDb: () => DatabaseSync;
  encrypt: (value: string) => string;
  decrypt: (value: string) => string;
}

export function createSettingsRepository({ getDb, encrypt, decrypt }: SettingsRepositoryDeps) {
  function getSetting(key: string): string | null {
    const row = getDb().prepare("SELECT value FROM settings WHERE key = ?").get(key) as
      | { value: string }
      | undefined;
    return row?.value ?? null;
  }

  function setSetting(key: string, value: string): void {
    getDb().prepare(
      `INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    ).run(key, value);
  }

  function deleteSetting(key: string): void {
    getDb().prepare("DELETE FROM settings WHERE key = ?").run(key);
  }

  function getSettingsSnapshot(): Array<{ key: string; value: string }> {
    const secretPattern = /(secret|password|token|oauth_state)/i;
    return (getDb().prepare("SELECT key, value FROM settings ORDER BY key").all() as Array<{
      key: string;
      value: string;
    }>).map((row) => ({
      key: row.key,
      value: secretPattern.test(row.key) ? "[redacted]" : row.value,
    }));
  }

  function getEncryptedSetting(key: string): string | null {
    const raw = getSetting(key);
    if (!raw) return null;
    try {
      return decrypt(raw);
    } catch {
      return null;
    }
  }

  function setEncryptedSetting(key: string, value: string): void {
    setSetting(key, encrypt(value));
  }

  return {
    getSetting,
    setSetting,
    deleteSetting,
    getSettingsSnapshot,
    getEncryptedSetting,
    setEncryptedSetting,
  };
}
