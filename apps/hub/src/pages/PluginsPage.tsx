import { useEffect, useMemo, useState } from "react";
import type {
  PluginCapabilityType,
  PluginPack,
  PluginPermission,
  PluginPermissionDefinition,
  PluginPermissionRisk,
  PluginRegistryItem,
  PluginRegistryResponse,
  PluginSetting,
} from "@btv/shared";
import { api } from "../api";
import { useToast } from "../hooks/useToast";
import { Button, Callout, Card, CardHeader, EmptyState, PageHeader, StatusPill } from "../ui";

const FOUNDATION_ITEMS = [
  { label: "Plugin manifest system", status: "Started", detail: "BTV now has a typed manifest contract and registry endpoint." },
  { label: "Internal plugin registry", status: "Started", detail: "Built-in and local development plugins can be listed from one API." },
  { label: "Plugin settings pages", status: "Next", detail: "Manifest settings will become generated setup forms here." },
  { label: "Action/trigger/widget registration", status: "Started", detail: "Enabled plugin capabilities are now catalogued by extension type." },
  { label: "Versioned plugin API", status: "Started", detail: "Registry reports the active Plugin API version." },
  { label: "Permissions model", status: "Started", detail: "Manifests declare requested BTV permissions before install." },
] as const;

function statusTone(status: string): "success" | "warning" | "danger" | "info" | "neutral" {
  if (status === "enabled") return "success";
  if (status === "development") return "info";
  if (status === "invalid") return "danger";
  if (status === "disabled") return "neutral";
  if (status === "Started") return "info";
  if (status === "Next") return "warning";
  return "neutral";
}

function riskTone(risk: PluginPermissionRisk): "success" | "warning" | "danger" {
  if (risk === "low") return "success";
  if (risk === "medium") return "warning";
  return "danger";
}

const EXTENSION_LABELS: Record<PluginCapabilityType, string> = {
  action: "Actions",
  trigger: "Triggers",
  widget: "Widgets",
  overlay: "Overlays",
  command: "Commands",
  exporter: "Exporters",
};

interface ManifestDraft {
  name: string;
  description: string;
  author: string;
  capabilities: PluginCapabilityType[];
  permissions: PluginPermission[];
}

function safePluginFileName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "btv-plugin";
}

function downloadJson(name: string, data: unknown): void {
  const blob = new Blob([`${JSON.stringify(data, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${safePluginFileName(name)}.btv-plugin.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default function PluginsPage() {
  const [registry, setRegistry] = useState<PluginRegistryResponse | null>(null);
  const [error, setError] = useState("");
  const [settingsDrafts, setSettingsDrafts] = useState<Record<string, Record<string, string | number | boolean>>>({});
  const [manifestDrafts, setManifestDrafts] = useState<Record<string, ManifestDraft>>({});
  const [devPluginName, setDevPluginName] = useState("");
  const [devPluginId, setDevPluginId] = useState("");
  const [devPluginDescription, setDevPluginDescription] = useState("");
  const [devPluginCapabilities, setDevPluginCapabilities] = useState<PluginCapabilityType[]>(["action"]);
  const toast = useToast();

  const load = async () => {
    try {
      setError("");
      const next = await api.plugins();
      setRegistry(next);
      setSettingsDrafts(Object.fromEntries(next.plugins.map((plugin) => [plugin.manifest.id, plugin.settingsValues])));
      setManifestDrafts(Object.fromEntries(next.plugins.map((plugin) => [plugin.manifest.id, makeManifestDraft(plugin)])));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load plugins");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const updateRegistryPlugin = (nextPlugin: PluginRegistryItem) => {
    setRegistry((current) =>
      current
        ? {
            ...current,
            plugins: current.plugins.map((plugin) => (plugin.manifest.id === nextPlugin.manifest.id ? nextPlugin : plugin)),
          }
        : current,
    );
    setSettingsDrafts((current) => ({ ...current, [nextPlugin.manifest.id]: nextPlugin.settingsValues }));
    setManifestDrafts((current) => ({ ...current, [nextPlugin.manifest.id]: makeManifestDraft(nextPlugin) }));
  };

  const togglePlugin = async (plugin: PluginRegistryItem) => {
    try {
      const response = await api.setPluginEnabled(plugin.manifest.id, !plugin.enabled);
      updateRegistryPlugin(response.plugin);
      toast(`${plugin.manifest.name} ${response.plugin.enabled ? "enabled" : "disabled"}`);
      void load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not update plugin");
    }
  };

  const saveSettings = async (plugin: PluginRegistryItem) => {
    try {
      const response = await api.savePluginSettings(plugin.manifest.id, settingsDrafts[plugin.manifest.id] ?? {});
      updateRegistryPlugin(response.plugin);
      toast(`${plugin.manifest.name} settings saved`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save plugin settings");
    }
  };

  const saveManifest = async (plugin: PluginRegistryItem) => {
    try {
      const draft = manifestDrafts[plugin.manifest.id];
      if (!draft) return;
      const response = await api.updatePluginManifest(plugin.manifest.id, draft);
      updateRegistryPlugin(response.plugin);
      toast(`${response.plugin.manifest.name} manifest saved`);
      void load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save plugin manifest");
    }
  };

  const updateSettingDraft = (pluginId: string, key: string, value: string | number | boolean) => {
    setSettingsDrafts((current) => ({
      ...current,
      [pluginId]: {
        ...(current[pluginId] ?? {}),
        [key]: value,
      },
    }));
  };

  const updateManifestDraft = (pluginId: string, patch: Partial<ManifestDraft>) => {
    setManifestDrafts((current) => ({
      ...current,
      [pluginId]: {
        ...(current[pluginId] ?? {
          name: "",
          description: "",
          author: "",
          capabilities: [],
          permissions: [],
        }),
        ...patch,
      },
    }));
  };

  const exportPlugin = async (plugin: PluginRegistryItem) => {
    try {
      const pack = await api.exportPluginPack(plugin.manifest.id);
      downloadJson(plugin.manifest.name, pack);
      toast(`${plugin.manifest.name} exported`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not export plugin");
    }
  };

  const importPlugin = async (file: File) => {
    try {
      const pack = JSON.parse(await file.text()) as PluginPack;
      const response = await api.importPluginPack(pack);
      toast(`${response.plugin.manifest.name} imported`);
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not import plugin pack");
    }
  };

  const toggleDevCapability = (type: PluginCapabilityType) => {
    setDevPluginCapabilities((current) =>
      current.includes(type) ? current.filter((item) => item !== type) : [...current, type],
    );
  };

  const createDevPlugin = async () => {
    try {
      const response = await api.createDevPlugin({
        id: devPluginId.trim() || undefined,
        name: devPluginName.trim(),
        description: devPluginDescription.trim() || undefined,
        capabilities: devPluginCapabilities.length ? devPluginCapabilities : ["action"],
      });
      toast(`${response.plugin.manifest.name} created`);
      setDevPluginName("");
      setDevPluginId("");
      setDevPluginDescription("");
      setDevPluginCapabilities(["action"]);
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not create dev plugin");
    }
  };

  const capabilityCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const [type, registrations] of Object.entries(registry?.extensionCatalog ?? {}) as Array<[PluginCapabilityType, unknown[]]>) {
      counts.set(type, registrations.length);
    }
    return Array.from(counts.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [registry]);

  const permissionDefinitions = useMemo(() => {
    return new Map((registry?.permissionDefinitions ?? []).map((definition) => [definition.permission, definition]));
  }, [registry]);

  const permissionCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const plugin of registry?.plugins ?? []) {
      for (const permission of plugin.manifest.permissions) {
        counts.set(permission, (counts.get(permission) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [registry]);

  const permissionReview = useMemo(() => {
    const groups: Record<PluginPermissionRisk, Array<PluginPermissionDefinition & { count: number }>> = {
      low: [],
      medium: [],
      high: [],
    };
    for (const [permission, count] of permissionCounts) {
      const definition = permissionDefinitions.get(permission as PluginPermissionDefinition["permission"]);
      if (definition) groups[definition.risk].push({ ...definition, count });
    }
    return groups;
  }, [permissionCounts, permissionDefinitions]);

  return (
    <>
      <PageHeader
        title="Plugins"
        description="Phase 6 starts here: manifests, registry, permissions, settings, and future marketplace-ready plugin packs."
        action={
          <div className="plugins-page-actions">
            <label className="ui-button ui-button--secondary ui-button--sm">
              Import pack
              <input
                type="file"
                accept=".json,.btv-plugin.json,application/json"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) void importPlugin(file);
                }}
              />
            </label>
            <Button type="button" variant="secondary" size="sm" onClick={() => void load()}>
              Refresh registry
            </Button>
          </div>
        }
      />

      {error ? (
        <Callout tone="danger" title="Plugin registry could not load">
          {error}
        </Callout>
      ) : null}

      <div className="plugins-summary">
        <StatusPill tone="info" label="Plugin API" detail={registry?.apiVersion ?? "Checking"} />
        <StatusPill tone="success" label="Registered" detail={String(registry?.plugins.length ?? 0)} />
        <StatusPill tone="warning" label="Local folder" detail={registry?.pluginDirectory ?? "Creating on server"} />
      </div>

      <div className="plugins-grid">
        <Card hideableId="plugin-registry" hideableTitle="Plugin Registry">
          <CardHeader
            title="Plugin Registry"
            description="Installed, built-in, and development plugins BTV can currently see."
            action={<StatusPill tone="info" label={`${registry?.plugins.length ?? 0} plugins`} />}
          />
          {registry?.plugins.length ? (
            <div className="plugin-registry-list">
              {registry.plugins.map((plugin) => (
                <article className="plugin-registry-card" key={plugin.manifest.id}>
                  <div className="plugin-registry-card__header">
                    <div>
                      <strong>{plugin.manifest.name}</strong>
                      <span>{plugin.manifest.id}</span>
                    </div>
                    <StatusPill tone={statusTone(plugin.status)} label={plugin.status} detail={plugin.source} />
                  </div>
                  <p>{plugin.manifest.description ?? "No description provided."}</p>
                  <div className="plugin-chip-row">
                    <span>v{plugin.manifest.version}</span>
                    <span>API {plugin.manifest.apiVersion}</span>
                    <span>{plugin.manifest.capabilities.length} capabilities</span>
                    <span>{plugin.manifest.permissions.length} permissions</span>
                  </div>
                  <PluginDiagnostics plugin={plugin} />
                  {plugin.manifest.permissions.length ? (
                    <PluginPermissionSummary plugin={plugin} definitions={permissionDefinitions} />
                  ) : null}
                  {plugin.path ? <code>{plugin.path}</code> : null}
                  <div className="plugin-registry-card__actions">
                    <Button
                      type="button"
                      variant={plugin.enabled ? "secondary" : "primary"}
                      size="sm"
                      onClick={() => void togglePlugin(plugin)}
                      disabled={plugin.source === "built-in" || plugin.status === "invalid"}
                    >
                      {plugin.enabled ? "Disable" : "Enable"}
                    </Button>
                    <Button type="button" variant="secondary" size="sm" onClick={() => void exportPlugin(plugin)}>
                      Export pack
                    </Button>
                  </div>
                  {plugin.warnings.length ? (
                    <Callout tone="warning" title="Manifest warnings">
                      {plugin.warnings.join(" ")}
                    </Callout>
                  ) : null}
                  {plugin.source === "local" ? (
                    <PluginManifestEditor
                      plugin={plugin}
                      draft={manifestDrafts[plugin.manifest.id] ?? makeManifestDraft(plugin)}
                      permissionDefinitions={registry.permissionDefinitions}
                      onChange={(patch) => updateManifestDraft(plugin.manifest.id, patch)}
                      onSave={() => void saveManifest(plugin)}
                    />
                  ) : null}
                  {plugin.manifest.settings?.length ? (
                    <PluginSettingsForm
                      plugin={plugin}
                      values={settingsDrafts[plugin.manifest.id] ?? {}}
                      onChange={(key, value) => updateSettingDraft(plugin.manifest.id, key, value)}
                      onSave={() => void saveSettings(plugin)}
                    />
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <EmptyState title="No plugins found" description="BTV will show built-in and local development plugins here." />
          )}
        </Card>

        <Card hideableId="plugin-foundation" hideableTitle="Phase 6 Foundation">
          <CardHeader
            title="Phase 6 Foundation"
            description="The first plugin milestones and what each unlocks."
          />
          <div className="plugin-foundation-list">
            {FOUNDATION_ITEMS.map((item) => (
              <div className="plugin-foundation-item" key={item.label}>
                <StatusPill tone={statusTone(item.status)} label={item.status} />
                <div>
                  <strong>{item.label}</strong>
                  <p>{item.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card hideableId="create-dev-plugin" hideableTitle="Create Dev Plugin">
          <CardHeader
            title="Create Dev Plugin"
            description="Scaffold a local plugin folder with a valid manifest and README."
            action={<StatusPill tone="info" label="Local" detail="data/plugins" />}
          />
          <div className="plugin-dev-form">
            <label>
              <span>Name</span>
              <input value={devPluginName} onChange={(event) => setDevPluginName(event.target.value)} placeholder="Chaos Pack" />
            </label>
            <label>
              <span>Plugin id</span>
              <input value={devPluginId} onChange={(event) => setDevPluginId(event.target.value)} placeholder="local.chaos-pack" />
            </label>
            <label className="plugin-dev-form__wide">
              <span>Description</span>
              <textarea
                rows={3}
                value={devPluginDescription}
                onChange={(event) => setDevPluginDescription(event.target.value)}
                placeholder="What this plugin will add to BTV."
              />
            </label>
            <div className="plugin-dev-form__wide">
              <span>Extension points</span>
              <div className="plugin-dev-capability-grid">
                {(Object.keys(EXTENSION_LABELS) as PluginCapabilityType[]).map((type) => (
                  <label key={type}>
                    <input
                      type="checkbox"
                      checked={devPluginCapabilities.includes(type)}
                      onChange={() => toggleDevCapability(type)}
                    />{" "}
                    {EXTENSION_LABELS[type]}
                  </label>
                ))}
              </div>
            </div>
            <div className="plugin-dev-form__actions">
              <Button type="button" variant="primary" size="sm" onClick={() => void createDevPlugin()} disabled={!devPluginName.trim()}>
                Create plugin
              </Button>
            </div>
          </div>
        </Card>

        <Card hideableId="plugin-extension-registry" hideableTitle="Extension Registry">
          <CardHeader title="Extension Registry" description="Enabled plugin capabilities grouped into BTV extension points." />
          {registry ? (
            <div className="plugin-extension-catalog">
              {(Object.keys(EXTENSION_LABELS) as PluginCapabilityType[]).map((type) => {
                const registrations = registry.extensionCatalog[type] ?? [];
                return (
                  <section className="plugin-extension-group" key={type}>
                    <div className="plugin-extension-group__header">
                      <strong>{EXTENSION_LABELS[type]}</strong>
                      <StatusPill tone={registrations.length ? "success" : "neutral"} label={String(registrations.length)} />
                    </div>
                    {registrations.length ? (
                      <div className="plugin-extension-list">
                        {registrations.map((registration) => (
                          <div className="plugin-extension-item" key={`${registration.pluginId}-${registration.capability.id}`}>
                            <strong>{registration.capability.name}</strong>
                            <span>{registration.capability.description ?? registration.capability.id}</span>
                            <small>{registration.pluginName}</small>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p>No enabled {type} extensions yet.</p>
                    )}
                  </section>
                );
              })}
            </div>
          ) : (
            <EmptyState title="Loading extension registry" description="BTV is gathering plugin capabilities." />
          )}
        </Card>

        <Card hideableId="plugin-capabilities" hideableTitle="Capability Map">
          <CardHeader title="Capability Map" description="Enabled extension counts by plugin capability type." />
          {capabilityCounts.length ? (
            <div className="plugin-chip-grid">
              {capabilityCounts.map(([type, count]) => (
                <div key={type}>
                  <strong>{EXTENSION_LABELS[type as PluginCapabilityType] ?? type}</strong>
                  <span>{count}</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No capabilities yet" description="Plugin manifests will declare actions, triggers, widgets, overlays, commands, and exporters." />
          )}
        </Card>

        <Card hideableId="plugin-permissions" hideableTitle="Permission Model">
          <CardHeader title="Permission Model" description="Permissions requested by visible plugin manifests, grouped by risk." />
          {permissionCounts.length ? (
            <PermissionReview groups={permissionReview} />
          ) : (
            <EmptyState title="No permissions requested" description="Local plugins will need to declare their access before BTV enables them." />
          )}
        </Card>
      </div>
    </>
  );
}

function makeManifestDraft(plugin: PluginRegistryItem): ManifestDraft {
  return {
    name: plugin.manifest.name,
    description: plugin.manifest.description ?? "",
    author: plugin.manifest.author ?? "",
    capabilities: plugin.manifest.capabilities.map((capability) => capability.type),
    permissions: plugin.manifest.permissions,
  };
}

function PluginDiagnostics({ plugin }: { plugin: PluginRegistryItem }) {
  const diagnostics = plugin.diagnostics;
  return (
    <details className="plugin-diagnostics">
      <summary>Plugin health</summary>
      <div className="plugin-diagnostics__chips">
        <StatusPill tone={diagnostics.extensionCount ? "success" : "neutral"} label="Extensions" detail={String(diagnostics.extensionCount)} />
        <StatusPill tone={diagnostics.permissionCount ? "warning" : "neutral"} label="Permissions" detail={String(diagnostics.permissionCount)} />
        <StatusPill tone={diagnostics.highRiskPermissionCount ? "danger" : "success"} label="High risk" detail={String(diagnostics.highRiskPermissionCount)} />
        <StatusPill tone={diagnostics.settingsCount ? "info" : "neutral"} label="Settings" detail={String(diagnostics.settingsCount)} />
        <StatusPill tone={diagnostics.secretSettingsCount ? "warning" : "neutral"} label="Secrets" detail={String(diagnostics.secretSettingsCount)} />
      </div>
      <ul>
        {diagnostics.statusReasons.map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </ul>
    </details>
  );
}

function PluginPermissionSummary({
  plugin,
  definitions,
}: {
  plugin: PluginRegistryItem;
  definitions: Map<string, PluginPermissionDefinition>;
}) {
  return (
    <details className="plugin-permission-summary">
      <summary>Review requested permissions</summary>
      <div className="plugin-permission-summary__grid">
        {plugin.manifest.permissions.map((permission) => {
          const definition = definitions.get(permission);
          return definition ? (
            <div className={`plugin-permission-card plugin-permission-card--${definition.risk}`} key={permission}>
              <div>
                <strong>{definition.label}</strong>
                <StatusPill tone={riskTone(definition.risk)} label={definition.risk} />
              </div>
              <code>{definition.permission}</code>
              <p>{definition.description}</p>
            </div>
          ) : (
            <div className="plugin-permission-card plugin-permission-card--unknown" key={permission}>
              <div>
                <strong>Unknown permission</strong>
                <StatusPill tone="danger" label="blocked" />
              </div>
              <code>{permission}</code>
              <p>This permission is not part of the current BTV plugin API.</p>
            </div>
          );
        })}
      </div>
    </details>
  );
}

function PermissionReview({
  groups,
}: {
  groups: Record<PluginPermissionRisk, Array<PluginPermissionDefinition & { count: number }>>;
}) {
  const orderedRisks: PluginPermissionRisk[] = ["high", "medium", "low"];
  return (
    <div className="plugin-permission-review">
      {orderedRisks.map((risk) => (
        <section className={`plugin-permission-risk plugin-permission-risk--${risk}`} key={risk}>
          <div className="plugin-permission-risk__header">
            <strong>{risk} risk</strong>
            <StatusPill tone={riskTone(risk)} label={String(groups[risk].length)} />
          </div>
          {groups[risk].length ? (
            <div className="plugin-permission-list">
              {groups[risk].map((definition) => (
                <span key={definition.permission} title={definition.description}>
                  <code>{definition.permission}</code>
                  <small>{definition.count}</small>
                </span>
              ))}
            </div>
          ) : (
            <p>No {risk} risk permissions requested.</p>
          )}
        </section>
      ))}
    </div>
  );
}

function PluginManifestEditor({
  plugin,
  draft,
  permissionDefinitions,
  onChange,
  onSave,
}: {
  plugin: PluginRegistryItem;
  draft: ManifestDraft;
  permissionDefinitions: PluginPermissionDefinition[];
  onChange: (patch: Partial<ManifestDraft>) => void;
  onSave: () => void;
}) {
  const toggleCapability = (type: PluginCapabilityType) => {
    onChange({
      capabilities: draft.capabilities.includes(type)
        ? draft.capabilities.filter((item) => item !== type)
        : [...draft.capabilities, type],
    });
  };
  const togglePermission = (permission: PluginPermission) => {
    onChange({
      permissions: draft.permissions.includes(permission)
        ? draft.permissions.filter((item) => item !== permission)
        : [...draft.permissions, permission],
    });
  };

  return (
    <details className="plugin-manifest-editor">
      <summary>Edit local manifest</summary>
      <div className="plugin-manifest-editor__grid">
        <label>
          <span>Name</span>
          <input value={draft.name} onChange={(event) => onChange({ name: event.target.value })} />
        </label>
        <label>
          <span>Author</span>
          <input value={draft.author} onChange={(event) => onChange({ author: event.target.value })} />
        </label>
        <label className="plugin-manifest-editor__wide">
          <span>Description</span>
          <textarea rows={3} value={draft.description} onChange={(event) => onChange({ description: event.target.value })} />
        </label>
        <div className="plugin-manifest-editor__wide">
          <span>Capabilities</span>
          <div className="plugin-dev-capability-grid">
            {(Object.keys(EXTENSION_LABELS) as PluginCapabilityType[]).map((type) => (
              <label key={type}>
                <input type="checkbox" checked={draft.capabilities.includes(type)} onChange={() => toggleCapability(type)} />{" "}
                {EXTENSION_LABELS[type]}
              </label>
            ))}
          </div>
        </div>
        <div className="plugin-manifest-editor__wide">
          <span>Permissions</span>
          <div className="plugin-manifest-permission-grid">
            {permissionDefinitions.map((definition) => (
              <label className={`plugin-manifest-permission plugin-manifest-permission--${definition.risk}`} key={definition.permission}>
                <input
                  type="checkbox"
                  checked={draft.permissions.includes(definition.permission)}
                  onChange={() => togglePermission(definition.permission)}
                />
                <span>
                  <strong>{definition.label}</strong>
                  <small>{definition.permission}</small>
                  <em>{definition.description}</em>
                </span>
                <StatusPill tone={riskTone(definition.risk)} label={definition.risk} />
              </label>
            ))}
          </div>
        </div>
      </div>
      <div className="plugin-registry-card__actions">
        <StatusPill tone="neutral" label={plugin.manifest.id} detail="immutable id" />
        <Button type="button" variant="primary" size="sm" onClick={onSave} disabled={!draft.name.trim()}>
          Save manifest
        </Button>
      </div>
    </details>
  );
}

function PluginSettingsForm({
  plugin,
  values,
  onChange,
  onSave,
}: {
  plugin: PluginRegistryItem;
  values: Record<string, string | number | boolean>;
  onChange: (key: string, value: string | number | boolean) => void;
  onSave: () => void;
}) {
  return (
    <details className="plugin-settings-form">
      <summary>Plugin settings</summary>
      <div className="plugin-settings-grid">
        {plugin.manifest.settings?.map((setting) => (
          <PluginSettingField
            key={setting.key}
            setting={setting}
            value={values[setting.key]}
            configuredSecret={plugin.configuredSecrets.includes(setting.key)}
            onChange={(value) => onChange(setting.key, value)}
          />
        ))}
      </div>
      <div className="plugin-registry-card__actions">
        <Button type="button" variant="primary" size="sm" onClick={onSave}>
          Save settings
        </Button>
      </div>
    </details>
  );
}

function PluginSettingField({
  setting,
  value,
  configuredSecret,
  onChange,
}: {
  setting: PluginSetting;
  value: string | number | boolean | undefined;
  configuredSecret: boolean;
  onChange: (value: string | number | boolean) => void;
}) {
  const inputId = `plugin-setting-${setting.key}`;
  return (
    <label className="plugin-setting-field" htmlFor={inputId}>
      <span>
        {setting.label}
        {setting.required ? <small>Required</small> : null}
      </span>
      {setting.type === "boolean" ? (
        <input
          id={inputId}
          type="checkbox"
          checked={Boolean(value)}
          onChange={(event) => onChange(event.target.checked)}
        />
      ) : setting.type === "select" ? (
        <select id={inputId} value={String(value ?? setting.defaultValue ?? "")} onChange={(event) => onChange(event.target.value)}>
          <option value="">Select...</option>
          {setting.options?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={inputId}
          type={setting.type === "number" ? "number" : setting.type === "secret" ? "password" : "text"}
          value={String(value ?? "")}
          placeholder={setting.type === "secret" && configuredSecret ? "Configured. Leave blank to keep existing." : undefined}
          onChange={(event) => onChange(setting.type === "number" ? Number(event.target.value) : event.target.value)}
        />
      )}
      {setting.description ? <p>{setting.description}</p> : null}
    </label>
  );
}
