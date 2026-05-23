import {
  getSourceGroup,
  setSetting,
} from "../db.js";
import {
  listObsSceneSources,
  setObsSourceTransform,
  setObsSourceVisible,
  writableObsTransformSnapshot,
} from "../obs-client.js";

export interface ApplySourceGroupResult {
  ok: boolean;
  code: string;
  title: string;
  message: string;
  color: string;
  icon: string;
  retryable: boolean;
  state?: Record<string, unknown>;
}

export async function applySourceGroup(id: string): Promise<ApplySourceGroupResult> {
  const group = getSourceGroup(id);
  if (!group) {
    return {
      ok: false,
      code: "SOURCE_GROUP_NOT_FOUND",
      title: "Layout Missing",
      message: "No activity layout exists with that id",
      color: "#eb0400",
      icon: "alert-triangle",
      retryable: false,
    };
  }

  const sceneSources = await listObsSceneSources(group.sceneName);
  if (!sceneSources) {
    return {
      ok: false,
      code: "OBS_SCENE_UNAVAILABLE",
      title: "Scene Unavailable",
      message: `Could not read sources for ${group.sceneName}`,
      color: "#eb0400",
      icon: "alert-triangle",
      retryable: true,
    };
  }

  const included = new Map(group.sources.map((source) => [source.sourceName, source]));
  let changed = 0;
  for (const source of sceneSources) {
    const groupSource = included.get(source.sourceName);
    const shouldShow = Boolean(groupSource);
    if (source.sceneItemEnabled !== shouldShow) {
      const ok = await setObsSourceVisible(group.sceneName, source.sourceName, shouldShow);
      if (ok) changed += 1;
    }
    if (groupSource?.transform) {
      const ok = await setObsSourceTransform(
        group.sceneName,
        source.sourceName,
        writableObsTransformSnapshot(groupSource.transform),
      );
      if (ok) changed += 1;
    }
  }

  setSetting("active_source_group_id", group.id);
  setSetting("active_source_group_name", group.name);
  setSetting("active_source_group_scene", group.sceneName);

  return {
    ok: true,
    code: "SOURCE_GROUP_APPLIED",
    title: "Activity Live",
    message: `${group.name}: ${group.sources.length} source${group.sources.length === 1 ? "" : "s"} active`,
    color: "#00f593",
    icon: "layers",
    retryable: false,
    state: {
      sceneName: group.sceneName,
      groupId: group.id,
      changed,
    },
  };
}
