import { useEffect, useMemo, useState } from "react";
import {
  api,
  type MacroConfig,
  type ObsSceneInfo,
  type ObsSourceInfo,
  type SourceGroup,
} from "../../api";
import { useToast } from "../../hooks/useToast";
import { Button, Card, CardHeader, CopyField } from "../../ui";

type StreamDeckBuilderAction =
  | "macro"
  | "sourceGroup"
  | "obsScene"
  | "sourceVisibility"
  | "sourceMotion"
  | "text"
  | "status";

interface StreamDeckRequest {
  method: "GET" | "POST";
  url: string;
  headers: Record<string, string>;
  body: string;
  notes: string[];
}

const STREAM_DECK_API_BASE = "http://127.0.0.1:4782/api";

function prettyJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function StreamDeckRequestBuilder() {
  const [macros, setMacros] = useState<MacroConfig[]>([]);
  const [sourceGroups, setSourceGroups] = useState<SourceGroup[]>([]);
  const [obsScenes, setObsScenes] = useState<ObsSceneInfo[]>([]);
  const [obsSources, setObsSources] = useState<ObsSourceInfo[]>([]);
  const [selectedObsScene, setSelectedObsScene] = useState("");
  const [obsTextInput] = useState("");
  const [builderAction, setBuilderAction] = useState<StreamDeckBuilderAction>("macro");
  const [builderMacroId, setBuilderMacroId] = useState("");
  const [builderSourceGroupId, setBuilderSourceGroupId] = useState("");
  const [builderSceneName, setBuilderSceneName] = useState("");
  const [builderSourceName, setBuilderSourceName] = useState("");
  const [builderVisible, setBuilderVisible] = useState(true);
  const [builderMotionMode, setBuilderMotionMode] = useState<"dvd" | "set">("dvd");
  const [builderTextInput, setBuilderTextInput] = useState("");
  const [builderTextValue, setBuilderTextValue] = useState("");
  const toast = useToast();

  useEffect(() => {
    void Promise.all([api.macros(), api.sourceGroups(), api.obsScenes()])
      .then(async ([nextMacros, nextSourceGroups, scenesResponse]) => {
        setMacros(nextMacros);
        setSourceGroups(nextSourceGroups);
        setObsScenes(scenesResponse.scenes);
        const sceneName = scenesResponse.currentScene || scenesResponse.scenes[0]?.sceneName || "";
        setSelectedObsScene(sceneName);
        setBuilderSceneName(sceneName);
        if (sceneName) {
          const sources = await api.obsSceneSources(sceneName);
          setObsSources(sources.sources);
          setBuilderSourceName(sources.sources[0]?.sourceName ?? "");
        }
      })
      .catch(() => {
        setObsScenes([]);
        setObsSources([]);
      });
  }, []);

  useEffect(() => {
    if (!selectedObsScene) {
      setObsSources([]);
      return;
    }
    void api
      .obsSceneSources(selectedObsScene)
      .then((res) => {
        setObsSources(res.sources);
        setBuilderSourceName(res.sources[0]?.sourceName ?? "");
      })
      .catch(() => setObsSources([]));
  }, [selectedObsScene]);

  useEffect(() => {
    if (!builderMacroId && macros.length) setBuilderMacroId(macros[0]!.id);
  }, [builderMacroId, macros]);

  useEffect(() => {
    if (!builderSourceGroupId && sourceGroups.length) setBuilderSourceGroupId(sourceGroups[0]!.id);
  }, [builderSourceGroupId, sourceGroups]);

  const streamDeckRequest = useMemo<StreamDeckRequest>(() => {
    const postHeaders = { "Content-Type": "application/json" };
    switch (builderAction) {
      case "macro":
        return {
          method: "POST",
          url: `${STREAM_DECK_API_BASE}/actions/macro/${encodeURIComponent(builderMacroId || "macro-id")}`,
          headers: postHeaders,
          body: "{}",
          notes: ["API Ninja method: POST", "Use the selected macro id from the Macros page."],
        };
      case "sourceGroup":
        return {
          method: "POST",
          url: `${STREAM_DECK_API_BASE}/actions/source-group/${encodeURIComponent(builderSourceGroupId || "source-group-id")}`,
          headers: postHeaders,
          body: "{}",
          notes: ["Shows this activity's sources, hides non-members, and restores saved positions."],
        };
      case "obsScene":
        return {
          method: "POST",
          url: `${STREAM_DECK_API_BASE}/actions/obs/scene`,
          headers: postHeaders,
          body: prettyJson({ sceneName: builderSceneName || selectedObsScene || "Scene name" }),
          notes: ["Switches the OBS program scene."],
        };
      case "sourceVisibility":
        return {
          method: "POST",
          url: `${STREAM_DECK_API_BASE}/actions/obs/source-visibility`,
          headers: postHeaders,
          body: prettyJson({
            sceneName: builderSceneName || selectedObsScene || "Scene name",
            sourceName: builderSourceName || "Source name",
            visible: builderVisible,
          }),
          notes: ["Create one key for show and one key for hide, or change visible as needed."],
        };
      case "sourceMotion": {
        const base = {
          sceneName: builderSceneName || selectedObsScene || "Scene name",
          sourceName: builderSourceName || "Source name",
          mode: builderMotionMode,
        };
        return {
          method: "POST",
          url: `${STREAM_DECK_API_BASE}/actions/obs/source-motion`,
          headers: postHeaders,
          body:
            builderMotionMode === "dvd"
              ? prettyJson({
                  ...base,
                  durationMs: 8000,
                  boundsWidth: 3840,
                  boundsHeight: 2160,
                  speedX: 9,
                  speedY: 6,
                  randomizeStart: true,
                  restore: true,
                })
              : prettyJson({
                  ...base,
                  x: 0,
                  y: 0,
                  width: 720,
                }),
          notes: ["DVD mode bounces the source and restores it by default."],
        };
      }
      case "text":
        return {
          method: "POST",
          url: `${STREAM_DECK_API_BASE}/actions/obs/text`,
          headers: postHeaders,
          body: prettyJson({
            inputName: builderTextInput || obsTextInput || "OBS text source",
            text: builderTextValue || "Text from Stream Deck",
          }),
          notes: ["Updates an OBS text input."],
        };
      case "status":
        return {
          method: "GET",
          url: `${STREAM_DECK_API_BASE}/stream-deck/status`,
          headers: {},
          body: "",
          notes: ["Use this for a polling/status key if your Stream Deck plugin supports it."],
        };
      default:
        return {
          method: "POST",
          url: STREAM_DECK_API_BASE,
          headers: postHeaders,
          body: "{}",
          notes: [],
        };
    }
  }, [
    builderAction,
    builderMacroId,
    builderMotionMode,
    builderSceneName,
    builderSourceGroupId,
    builderSourceName,
    builderTextInput,
    builderTextValue,
    builderVisible,
    obsTextInput,
    selectedObsScene,
  ]);

  const apiNinjaConfig = useMemo(
    () =>
      [
        `Method: ${streamDeckRequest.method}`,
        `URL: ${streamDeckRequest.url}`,
        `Headers: ${Object.keys(streamDeckRequest.headers).length ? prettyJson(streamDeckRequest.headers) : "(none)"}`,
        `Body: ${streamDeckRequest.body || "(empty)"}`,
      ].join("\n\n"),
    [streamDeckRequest],
  );

  const copyStreamDeckConfig = async () => {
    await navigator.clipboard.writeText(apiNinjaConfig);
    toast("API Ninja request copied");
  };

  return (
    <Card>
      <CardHeader
        title="API Ninja Request Builder"
        description="Build BarRaider API Ninja requests without hand-writing endpoints."
        action={
          <Button type="button" variant="primary" size="sm" onClick={() => void copyStreamDeckConfig()}>
            Copy API Ninja config
          </Button>
        }
      />

      <div className="stream-deck-builder">
        <div>
          <label>Button action</label>
          <select value={builderAction} onChange={(event) => setBuilderAction(event.target.value as StreamDeckBuilderAction)}>
            <option value="macro">Run macro</option>
            <option value="sourceGroup">Activate activity layout</option>
            <option value="obsScene">Switch OBS scene</option>
            <option value="sourceVisibility">Show / hide OBS source</option>
            <option value="sourceMotion">Move OBS source</option>
            <option value="text">Update OBS text</option>
            <option value="status">Read hub status</option>
          </select>

          {builderAction === "macro" ? (
            <>
              <label>Macro</label>
              <select value={builderMacroId} onChange={(event) => setBuilderMacroId(event.target.value)}>
                <option value="">Select macro</option>
                {macros.map((macro) => (
                  <option key={macro.id} value={macro.id}>
                    {macro.name}
                  </option>
                ))}
              </select>
            </>
          ) : null}

          {builderAction === "sourceGroup" ? (
            <>
              <label>Activity layout</label>
              <select value={builderSourceGroupId} onChange={(event) => setBuilderSourceGroupId(event.target.value)}>
                <option value="">Select activity</option>
                {sourceGroups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </>
          ) : null}

          {["obsScene", "sourceVisibility", "sourceMotion"].includes(builderAction) ? (
            <>
              <label>Scene</label>
              <select
                value={builderSceneName}
                onChange={(event) => {
                  setBuilderSceneName(event.target.value);
                  setSelectedObsScene(event.target.value);
                }}
              >
                <option value="">Select scene</option>
                {obsScenes.map((scene) => (
                  <option key={scene.sceneName} value={scene.sceneName}>
                    {scene.sceneName}
                  </option>
                ))}
              </select>
            </>
          ) : null}

          {["sourceVisibility", "sourceMotion"].includes(builderAction) ? (
            <>
              <label>Source</label>
              <select value={builderSourceName} onChange={(event) => setBuilderSourceName(event.target.value)}>
                <option value="">Select source</option>
                {obsSources.map((source) => (
                  <option key={`${source.sceneItemId}-${source.sourceName}`} value={source.sourceName}>
                    {source.sourceName}
                  </option>
                ))}
              </select>
            </>
          ) : null}

          {builderAction === "sourceVisibility" ? (
            <label>
              <input
                type="checkbox"
                checked={builderVisible}
                onChange={(event) => setBuilderVisible(event.target.checked)}
              />{" "}
              Show source
            </label>
          ) : null}

          {builderAction === "sourceMotion" ? (
            <>
              <label>Motion</label>
              <select value={builderMotionMode} onChange={(event) => setBuilderMotionMode(event.target.value as "dvd" | "set")}>
                <option value="dvd">DVD bounce</option>
                <option value="set">Set position / size</option>
              </select>
            </>
          ) : null}

          {builderAction === "text" ? (
            <>
              <label>OBS text input</label>
              <input
                value={builderTextInput}
                onChange={(event) => setBuilderTextInput(event.target.value)}
                placeholder="OBS text source"
              />
              <label>Text</label>
              <input
                value={builderTextValue}
                onChange={(event) => setBuilderTextValue(event.target.value)}
                placeholder="Text from Stream Deck"
              />
            </>
          ) : null}
        </div>

        <div>
          <CopyField label="API Ninja request URL" value={streamDeckRequest.url} />
          <div className="stream-deck-builder__meta">
            <div>
              <label>Method</label>
              <input value={streamDeckRequest.method} readOnly />
            </div>
            <div>
              <label>Content-Type</label>
              <input value={streamDeckRequest.headers["Content-Type"] ?? ""} readOnly placeholder="None" />
            </div>
          </div>
          <label>Body</label>
          <textarea
            className="stream-deck-builder__body"
            rows={8}
            value={streamDeckRequest.body}
            readOnly
            placeholder="No body for this request"
          />
          <div className="actions stream-deck-builder__actions">
            <Button type="button" variant="secondary" size="sm" onClick={() => void copyStreamDeckConfig()}>
              Copy all fields
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => void navigator.clipboard.writeText(streamDeckRequest.url).then(() => toast("URL copied"))}
            >
              Copy URL
            </Button>
            {streamDeckRequest.body ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => void navigator.clipboard.writeText(streamDeckRequest.body).then(() => toast("Body copied"))}
              >
                Copy body
              </Button>
            ) : null}
          </div>
          {streamDeckRequest.notes.length ? (
            <p className="stream-deck-builder__notes">{streamDeckRequest.notes.join(" ")}</p>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
