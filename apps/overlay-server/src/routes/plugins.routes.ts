import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { FastifyInstance } from "fastify";
import type {
  PluginCapabilityType,
  PluginExtensionCatalog,
  PluginManifest,
  PluginPack,
  PluginPermission,
  PluginPermissionDefinition,
  PluginRegistryDiagnostics,
  PluginRegistryItem,
  PluginRegistryResponse,
} from "@btv/shared";
import { getSetting, setSetting } from "../db.js";
import type { ServerContext } from "./types.js";

const PLUGIN_API_VERSION = "1.0.0";
const PLUGIN_DIR = join(dirname(fileURLToPath(import.meta.url)), "../../../../data/plugins");
const PERMISSION_DEFINITIONS: PluginPermissionDefinition[] = [
  { permission: "alerts:read", label: "Read alerts", description: "View alert projects, routes, and test routing data.", risk: "low" },
  { permission: "alerts:write", label: "Manage alerts", description: "Create, edit, test, or route alert projects.", risk: "medium" },
  { permission: "automations:read", label: "Read automations", description: "View automation rules and related state.", risk: "low" },
  { permission: "automations:write", label: "Manage automations", description: "Create, edit, run, or delete automation rules.", risk: "high" },
  { permission: "commands:read", label: "Read commands", description: "View chat commands, command groups, and command metadata.", risk: "low" },
  { permission: "commands:write", label: "Manage commands", description: "Create, edit, or delete chat commands.", risk: "medium" },
  { permission: "obs:read", label: "Read OBS", description: "View OBS connection, scenes, sources, and source state.", risk: "low" },
  { permission: "obs:write", label: "Control OBS", description: "Change scenes, sources, browser source properties, or trigger OBS actions.", risk: "high" },
  { permission: "overlays:read", label: "Read overlays", description: "View browser sources, widgets, themes, and overlay layouts.", risk: "low" },
  { permission: "overlays:write", label: "Manage overlays", description: "Create, edit, export, or apply overlay layouts and widget visuals.", risk: "medium" },
  { permission: "settings:read", label: "Read settings", description: "View non-secret app settings and integration status.", risk: "medium" },
  { permission: "settings:write", label: "Manage settings", description: "Change app configuration, integration settings, or plugin settings.", risk: "high" },
  { permission: "twitch:read", label: "Read Twitch", description: "View Twitch account, chat, badges, events, and channel metadata.", risk: "medium" },
  { permission: "twitch:write", label: "Use Twitch actions", description: "Send Twitch chat messages or perform supported channel actions.", risk: "high" },
  { permission: "webhooks:read", label: "Read webhooks", description: "View webhook endpoints, rules, and delivery history.", risk: "low" },
  { permission: "webhooks:write", label: "Manage webhooks", description: "Create, edit, or delete webhook endpoints and rules.", risk: "high" },
];

const CORE_PLUGIN: PluginManifest = {
  id: "btv.core",
  name: "BTV Core",
  version: "1.0.0",
  apiVersion: PLUGIN_API_VERSION,
  description: "Built-in BTV actions, triggers, widgets, overlay exports, and Stream Deck controls.",
  author: "BTV",
  capabilities: [
    { id: "core.actions", type: "action", name: "Core actions", description: "Macros, OBS controls, alerts, emergency actions, and source groups." },
    { id: "core.triggers", type: "trigger", name: "Core triggers", description: "Twitch events, chat commands, timers, webhooks, and manual triggers." },
    { id: "core.widgets", type: "widget", name: "Core widgets", description: "Chat, goals, ticker, event list, now playing, and alert browser sources." },
    { id: "core.exporters", type: "exporter", name: "Core exporters", description: "Stream Deck actions, overlay packs, automation packs, and future profile exports." },
  ],
  permissions: [
    "alerts:read",
    "alerts:write",
    "automations:read",
    "automations:write",
    "commands:read",
    "commands:write",
    "obs:read",
    "obs:write",
    "overlays:read",
    "overlays:write",
    "settings:read",
    "settings:write",
    "twitch:read",
    "twitch:write",
    "webhooks:read",
    "webhooks:write",
  ],
  settings: [],
};

export function registerPluginsRoutes(app: FastifyInstance, _ctx: ServerContext): void {
  app.get("/api/plugins", async (): Promise<PluginRegistryResponse> => {
    ensurePluginDirectory();
    const plugins = [
      buildRegistryItem(CORE_PLUGIN, "built-in", "enabled", undefined, []),
      ...loadLocalPlugins(),
    ];
    return {
      plugins,
      pluginDirectory: PLUGIN_DIR,
      apiVersion: PLUGIN_API_VERSION,
      permissionDefinitions: PERMISSION_DEFINITIONS,
      extensionCatalog: buildExtensionCatalog(plugins),
    };
  });

  app.put<{ Params: { id: string }; Body: { enabled: boolean } }>("/api/plugins/:id/enabled", async (req, reply) => {
    const plugin = findPlugin(req.params.id);
    if (!plugin) return reply.code(404).send({ error: "Plugin not found" });
    if (plugin.source === "built-in") return reply.code(400).send({ error: "Built-in plugins cannot be disabled" });
    setSetting(pluginEnabledKey(plugin.manifest.id), req.body.enabled ? "1" : "0");
    return { ok: true, plugin: buildRegistryItem(plugin.manifest, plugin.source, plugin.baseStatus, plugin.path, plugin.warnings) };
  });

  app.put<{ Params: { id: string }; Body: { settings: Record<string, unknown> } }>("/api/plugins/:id/settings", async (req, reply) => {
    const plugin = findPlugin(req.params.id);
    if (!plugin) return reply.code(404).send({ error: "Plugin not found" });

    const current = readPluginSettings(plugin.manifest);
    const nextSettings: Record<string, string | number | boolean> = {};

    for (const setting of plugin.manifest.settings ?? []) {
      const incoming = req.body.settings?.[setting.key];
      if (incoming == null || incoming === "") {
        if (setting.type === "secret" && current.configuredSecrets.includes(setting.key)) continue;
        if (setting.required) return reply.code(400).send({ error: `${setting.label} is required` });
        continue;
      }
      if (setting.type === "number") nextSettings[setting.key] = Number(incoming);
      else if (setting.type === "boolean") nextSettings[setting.key] = Boolean(incoming);
      else nextSettings[setting.key] = String(incoming);
    }

    setSetting(pluginSettingsKey(plugin.manifest.id), JSON.stringify({ ...current.raw, ...nextSettings }));
    return { ok: true, plugin: buildRegistryItem(plugin.manifest, plugin.source, plugin.baseStatus, plugin.path, plugin.warnings) };
  });

  app.put<{
    Params: { id: string };
    Body: {
      name?: string;
      description?: string;
      author?: string;
      capabilities?: PluginCapabilityType[];
      permissions?: PluginPermission[];
    };
  }>("/api/plugins/:id/manifest", async (req, reply) => {
    const plugin = findPlugin(req.params.id);
    if (!plugin) return reply.code(404).send({ error: "Plugin not found" });
    if (plugin.source === "built-in") return reply.code(400).send({ error: "Built-in plugin manifests cannot be edited" });
    if (!plugin.path) return reply.code(400).send({ error: "Plugin path is not available" });

    const name = req.body.name?.trim() || plugin.manifest.name;
    const capabilityTypes = req.body.capabilities == null
      ? plugin.manifest.capabilities.map((capability) => capability.type)
      : req.body.capabilities;
    const permissionValues = req.body.permissions == null ? plugin.manifest.permissions : req.body.permissions;

    const invalidCapabilities = capabilityTypes.filter((type) => !isCapabilityType(type));
    if (invalidCapabilities.length) return reply.code(400).send({ error: `Unsupported capabilities: ${invalidCapabilities.join(", ")}` });

    const invalidPermissions = permissionValues.filter((permission) => !isPluginPermission(permission));
    if (invalidPermissions.length) return reply.code(400).send({ error: `Unsupported permissions: ${invalidPermissions.join(", ")}` });

    const nextManifest: PluginManifest = {
      ...plugin.manifest,
      name,
      description: req.body.description?.trim() || undefined,
      author: req.body.author?.trim() || undefined,
      capabilities: [...new Set(capabilityTypes)].map((type) => ({
        id: `${plugin.manifest.id}.${type}`,
        type,
        name: `${name} ${capabilityLabel(type)}`,
        description: `Development ${type} extension registered by ${name}.`,
      })),
      permissions: [...new Set(permissionValues)],
    };
    writePluginManifest(plugin.path, nextManifest);

    const warnings = validateManifest(nextManifest);
    return {
      ok: true,
      plugin: buildRegistryItem(nextManifest, "local", warnings.length ? "invalid" : "development", plugin.path, warnings),
    };
  });

  app.get<{ Params: { id: string } }>("/api/plugins/:id/export", async (req, reply) => {
    const plugin = findPlugin(req.params.id);
    if (!plugin) return reply.code(404).send({ error: "Plugin not found" });
    const item = buildRegistryItem(plugin.manifest, plugin.source, plugin.baseStatus, plugin.path, plugin.warnings);
    const pack: PluginPack = {
      format: "btv.plugin-pack",
      version: 1,
      exportedAt: new Date().toISOString(),
      manifest: item.manifest,
      enabled: item.enabled,
      settingsValues: item.settingsValues,
    };
    return reply
      .header("Content-Type", "application/json")
      .header("Content-Disposition", `attachment; filename="${safeFileName(item.manifest.name)}.btv-plugin.json"`)
      .send(pack);
  });

  app.post<{ Body: { pack: PluginPack } }>("/api/plugins/import", async (req, reply) => {
    const pack = req.body.pack;
    const warnings = validatePluginPack(pack);
    if (warnings.length) return reply.code(400).send({ error: warnings.join(" ") });

    ensurePluginDirectory();
    const manifest = normalizeManifest(pack.manifest, pack.manifest.id);
    const pluginDir = join(PLUGIN_DIR, safeDirectoryName(manifest.id));
    mkdirSync(pluginDir, { recursive: true });
    writeFileSync(join(pluginDir, "btv.plugin.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    setSetting(pluginEnabledKey(manifest.id), pack.enabled ? "1" : "0");
    setSetting(pluginSettingsKey(manifest.id), JSON.stringify(pack.settingsValues ?? {}));

    return {
      ok: true,
      plugin: buildRegistryItem(manifest, "local", validateManifest(manifest).length ? "invalid" : "development", pluginDir, validateManifest(manifest)),
    };
  });

  app.post<{
    Body: {
      id?: string;
      name?: string;
      description?: string;
      author?: string;
      capabilities?: PluginCapabilityType[];
    };
  }>("/api/plugins/dev", async (req, reply) => {
    const name = req.body.name?.trim();
    if (!name) return reply.code(400).send({ error: "Plugin name is required" });

    const id = safePluginId(req.body.id?.trim() || name);
    const capabilityTypes = (req.body.capabilities?.filter(isCapabilityType) ?? ["action"]) as PluginCapabilityType[];
    const uniqueCapabilityTypes = [...new Set(capabilityTypes)];
    const pluginDir = join(PLUGIN_DIR, safeDirectoryName(id));

    if (existsSync(pluginDir)) return reply.code(409).send({ error: "A plugin with this id already exists" });

    const manifest: PluginManifest = {
      id,
      name,
      version: "0.1.0",
      apiVersion: PLUGIN_API_VERSION,
      description: req.body.description?.trim() || "Local BTV development plugin.",
      author: req.body.author?.trim() || "Local creator",
      capabilities: uniqueCapabilityTypes.map((type) => ({
        id: `${id}.${type}`,
        type,
        name: `${name} ${capabilityLabel(type)}`,
        description: `Development ${type} extension registered by ${name}.`,
      })),
      permissions: [],
      settings: [],
    };

    ensurePluginDirectory();
    mkdirSync(pluginDir, { recursive: true });
    writeFileSync(join(pluginDir, "btv.plugin.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    writeFileSync(join(pluginDir, "README.md"), `${pluginReadme(manifest)}\n`, "utf8");
    setSetting(pluginEnabledKey(manifest.id), "1");

    return { ok: true, plugin: buildRegistryItem(manifest, "local", "development", pluginDir, []) };
  });
}

function ensurePluginDirectory(): void {
  if (!existsSync(PLUGIN_DIR)) mkdirSync(PLUGIN_DIR, { recursive: true });
}

function loadLocalPlugins(): PluginRegistryItem[] {
  return readdirSync(PLUGIN_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => loadLocalPlugin(entry.name));
}

function loadLocalPlugin(directoryName: string): PluginRegistryItem {
  const pluginPath = join(PLUGIN_DIR, directoryName);
  const manifestPath = findManifestPath(pluginPath);

  if (!manifestPath) {
    return invalidPlugin(directoryName, pluginPath, ["Missing btv.plugin.json or plugin.json manifest."]);
  }

  try {
    const raw = JSON.parse(readFileSync(manifestPath, "utf8")) as Partial<PluginManifest>;
    const warnings = validateManifest(raw);
    const manifest = normalizeManifest(raw, directoryName);
    return buildRegistryItem(manifest, "local", warnings.length ? "invalid" : "development", pluginPath, warnings);
  } catch (error) {
    return invalidPlugin(directoryName, pluginPath, [
      error instanceof Error ? error.message : "Could not read plugin manifest.",
    ]);
  }
}

function findManifestPath(pluginPath: string): string | null {
  const preferred = join(pluginPath, "btv.plugin.json");
  if (existsSync(preferred)) return preferred;
  const fallback = join(pluginPath, "plugin.json");
  if (existsSync(fallback)) return fallback;
  return null;
}

function writePluginManifest(pluginPath: string, manifest: PluginManifest): void {
  writeFileSync(join(pluginPath, "btv.plugin.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

function validateManifest(manifest: Partial<PluginManifest>): string[] {
  const warnings: string[] = [];
  if (!manifest.id || typeof manifest.id !== "string") warnings.push("Manifest id is required.");
  if (!manifest.name || typeof manifest.name !== "string") warnings.push("Manifest name is required.");
  if (!manifest.version || typeof manifest.version !== "string") warnings.push("Manifest version is required.");
  if (!manifest.apiVersion || typeof manifest.apiVersion !== "string") warnings.push("Manifest apiVersion is required.");
  if (!Array.isArray(manifest.capabilities)) warnings.push("Manifest capabilities must be an array.");
  if (!Array.isArray(manifest.permissions)) warnings.push("Manifest permissions must be an array.");
  if (Array.isArray(manifest.permissions)) {
    for (const permission of manifest.permissions) {
      if (!isPluginPermission(permission)) {
        warnings.push(`Permission ${String(permission)} is not supported by BTV plugin API ${PLUGIN_API_VERSION}.`);
      }
    }
  }
  if (Array.isArray(manifest.capabilities)) {
    for (const [index, capability] of manifest.capabilities.entries()) {
      if (!capability || typeof capability !== "object") {
        warnings.push(`Capability ${index + 1} must be an object.`);
        continue;
      }
      if (!capability.id || typeof capability.id !== "string") warnings.push(`Capability ${index + 1} id is required.`);
      if (!capability.name || typeof capability.name !== "string") warnings.push(`Capability ${capability.id ?? index + 1} name is required.`);
      if (!isCapabilityType(capability.type)) warnings.push(`Capability ${capability.id ?? index + 1} has an unsupported type.`);
    }
  }
  if (manifest.apiVersion && manifest.apiVersion !== PLUGIN_API_VERSION) {
    warnings.push(`Plugin API ${manifest.apiVersion} does not match BTV plugin API ${PLUGIN_API_VERSION}.`);
  }
  return warnings;
}

function normalizeManifest(manifest: Partial<PluginManifest>, fallbackId: string): PluginManifest {
  return {
    id: manifest.id ?? `local.${fallbackId}`,
    name: manifest.name ?? fallbackId,
    version: manifest.version ?? "0.0.0",
    apiVersion: manifest.apiVersion ?? "unknown",
    description: manifest.description,
    author: manifest.author,
    homepage: manifest.homepage,
    entry: manifest.entry,
    capabilities: Array.isArray(manifest.capabilities) ? manifest.capabilities : [],
    permissions: Array.isArray(manifest.permissions) ? manifest.permissions : [],
    settings: Array.isArray(manifest.settings) ? manifest.settings : [],
  };
}

function invalidPlugin(directoryName: string, pluginPath: string, warnings: string[]): PluginRegistryItem {
  return buildRegistryItem({
    id: `invalid.${directoryName}`,
    name: directoryName,
    version: "0.0.0",
    apiVersion: "unknown",
    capabilities: [],
    permissions: [],
  }, "local", "invalid", pluginPath, warnings);
}

interface FoundPlugin {
  manifest: PluginManifest;
  source: "built-in" | "local";
  baseStatus: PluginRegistryItem["status"];
  path?: string;
  warnings: string[];
}

function findPlugin(id: string): FoundPlugin | null {
  if (id === CORE_PLUGIN.id) {
    return { manifest: CORE_PLUGIN, source: "built-in", baseStatus: "enabled", warnings: [] };
  }
  const plugin = loadLocalPlugins().find((item) => item.manifest.id === id);
  if (!plugin) return null;
  return {
    manifest: plugin.manifest,
    source: "local",
    baseStatus: plugin.status === "disabled" ? "development" : plugin.status,
    path: plugin.path,
    warnings: plugin.warnings,
  };
}

function buildRegistryItem(
  manifest: PluginManifest,
  source: "built-in" | "local",
  baseStatus: PluginRegistryItem["status"],
  path: string | undefined,
  warnings: string[],
): PluginRegistryItem {
  const enabled = source === "built-in" || getSetting(pluginEnabledKey(manifest.id)) !== "0";
  const settings = readPluginSettings(manifest);
  const diagnostics = buildDiagnostics(manifest, source, baseStatus, enabled, warnings);
  return {
    manifest,
    status: baseStatus === "invalid" ? "invalid" : enabled ? baseStatus : "disabled",
    source,
    path,
    enabled,
    settingsValues: settings.values,
    configuredSecrets: settings.configuredSecrets,
    diagnostics,
    warnings,
  };
}

function buildDiagnostics(
  manifest: PluginManifest,
  source: "built-in" | "local",
  baseStatus: PluginRegistryItem["status"],
  enabled: boolean,
  warnings: string[],
): PluginRegistryDiagnostics {
  const highRiskPermissionCount = manifest.permissions.filter((permission) =>
    PERMISSION_DEFINITIONS.find((definition) => definition.permission === permission)?.risk === "high",
  ).length;
  const settings = manifest.settings ?? [];
  const statusReasons: string[] = [];

  if (warnings.length) statusReasons.push("Manifest needs attention before BTV can safely use this plugin.");
  if (source === "built-in") statusReasons.push("Built into BTV and always available.");
  else if (!enabled) statusReasons.push("Disabled by the user.");
  else if (baseStatus === "development") statusReasons.push("Loaded from the local development plugin folder.");
  if (!manifest.capabilities.length) statusReasons.push("No capabilities are registered, so this plugin will not extend BTV yet.");
  if (highRiskPermissionCount) statusReasons.push(`${highRiskPermissionCount} high-risk permission${highRiskPermissionCount === 1 ? "" : "s"} requested.`);
  if (settings.length) statusReasons.push(`${settings.length} setting${settings.length === 1 ? "" : "s"} declared by the manifest.`);

  return {
    extensionCount: manifest.capabilities.length,
    permissionCount: manifest.permissions.length,
    highRiskPermissionCount,
    settingsCount: settings.length,
    secretSettingsCount: settings.filter((setting) => setting.type === "secret").length,
    statusReasons: statusReasons.length ? statusReasons : ["Plugin manifest is valid and ready."],
  };
}

function pluginEnabledKey(pluginId: string): string {
  return `plugin.enabled.${pluginId}`;
}

function pluginSettingsKey(pluginId: string): string {
  return `plugin.settings.${pluginId}`;
}

function readPluginSettings(manifest: PluginManifest): {
  raw: Record<string, string | number | boolean>;
  values: Record<string, string | number | boolean>;
  configuredSecrets: string[];
} {
  const rawSetting = getSetting(pluginSettingsKey(manifest.id));
  const parsed = rawSetting ? safeParseSettings(rawSetting) : {};
  const values: Record<string, string | number | boolean> = {};
  const configuredSecrets: string[] = [];

  for (const setting of manifest.settings ?? []) {
    const value = parsed[setting.key] ?? setting.defaultValue;
    if (setting.type === "secret") {
      if (value != null && value !== "") configuredSecrets.push(setting.key);
      continue;
    }
    if (value != null) values[setting.key] = value;
  }

  return { raw: parsed, values, configuredSecrets };
}

function safeParseSettings(raw: string): Record<string, string | number | boolean> {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, string | number | boolean] =>
        ["string", "number", "boolean"].includes(typeof entry[1]),
      ),
    );
  } catch {
    return {};
  }
}

function validatePluginPack(pack: PluginPack | undefined): string[] {
  const warnings: string[] = [];
  if (!pack || typeof pack !== "object") return ["Plugin pack is required."];
  if (pack.format !== "btv.plugin-pack") warnings.push("Unsupported plugin pack format.");
  if (pack.version !== 1) warnings.push("Unsupported plugin pack version.");
  if (!pack.manifest || typeof pack.manifest !== "object") warnings.push("Plugin pack manifest is required.");
  if (pack.manifest?.id === CORE_PLUGIN.id) warnings.push("BTV Core cannot be imported as a local plugin.");
  if (pack.manifest) warnings.push(...validateManifest(pack.manifest));
  return warnings;
}

function safeDirectoryName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "plugin";
}

function safeFileName(value: string): string {
  return safeDirectoryName(value).replace(/\.+/g, ".");
}

function safePluginId(value: string): string {
  const cleaned = value
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, ".")
    .replace(/\.{2,}/g, ".")
    .replace(/^[._-]+|[._-]+$/g, "");
  return cleaned.includes(".") ? cleaned : `local.${cleaned || "plugin"}`;
}

function capabilityLabel(type: PluginCapabilityType): string {
  switch (type) {
    case "action":
      return "Action";
    case "trigger":
      return "Trigger";
    case "widget":
      return "Widget";
    case "overlay":
      return "Overlay";
    case "command":
      return "Command";
    case "exporter":
      return "Exporter";
  }
}

function pluginReadme(manifest: PluginManifest): string {
  return [
    `# ${manifest.name}`,
    "",
    manifest.description ?? "Local BTV development plugin.",
    "",
    "## Manifest",
    "",
    `- Plugin id: \`${manifest.id}\``,
    `- Plugin API: \`${manifest.apiVersion}\``,
    `- Version: \`${manifest.version}\``,
    "",
    "## Capabilities",
    "",
    ...manifest.capabilities.map((capability) => `- \`${capability.type}\` - ${capability.name}`),
    "",
    "This folder is watched through the BTV plugin registry. Edit `btv.plugin.json`, then refresh the Plugins page.",
  ].join("\n");
}

function buildExtensionCatalog(plugins: PluginRegistryItem[]): PluginExtensionCatalog {
  const catalog: PluginExtensionCatalog = {
    action: [],
    trigger: [],
    widget: [],
    overlay: [],
    command: [],
    exporter: [],
  };
  for (const plugin of plugins) {
    if (!plugin.enabled || plugin.status === "invalid") continue;
    for (const capability of plugin.manifest.capabilities) {
      if (!isCapabilityType(capability.type)) continue;
      catalog[capability.type].push({
        pluginId: plugin.manifest.id,
        pluginName: plugin.manifest.name,
        pluginStatus: plugin.status,
        enabled: plugin.enabled,
        capability,
      });
    }
  }
  for (const type of CAPABILITY_TYPES) {
    catalog[type].sort((a, b) => a.capability.name.localeCompare(b.capability.name));
  }
  return catalog;
}

const CAPABILITY_TYPES: PluginCapabilityType[] = ["action", "trigger", "widget", "overlay", "command", "exporter"];

function isCapabilityType(value: unknown): value is PluginCapabilityType {
  return typeof value === "string" && CAPABILITY_TYPES.includes(value as PluginCapabilityType);
}

function isPluginPermission(value: unknown): value is PluginPermission {
  return typeof value === "string" && PERMISSION_DEFINITIONS.some((definition) => definition.permission === value);
}
