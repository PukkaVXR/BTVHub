export function safeDownloadName(value: string, fallback = "download", separator = "-"): string {
  const escapedSeparator = separator.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, separator)
    .replace(new RegExp(`^${escapedSeparator}+|${escapedSeparator}+$`, "g"), "") || fallback;
}

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function downloadJsonFile(filename: string, data: unknown, trailingNewline = true): void {
  const json = JSON.stringify(data, null, 2) + (trailingNewline ? "\n" : "");
  downloadBlob(filename, new Blob([json], { type: "application/json" }));
}
