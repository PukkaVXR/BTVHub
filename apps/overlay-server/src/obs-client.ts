import OBSWebSocket from "obs-websocket-js";
import { getEncryptedSetting, getSetting, logObsSceneSpan, setEncryptedSetting, setSetting } from "./db.js";

type RawObsCall = (requestType: string, requestData?: Record<string, unknown>) => Promise<unknown>;

export interface ObsSceneInfo {
  sceneName: string;
  sceneIndex?: number;
}

export interface ObsSourceInfo {
  sourceName: string;
  sceneItemId: number;
  sceneItemEnabled: boolean;
}

export interface ObsTransformPoint {
  x: number;
  y: number;
  scale?: number;
}

export interface ObsSourceMotionConfig {
  sceneName: string;
  sourceName: string;
  mode?: "set" | "dvd" | "path";
  durationMs?: number;
  fps?: number;
  visible?: boolean;
  restore?: boolean;
  boundsWidth?: number;
  boundsHeight?: number;
  speedX?: number;
  speedY?: number;
  randomizeStart?: boolean;
  x?: number;
  y?: number;
  scale?: number;
  width?: number;
  height?: number;
  path?: ObsTransformPoint[];
}

interface ObsSceneItemTransform {
  positionX?: number;
  positionY?: number;
  scaleX?: number;
  scaleY?: number;
  width?: number;
  height?: number;
  sourceWidth?: number;
  sourceHeight?: number;
  [key: string]: unknown;
}

interface ActiveMotion {
  cancelled: boolean;
  restoreTransform: ObsSceneItemTransform;
  restoreVisible: boolean;
}

let obs: OBSWebSocket | null = null;
let connectPromise: Promise<boolean> | null = null;
const activeMotions = new Map<string, ActiveMotion>();

export function getObsConfig() {
  const encryptedPassword = getEncryptedSetting("obs_password");
  const legacyPassword = encryptedPassword ? "" : (getSetting("obs_password") ?? "");
  return {
    host: getSetting("obs_host") ?? "127.0.0.1",
    port: Number(getSetting("obs_port") ?? "4455"),
    password: encryptedPassword ?? legacyPassword,
  };
}

export async function connectObs(): Promise<boolean> {
  if (connectPromise) return connectPromise;

  connectPromise = doConnectObs();
  try {
    return await connectPromise;
  } finally {
    connectPromise = null;
  }
}

async function doConnectObs(): Promise<boolean> {
  const cfg = getObsConfig();
  const client = new OBSWebSocket();
  setSetting("obs_connected", "0");

  if (obs) {
    try {
      await obs.disconnect();
    } catch {
      // Ignore stale sockets while replacing the client.
    }
    obs = null;
  }

  client.on("ConnectionClosed", () => {
    if (obs === client) obs = null;
    setSetting("obs_connected", "0");
  });

  client.on("ConnectionError", () => {
    if (obs === client) obs = null;
    setSetting("obs_connected", "0");
  });

  client.on("CurrentProgramSceneChanged", (data) => {
    if (data.sceneName) logObsSceneSpan(data.sceneName);
  });

  try {
    await client.connect(`ws://${cfg.host}:${cfg.port}`, cfg.password || undefined);
    obs = client;
    setSetting("obs_connected", "1");
    if (cfg.password && !getEncryptedSetting("obs_password")) {
      setEncryptedSetting("obs_password", cfg.password);
    }
    return true;
  } catch {
    setSetting("obs_connected", "0");
    return false;
  }
}

export async function triggerObsScene(sceneName: string): Promise<void> {
  await setObsScene(sceneName);
}

export async function setObsScene(sceneName: string): Promise<boolean> {
  const client = await getObsClient();
  if (!client) return false;
  try {
    await client.call("SetCurrentProgramScene", { sceneName });
    logObsSceneSpan(sceneName);
    return true;
  } catch (e) {
    markObsDisconnected(e);
    return false;
  }
}

async function getObsClient(): Promise<OBSWebSocket | null> {
  if (!obs) {
    const ok = await connectObs();
    if (!ok) return null;
  }
  return obs;
}

function markObsDisconnected(err?: unknown): void {
  if (err) console.error("OBS request failed:", err);
  setSetting("obs_connected", "0");
  obs = null;
}

async function safeObsCall(
  requestType: string,
  requestData?: Record<string, unknown>,
): Promise<unknown | null> {
  const client = await getObsClient();
  if (!client) return null;
  try {
    const call = client.call.bind(client) as RawObsCall;
    return requestData ? call(requestType, requestData) : call(requestType);
  } catch (err) {
    markObsDisconnected(err);
    return null;
  }
}

export async function getCurrentObsScene(): Promise<string | null> {
  const result = (await safeObsCall("GetCurrentProgramScene")) as
    | { currentProgramSceneName?: string }
    | null;
  return result?.currentProgramSceneName ?? null;
}

export async function listObsScenes(): Promise<ObsSceneInfo[] | null> {
  const result = (await safeObsCall("GetSceneList")) as
    | { scenes?: Array<{ sceneName?: string; sceneIndex?: number }> }
    | null;
  if (!result?.scenes) return null;
  return result.scenes
    .map((scene) => ({
      sceneName: String(scene.sceneName ?? ""),
      sceneIndex: scene.sceneIndex,
    }))
    .filter((scene) => scene.sceneName);
}

export async function listObsSceneSources(sceneName: string): Promise<ObsSourceInfo[] | null> {
  const result = (await safeObsCall("GetSceneItemList", { sceneName })) as
    | {
        sceneItems?: Array<{
          sourceName?: string;
          sceneItemId?: number;
          sceneItemEnabled?: boolean;
        }>;
      }
    | null;
  if (!result?.sceneItems) return null;
  return result.sceneItems
    .map((item) => ({
      sourceName: String(item.sourceName ?? ""),
      sceneItemId: Number(item.sceneItemId),
      sceneItemEnabled: Boolean(item.sceneItemEnabled),
    }))
    .filter((item) => item.sourceName && Number.isFinite(item.sceneItemId));
}

export async function setObsSourceVisible(
  sceneName: string,
  sourceName: string,
  visible: boolean,
): Promise<boolean> {
  const sources = await listObsSceneSources(sceneName);
  const item = sources?.find((source) => source.sourceName === sourceName);
  if (!item) return false;
  const result = await safeObsCall("SetSceneItemEnabled", {
    sceneName,
    sceneItemId: item.sceneItemId,
    sceneItemEnabled: visible,
  });
  return result !== null;
}

async function getObsSceneItem(
  sceneName: string,
  sourceName: string,
): Promise<ObsSourceInfo | null> {
  const sources = await listObsSceneSources(sceneName);
  return sources?.find((source) => source.sourceName === sourceName) ?? null;
}

async function getObsSourceTransformById(
  sceneName: string,
  sceneItemId: number,
): Promise<ObsSceneItemTransform | null> {
  const result = (await safeObsCall("GetSceneItemTransform", {
    sceneName,
    sceneItemId,
  })) as { sceneItemTransform?: ObsSceneItemTransform } | null;
  return result?.sceneItemTransform ?? null;
}

export async function getObsSourceTransform(
  sceneName: string,
  sourceName: string,
): Promise<ObsSceneItemTransform | null> {
  const item = await getObsSceneItem(sceneName, sourceName);
  if (!item) return null;
  return getObsSourceTransformById(sceneName, item.sceneItemId);
}

async function setObsSourceTransformById(
  sceneName: string,
  sceneItemId: number,
  sceneItemTransform: ObsSceneItemTransform,
): Promise<boolean> {
  const result = await safeObsCall("SetSceneItemTransform", {
    sceneName,
    sceneItemId,
    sceneItemTransform,
  });
  return result !== null;
}

export async function setObsSourceTransform(
  sceneName: string,
  sourceName: string,
  sceneItemTransform: ObsSceneItemTransform,
): Promise<boolean> {
  const item = await getObsSceneItem(sceneName, sourceName);
  if (!item) return false;
  return setObsSourceTransformById(sceneName, item.sceneItemId, sceneItemTransform);
}

async function setObsSourceVisibleById(
  sceneName: string,
  sceneItemId: number,
  visible: boolean,
): Promise<boolean> {
  const result = await safeObsCall("SetSceneItemEnabled", {
    sceneName,
    sceneItemId,
    sceneItemEnabled: visible,
  });
  return result !== null;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function currentSize(transform: ObsSceneItemTransform): { width: number; height: number } {
  const width = Number(transform.width ?? 0);
  const height = Number(transform.height ?? 0);
  if (width > 0 && height > 0) return { width, height };

  const sourceWidth = Number(transform.sourceWidth ?? 320);
  const sourceHeight = Number(transform.sourceHeight ?? 180);
  const scaleX = Number(transform.scaleX ?? 1);
  const scaleY = Number(transform.scaleY ?? 1);
  return {
    width: Math.max(1, sourceWidth * scaleX),
    height: Math.max(1, sourceHeight * scaleY),
  };
}

function scaledTransform(
  original: ObsSceneItemTransform,
  point: { x: number; y: number; scale?: number },
): ObsSceneItemTransform {
  const next: ObsSceneItemTransform = {
    positionX: point.x,
    positionY: point.y,
  };
  if (point.scale != null) {
    const baseScaleX = Number(original.scaleX ?? 1);
    const baseScaleY = Number(original.scaleY ?? 1);
    next.scaleX = baseScaleX * point.scale;
    next.scaleY = baseScaleY * point.scale;
  }
  return next;
}

function interpolatePathPoint(path: ObsTransformPoint[], progress: number): ObsTransformPoint {
  if (path.length === 1) return path[0]!;
  const scaled = progress * (path.length - 1);
  const index = Math.min(path.length - 2, Math.floor(scaled));
  const local = scaled - index;
  const a = path[index]!;
  const b = path[index + 1]!;
  const scaleA = a.scale ?? b.scale;
  const scaleB = b.scale ?? a.scale;
  return {
    x: a.x + (b.x - a.x) * local,
    y: a.y + (b.y - a.y) * local,
    scale: scaleA != null && scaleB != null ? scaleA + (scaleB - scaleA) * local : undefined,
  };
}

export function writableObsTransformSnapshot(transform: ObsSceneItemTransform): ObsSceneItemTransform {
  const keys = [
    "alignment",
    "boundsAlignment",
    "boundsType",
    "cropBottom",
    "cropLeft",
    "cropRight",
    "cropTop",
    "positionX",
    "positionY",
    "rotation",
    "scaleX",
    "scaleY",
  ];
  const snapshot = Object.fromEntries(
    keys
      .map((key) => [key, transform[key]] as const)
      .filter(([, value]) => value !== undefined),
  ) as ObsSceneItemTransform;

  const boundsWidth = Number(transform.boundsWidth);
  const boundsHeight = Number(transform.boundsHeight);
  if (Number.isFinite(boundsWidth) && boundsWidth >= 1) {
    snapshot.boundsWidth = boundsWidth;
  }
  if (Number.isFinite(boundsHeight) && boundsHeight >= 1) {
    snapshot.boundsHeight = boundsHeight;
  }
  return snapshot;
}

function closeEnough(a: unknown, b: unknown): boolean {
  const an = Number(a);
  const bn = Number(b);
  if (!Number.isFinite(an) || !Number.isFinite(bn)) return a === b;
  return Math.abs(an - bn) < 0.5;
}

async function restoreSceneItem(
  sceneName: string,
  sceneItemId: number,
  transform: ObsSceneItemTransform,
  visible: boolean,
): Promise<boolean> {
  let restored = false;
  for (const waitMs of [0, 80, 200, 500]) {
    if (waitMs > 0) await delay(waitMs);
    const transformOk = await setObsSourceTransformById(sceneName, sceneItemId, transform);
    const visibleOk = await setObsSourceVisibleById(sceneName, sceneItemId, visible);
    const current = await getObsSourceTransformById(sceneName, sceneItemId);
    restored = Boolean(
      transformOk &&
        visibleOk &&
        current &&
        closeEnough(current.positionX, transform.positionX) &&
        closeEnough(current.positionY, transform.positionY) &&
        closeEnough(current.scaleX, transform.scaleX) &&
        closeEnough(current.scaleY, transform.scaleY),
    );
    if (restored) return true;
  }
  return restored;
}

export async function runObsSourceMotion(config: ObsSourceMotionConfig): Promise<boolean> {
  const sceneName = config.sceneName.trim();
  const sourceName = config.sourceName.trim();
  if (!sceneName || !sourceName) return false;

  const originalItem = await getObsSceneItem(sceneName, sourceName);
  const original = await getObsSourceTransform(sceneName, sourceName);
  if (!originalItem || !original) return false;

  const key = `${sceneName}\n${sourceName}`;
  const previousMotion = activeMotions.get(key);
  if (previousMotion) previousMotion.cancelled = true;
  const token: ActiveMotion = {
    cancelled: false,
    restoreTransform: previousMotion?.restoreTransform ?? writableObsTransformSnapshot(original),
    restoreVisible: previousMotion?.restoreVisible ?? originalItem.sceneItemEnabled,
  };
  activeMotions.set(key, token);

  if (typeof config.visible === "boolean") {
    const visibleOk = await setObsSourceVisibleById(sceneName, originalItem.sceneItemId, config.visible);
    if (!visibleOk) return false;
  }

  const mode = config.mode ?? "set";
  const durationMs = clampNumber(config.durationMs, mode === "set" ? 0 : 5000, 0, 60_000);
  const fps = clampNumber(config.fps, 30, 10, 60);
  const frameMs = Math.max(16, Math.round(1000 / fps));

  try {
    if (mode === "set" || durationMs <= 0) {
      const transform: ObsSceneItemTransform = {};
      if (config.x != null) transform.positionX = Number(config.x);
      if (config.y != null) transform.positionY = Number(config.y);
      if (config.scale != null) {
        transform.scaleX = Number(original.scaleX ?? 1) * Number(config.scale);
        transform.scaleY = Number(original.scaleY ?? 1) * Number(config.scale);
      }
      if (config.width != null && Number(original.sourceWidth)) {
        transform.scaleX = Number(config.width) / Number(original.sourceWidth);
      }
      if (config.height != null && Number(original.sourceHeight)) {
        transform.scaleY = Number(config.height) / Number(original.sourceHeight);
      }
      return Object.keys(transform).length
        ? setObsSourceTransformById(sceneName, originalItem.sceneItemId, transform)
        : true;
    }

    const startedAt = Date.now();
    if (mode === "path") {
      const path = (config.path ?? []).filter(
        (p) => Number.isFinite(Number(p.x)) && Number.isFinite(Number(p.y)),
      );
      if (!path.length) return false;
      let failed = false;
      while (!token.cancelled) {
        const progress = Math.min(1, (Date.now() - startedAt) / durationMs);
        const point = interpolatePathPoint(path, progress);
        const ok = await setObsSourceTransformById(
          sceneName,
          originalItem.sceneItemId,
          scaledTransform(original, point),
        );
        if (!ok) {
          failed = true;
          break;
        }
        if (progress >= 1) break;
        await delay(frameMs);
      }
      return !token.cancelled && !failed;
    }

    const boundsWidth = clampNumber(config.boundsWidth, 3840, 1, 10000);
    const boundsHeight = clampNumber(config.boundsHeight, 2160, 1, 10000);
    const size = currentSize(original);
    let x = clampNumber(config.x, Number(original.positionX ?? 0), 0, boundsWidth);
    let y = clampNumber(config.y, Number(original.positionY ?? 0), 0, boundsHeight);
    let vx = clampNumber(config.speedX, 9, -200, 200);
    let vy = clampNumber(config.speedY, 6, -200, 200);
    if (vx === 0) vx = 9;
    if (vy === 0) vy = 6;
    if (config.randomizeStart !== false) {
      const speed = Math.max(1, Math.hypot(vx, vy));
      const angle = Math.random() * Math.PI * 2;
      vx = Math.cos(angle) * speed;
      vy = Math.sin(angle) * speed;
    }

    while (!token.cancelled && Date.now() - startedAt < durationMs) {
      x += vx;
      y += vy;
      if (x <= 0 || x + size.width >= boundsWidth) {
        vx *= -1;
        x = Math.max(0, Math.min(boundsWidth - size.width, x));
      }
      if (y <= 0 || y + size.height >= boundsHeight) {
        vy *= -1;
        y = Math.max(0, Math.min(boundsHeight - size.height, y));
      }
      const ok = await setObsSourceTransformById(sceneName, originalItem.sceneItemId, scaledTransform(original, { x, y, scale: config.scale }));
      if (!ok) return false;
      await delay(frameMs);
    }
    return !token.cancelled;
  } finally {
    if (activeMotions.get(key) === token) activeMotions.delete(key);
    if (config.restore !== false && !token.cancelled) {
      const restored = await restoreSceneItem(
        sceneName,
        originalItem.sceneItemId,
        token.restoreTransform,
        token.restoreVisible,
      );
      if (!restored) {
        console.warn(`OBS restore did not verify for ${sceneName}/${sourceName}`);
      }
    }
  }
}

export async function setObsInputSettings(
  inputName: string,
  inputSettings: Record<string, unknown>,
  overlay = true,
): Promise<boolean> {
  const result = await safeObsCall("SetInputSettings", {
    inputName,
    inputSettings,
    overlay,
  });
  return result !== null;
}

export async function setObsText(inputName: string, text: string): Promise<boolean> {
  return setObsInputSettings(inputName, { text });
}

export async function startObsStream(): Promise<boolean> {
  return (await safeObsCall("StartStream")) !== null;
}

export async function stopObsStream(): Promise<boolean> {
  return (await safeObsCall("StopStream")) !== null;
}

export async function startObsRecording(): Promise<boolean> {
  return (await safeObsCall("StartRecord")) !== null;
}

export async function stopObsRecording(): Promise<boolean> {
  return (await safeObsCall("StopRecord")) !== null;
}

export async function pauseObsRecording(): Promise<boolean> {
  return (await safeObsCall("PauseRecord")) !== null;
}

export async function resumeObsRecording(): Promise<boolean> {
  return (await safeObsCall("ResumeRecord")) !== null;
}

export async function startObsReplayBuffer(): Promise<boolean> {
  return (await safeObsCall("StartReplayBuffer")) !== null;
}

export async function stopObsReplayBuffer(): Promise<boolean> {
  return (await safeObsCall("StopReplayBuffer")) !== null;
}

export async function saveObsReplayBuffer(): Promise<boolean> {
  return (await safeObsCall("SaveReplayBuffer")) !== null;
}

export async function setObsSourceFilterEnabled(
  sourceName: string,
  filterName: string,
  enabled: boolean,
): Promise<boolean> {
  return (await safeObsCall("SetSourceFilterEnabled", {
    sourceName,
    filterName,
    filterEnabled: enabled,
  })) !== null;
}

export function getObsStatus() {
  const cfg = getObsConfig();
  return {
    host: cfg.host,
    port: cfg.port,
    hasPassword: Boolean(cfg.password),
    connected: getSetting("obs_connected") === "1",
  };
}
