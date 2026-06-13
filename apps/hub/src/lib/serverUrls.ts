const DEFAULT_OVERLAY_PORT = "4782";
const HUB_PORT = "4781";

function configuredValue(name: string): string | undefined {
  return (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env?.[name]?.trim() || undefined;
}

function withoutTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

export function resolveOverlayOrigin(): string {
  const configuredOrigin = configuredValue("VITE_BTV_OVERLAY_ORIGIN");
  if (configuredOrigin) return withoutTrailingSlash(configuredOrigin);

  const configuredApi = configuredValue("VITE_BTV_API_BASE");
  if (configuredApi && /^https?:\/\//i.test(configuredApi)) {
    return withoutTrailingSlash(configuredApi).replace(/\/api$/i, "");
  }

  if (typeof window === "undefined") return `http://127.0.0.1:${DEFAULT_OVERLAY_PORT}`;
  const url = new URL(window.location.href);
  if (url.port === HUB_PORT) url.port = DEFAULT_OVERLAY_PORT;
  url.pathname = "";
  url.search = "";
  url.hash = "";
  return withoutTrailingSlash(url.origin);
}

export function resolveApiBase(): string {
  const configuredApi = configuredValue("VITE_BTV_API_BASE");
  if (configuredApi) return withoutTrailingSlash(configuredApi);
  return "/api";
}

export function overlayUrl(path: string, origin = resolveOverlayOrigin()): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${withoutTrailingSlash(origin)}/${path.replace(/^\/+/, "")}`;
}
