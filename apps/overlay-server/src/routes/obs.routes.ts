import {
  ensureObsBrowserSources,
  getCurrentObsScene,
  getObsBrowserSourceStatuses,
  listObsSceneSources,
  listObsScenes,
  runObsSourceMotion,
  setObsInputSettings,
  setObsScene,
  setObsSourceVisible,
  setObsText,
} from "../obs-client.js";
import { EXPECTED_OVERLAYS } from "../overlay-definitions.js";
import { getOverlayOrigin } from "../server-urls.js";
import type {
  ObsInputSettingsBody,
  ObsSceneBody,
  ObsSourceMotionBody,
  ObsSourceVisibilityBody,
  ObsTextBody,
} from "../schemas/obs.schema.js";
import type { RouteModule } from "./types.js";

export const registerObsRoutes: RouteModule = (app) => {
  app.get("/api/obs/browser-sources", async (_req, reply) => {
    const sources = await getObsBrowserSourceStatuses(EXPECTED_OVERLAYS, getOverlayOrigin());
    if (!sources) {
      return reply.status(503).send(actionError("OBS_DISCONNECTED", "OBS Offline", "Could not inspect OBS browser sources"));
    }
    return { ok: true, sources };
  });

  app.post("/api/obs/browser-sources/ensure", async (req, reply) => {
    const body = req.body as { sceneName?: string } | undefined;
    const result = await ensureObsBrowserSources(EXPECTED_OVERLAYS, getOverlayOrigin(), body?.sceneName);
    if (!result) {
      return reply.status(503).send(actionError("OBS_DISCONNECTED", "OBS Offline", "Could not create or update OBS browser sources"));
    }
    return {
      ok: result.sources.every((source) => source.configured && source.correctUrl && source.action !== "failed"),
      ...result,
    };
  });

  app.get("/api/obs/scenes", async (_req, reply) => {
    const scenes = await listObsScenes();
    if (!scenes) {
      return reply.status(503).send({
        ok: false,
        code: "OBS_DISCONNECTED",
        title: "OBS Offline",
        message: "Could not reach OBS WebSocket",
        color: "#eb0400",
        icon: "alert-triangle",
        retryable: true,
        scenes: [],
      });
    }
    return { ok: true, currentScene: await getCurrentObsScene(), scenes };
  });

  app.get("/api/obs/scenes/:sceneName/sources", async (req, reply) => {
    const { sceneName } = req.params as { sceneName: string };
    const sources = await listObsSceneSources(sceneName);
    if (!sources) {
      return reply.status(503).send({
        ok: false,
        code: "OBS_SCENE_UNAVAILABLE",
        title: "Scene Unavailable",
        message: `Could not read sources for ${sceneName}`,
        color: "#eb0400",
        icon: "alert-triangle",
        retryable: true,
        sources: [],
      });
    }
    return { ok: true, sceneName, sources };
  });

  app.post("/api/actions/obs/scene", async (req, reply) => {
    const sceneName = (req.body as ObsSceneBody).sceneName?.trim();
    if (!sceneName) return reply.status(400).send(actionError("SCENE_REQUIRED", "No Scene", "sceneName is required"));
    const ok = await setObsScene(sceneName);
    return reply.status(ok ? 200 : 503).send({
      ok,
      code: ok ? "OBS_SCENE_CHANGED" : "OBS_DISCONNECTED",
      title: ok ? "Scene Live" : "OBS Offline",
      message: ok ? `Switched to ${sceneName}` : "Could not reach OBS WebSocket",
      color: ok ? "#00f593" : "#eb0400",
      icon: ok ? "check" : "alert-triangle",
      retryable: !ok,
      state: { obsConnected: ok, scene: ok ? sceneName : undefined },
    });
  });

  app.post("/api/actions/obs/source-visibility", async (req, reply) => {
    const body = req.body as ObsSourceVisibilityBody;
    const sceneName = body.sceneName?.trim();
    const sourceName = body.sourceName?.trim();
    if (!sceneName || !sourceName || typeof body.visible !== "boolean") {
      return reply.status(400).send(actionError("SOURCE_VISIBILITY_REQUIRED", "Missing Source", "sceneName, sourceName, and visible are required"));
    }
    const ok = await setObsSourceVisible(sceneName, sourceName, body.visible);
    return reply.status(ok ? 200 : 503).send({
      ok,
      code: ok ? "OBS_SOURCE_VISIBILITY_CHANGED" : "OBS_SOURCE_UNAVAILABLE",
      title: ok ? "Source Updated" : "Source Unavailable",
      message: ok ? `${sourceName} is ${body.visible ? "visible" : "hidden"}` : `Could not update ${sourceName} in ${sceneName}`,
      color: ok ? "#00f593" : "#eb0400",
      icon: ok ? "eye" : "alert-triangle",
      retryable: !ok,
      state: { obsConnected: ok, sceneName, sourceName, visible: body.visible },
    });
  });

  app.post("/api/actions/obs/source-motion", async (req, reply) => {
    const body = req.body as ObsSourceMotionBody;
    const sceneName = body.sceneName?.trim();
    const sourceName = body.sourceName?.trim();
    if (!sceneName || !sourceName) return reply.status(400).send(actionError("SOURCE_MOTION_REQUIRED", "Missing Source", "sceneName and sourceName are required"));
    const ok = await runObsSourceMotion({ ...body, sceneName, sourceName });
    return reply.status(ok ? 200 : 503).send({
      ok,
      code: ok ? "OBS_SOURCE_MOTION_COMPLETE" : "OBS_SOURCE_MOTION_FAILED",
      title: ok ? "Motion Complete" : "Motion Failed",
      message: ok ? `${sourceName} ${body.mode ?? "set"} motion completed` : `Could not move ${sourceName} in ${sceneName}`,
      color: ok ? "#00f593" : "#eb0400",
      icon: ok ? "move" : "alert-triangle",
      retryable: !ok,
      state: { obsConnected: ok, sceneName, sourceName, mode: body.mode ?? "set" },
    });
  });

  app.post("/api/actions/obs/text", async (req, reply) => {
    const body = req.body as ObsTextBody;
    const inputName = body.inputName?.trim();
    if (!inputName || body.text == null) return reply.status(400).send(actionError("TEXT_INPUT_REQUIRED", "Missing Text", "inputName and text are required"));
    const ok = await setObsText(inputName, body.text);
    return reply.status(ok ? 200 : 503).send(actionResponse(ok, "OBS_TEXT_UPDATED", "OBS_INPUT_UNAVAILABLE", "Text Updated", "Input Unavailable", ok ? `${inputName} updated` : `Could not update ${inputName}`, { obsConnected: ok, inputName }));
  });

  app.post("/api/actions/obs/input-settings", async (req, reply) => {
    const body = req.body as ObsInputSettingsBody;
    const inputName = body.inputName?.trim();
    if (!inputName || !body.inputSettings || typeof body.inputSettings !== "object") return reply.status(400).send(actionError("INPUT_SETTINGS_REQUIRED", "Missing Settings", "inputName and inputSettings are required"));
    const ok = await setObsInputSettings(inputName, body.inputSettings, body.overlay ?? true);
    return reply.status(ok ? 200 : 503).send(actionResponse(ok, "OBS_INPUT_SETTINGS_UPDATED", "OBS_INPUT_UNAVAILABLE", "Input Updated", "Input Unavailable", ok ? `${inputName} updated` : `Could not update ${inputName}`, { obsConnected: ok, inputName }));
  });
};

function actionError(code: string, title: string, message: string) {
  return { ok: false, code, title, message, color: "#eb0400", icon: "alert-triangle", retryable: false };
}

function actionResponse(ok: boolean, okCode: string, failCode: string, okTitle: string, failTitle: string, message: string, state: Record<string, unknown>) {
  return {
    ok,
    code: ok ? okCode : failCode,
    title: ok ? okTitle : failTitle,
    message,
    color: ok ? "#00f593" : "#eb0400",
    icon: ok ? "type" : "alert-triangle",
    retryable: !ok,
    state,
  };
}
