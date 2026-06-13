import type { AlertProject, StreamEventType } from "@btv/shared";
import { AlertProjectSchema } from "@btv/shared";
import { api, type MediaAssetInfo, type SoundAssetInfo } from "../../api";
import { downloadJsonFile, safeDownloadName } from "../../lib/browserDownloads";

const DEFAULT_CHAOS: AlertProject["chaos"] = {
  enabled: false,
  intensity: 0.35,
  modifiers: ["shake", "flash", "hue_shift", "scale_punch"],
  legendaryBoost: 0,
};

export type AlertEditorResources = {
  projects: AlertProject[];
  media: MediaAssetInfo[];
  sounds: SoundAssetInfo[];
};

export function alertProjectSignature(project: AlertProject | null): string {
  return project ? JSON.stringify(project) : "";
}

export function normalizeAlertProject(project: AlertProject): AlertProject {
  return {
    ...project,
    timeline: project.timeline ?? { durationMs: project.durationMs, fps: 60, snapMs: 100, zoom: 1 },
    chaos: project.chaos ?? DEFAULT_CHAOS,
    safeMode: project.safeMode ?? false,
    canvas: project.canvas ?? { width: 1920, height: 1080, background: "transparent", backgroundColor: "transparent" },
    layers: project.layers ?? [],
    variations: project.variations ?? [],
    tags: project.tags ?? [],
  };
}

export async function loadAlertEditorResources(): Promise<AlertEditorResources> {
  const [projects, media, sounds] = await Promise.all([api.alertProjects(), api.listMedia(), api.listSounds()]);
  return { projects, media: media.media, sounds: sounds.sounds };
}

export async function persistAlertProject(project: AlertProject): Promise<AlertProject> {
  const timeline = project.timeline ?? { durationMs: project.durationMs, fps: 60, snapMs: 100, zoom: 1 };
  const next = normalizeAlertProject({
    ...project,
    timeline: { durationMs: project.durationMs, fps: timeline.fps, snapMs: timeline.snapMs, zoom: timeline.zoom },
    updatedAt: new Date().toISOString(),
  });
  await api.saveAlertProject(next);
  return next;
}

export async function persistAndTestAlertProject(
  project: AlertProject,
  eventType: StreamEventType,
  payloadJson: string,
  variationId?: string,
): Promise<AlertProject> {
  const payload = JSON.parse(payloadJson) as Record<string, unknown>;
  const next = await persistAlertProject({ ...project, eventType });
  await api.testAlertProject(next.id, eventType, payload, variationId);
  return next;
}

export function downloadAlertProject(project: AlertProject): void {
  const safeName = safeDownloadName(project.name, "alert-project", "_");
  downloadJsonFile(`${safeName}.btv-alert.json`, project, false);
}

export async function importAlertProject(file: File, projectId: string): Promise<AlertProject> {
  const raw = JSON.parse(await file.text()) as Partial<AlertProject>;
  const now = new Date().toISOString();
  const parsed = AlertProjectSchema.safeParse({
    ...raw,
    id: projectId,
    name: raw.name ? `${raw.name} import` : "Imported alert",
    createdAt: now,
    updatedAt: now,
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid alert project JSON");
  const project = normalizeAlertProject(parsed.data);
  await api.saveAlertProject(project);
  return project;
}
