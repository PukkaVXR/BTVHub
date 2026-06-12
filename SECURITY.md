# BTV Local Security Notes

## Local Secret Storage

BTV encrypts local secrets such as Twitch tokens, Spotify tokens, OBS passwords, API tokens, GIPHY keys, and webhook secrets before storing them in `data/btv.db`.

New encrypted values use a versioned `btv1` envelope with AES-256-GCM and a per-install random salt stored in `data/.salt`. Older encrypted values that used the original fixed salt remain readable for backwards compatibility and are rewritten in the new format when saved again.

By default, BTV creates a local master key at `data/.key` with restrictive file permissions where the operating system supports them. For a stronger setup, set `BTV_MASTER_KEY` before starting the overlay server. When `BTV_MASTER_KEY` is present, new secrets are encrypted with that external master key instead of relying on `data/.key`.

Example:

```powershell
$env:BTV_MASTER_KEY = "<long random secret or base64 key>"
```

Keep `BTV_MASTER_KEY`, `data/.key`, and `data/.salt` private. Losing the active master key means existing encrypted settings cannot be decrypted.
