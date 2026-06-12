export type PluginPermission =
  | "alerts:read"
  | "alerts:write"
  | "automations:read"
  | "automations:write"
  | "commands:read"
  | "commands:write"
  | "obs:read"
  | "obs:write"
  | "overlays:read"
  | "overlays:write"
  | "settings:read"
  | "settings:write"
  | "twitch:read"
  | "twitch:write"
  | "webhooks:read"
  | "webhooks:write";

export type PluginPermissionRisk = "low" | "medium" | "high";

export interface PluginPermissionDefinition {
  permission: PluginPermission;
  label: string;
  description: string;
  risk: PluginPermissionRisk;
}

export type PluginCapabilityType = "action" | "trigger" | "widget" | "overlay" | "command" | "exporter";

export interface PluginCapability {
  id: string;
  type: PluginCapabilityType;
  name: string;
  description?: string;
}

export type PluginSettingType = "string" | "number" | "boolean" | "select" | "secret";

export interface PluginSetting {
  key: string;
  label: string;
  type: PluginSettingType;
  required?: boolean;
  description?: string;
  defaultValue?: string | number | boolean;
  options?: Array<{ label: string; value: string }>;
}

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  apiVersion: string;
  description?: string;
  author?: string;
  homepage?: string;
  entry?: {
    backend?: string;
    frontend?: string;
    overlay?: string;
  };
  capabilities: PluginCapability[];
  permissions: PluginPermission[];
  settings?: PluginSetting[];
}

export type PluginRegistryStatus = "enabled" | "disabled" | "invalid" | "development";

export interface PluginRegistryItem {
  manifest: PluginManifest;
  status: PluginRegistryStatus;
  source: "built-in" | "local";
  path?: string;
  enabled: boolean;
  settingsValues: Record<string, string | number | boolean>;
  configuredSecrets: string[];
  diagnostics: PluginRegistryDiagnostics;
  warnings: string[];
}

export interface PluginRegistryDiagnostics {
  extensionCount: number;
  permissionCount: number;
  highRiskPermissionCount: number;
  settingsCount: number;
  secretSettingsCount: number;
  statusReasons: string[];
}

export interface PluginExtensionRegistration {
  pluginId: string;
  pluginName: string;
  pluginStatus: PluginRegistryStatus;
  enabled: boolean;
  capability: PluginCapability;
}

export type PluginExtensionCatalog = Record<PluginCapabilityType, PluginExtensionRegistration[]>;

export interface PluginRegistryResponse {
  plugins: PluginRegistryItem[];
  pluginDirectory: string;
  apiVersion: string;
  permissionDefinitions: PluginPermissionDefinition[];
  extensionCatalog: PluginExtensionCatalog;
}

export interface PluginPack {
  format: "btv.plugin-pack";
  version: 1;
  exportedAt: string;
  manifest: PluginManifest;
  enabled: boolean;
  settingsValues: Record<string, string | number | boolean>;
}
