import type { ObsSceneInfo, ObsSourceInfo, SourceGroup } from "../../api";
import { Button, Card, CardHeader } from "../../ui";

interface LiveObsControlPanelProps {
  currentObsScene: string | null;
  selectedObsScene: string;
  obsScenes: ObsSceneInfo[];
  obsSources: ObsSourceInfo[];
  sourceGroups: SourceGroup[];
  activeSourceGroupId?: string;
  sourceGroupId: string;
  sourceGroupName: string;
  selectedSourceNames: string[];
  obsTextInput: string;
  obsTextValue: string;
  onRefreshScenes: () => void;
  onSelectObsScene: (sceneName: string) => void;
  onSwitchScene: () => void;
  onObsTextInputChange: (value: string) => void;
  onObsTextValueChange: (value: string) => void;
  onUpdateObsText: () => void;
  onSourceGroupNameChange: (value: string) => void;
  onClearSourceGroup: () => void;
  onSaveSourceGroup: () => void;
  onToggleSourceGroupSelection: (sourceName: string) => void;
  onApplySourceGroup: (group: SourceGroup) => void;
  onEditSourceGroup: (group: SourceGroup) => void;
  onRemoveSourceGroup: (group: SourceGroup) => void;
  onToggleObsSource: (source: ObsSourceInfo) => void;
}

export function LiveObsControlPanel({
  currentObsScene,
  selectedObsScene,
  obsScenes,
  obsSources,
  sourceGroups,
  activeSourceGroupId,
  sourceGroupId,
  sourceGroupName,
  selectedSourceNames,
  obsTextInput,
  obsTextValue,
  onRefreshScenes,
  onSelectObsScene,
  onSwitchScene,
  onObsTextInputChange,
  onObsTextValueChange,
  onUpdateObsText,
  onSourceGroupNameChange,
  onClearSourceGroup,
  onSaveSourceGroup,
  onToggleSourceGroupSelection,
  onApplySourceGroup,
  onEditSourceGroup,
  onRemoveSourceGroup,
  onToggleObsSource,
}: LiveObsControlPanelProps) {
  const canSaveSourceGroup = Boolean(selectedObsScene && sourceGroupName.trim() && selectedSourceNames.length);

  return (
    <Card>
      <CardHeader
        title="OBS Control"
        description={`Current scene: ${currentObsScene ?? "Unavailable"}`}
        action={
          <Button type="button" variant="secondary" size="sm" onClick={onRefreshScenes}>
            Refresh OBS
          </Button>
        }
      />

      <div className="live-obs-grid">
        <div>
          <label>Scene</label>
          <select value={selectedObsScene} onChange={(event) => onSelectObsScene(event.target.value)}>
            <option value="">Select scene</option>
            {obsScenes.map((scene) => (
              <option key={scene.sceneName} value={scene.sceneName}>
                {scene.sceneName}
              </option>
            ))}
          </select>
          <Button type="button" variant="primary" size="sm" onClick={onSwitchScene} disabled={!selectedObsScene}>
            Switch scene
          </Button>
        </div>

        <div>
          <label>Text input name</label>
          <input
            value={obsTextInput}
            onChange={(event) => onObsTextInputChange(event.target.value)}
            placeholder="OBS text source"
          />
          <label>Text</label>
          <input
            value={obsTextValue}
            onChange={(event) => onObsTextValueChange(event.target.value)}
            placeholder="Text to send"
          />
          <Button type="button" variant="secondary" size="sm" onClick={onUpdateObsText} disabled={!obsTextInput.trim()}>
            Update text
          </Button>
        </div>
      </div>

      <section className="live-activity-layouts">
        <h2>Activity Layouts</h2>
        <p>Save which sources belong to an activity and capture their current OBS positions.</p>
        <div className="live-obs-grid">
          <div>
            <label>Activity name</label>
            <input
              value={sourceGroupName}
              onChange={(event) => onSourceGroupNameChange(event.target.value)}
              placeholder="Apex, Just Chatting, Coding..."
            />
            <div className="actions live-actions-tight">
              <Button type="button" variant="primary" size="sm" onClick={onSaveSourceGroup} disabled={!canSaveSourceGroup}>
                {sourceGroupId ? "Update layout" : "Save layout"}
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={onClearSourceGroup}>
                Clear
              </Button>
            </div>
          </div>

          <div>
            <label>Sources in this activity</label>
            <div className="live-source-picker">
              {obsSources.map((source) => (
                <label key={`group-${source.sceneItemId}-${source.sourceName}`}>
                  <input
                    type="checkbox"
                    checked={selectedSourceNames.includes(source.sourceName)}
                    onChange={() => onToggleSourceGroupSelection(source.sourceName)}
                  />{" "}
                  {source.sourceName}
                </label>
              ))}
              {!obsSources.length ? <span>Select an OBS scene first.</span> : null}
            </div>
          </div>
        </div>

        {sourceGroups.length ? (
          <div className="live-source-group-grid">
            {sourceGroups.map((group) => (
              <SourceGroupCard
                key={group.id}
                group={group}
                active={group.id === activeSourceGroupId}
                onApply={() => onApplySourceGroup(group)}
                onEdit={() => onEditSourceGroup(group)}
                onRemove={() => onRemoveSourceGroup(group)}
              />
            ))}
          </div>
        ) : null}
      </section>

      {obsSources.length ? (
        <table className="table live-obs-sources-table">
          <thead>
            <tr>
              <th>Source</th>
              <th>Visible</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {obsSources.map((source) => (
              <tr key={`${source.sceneItemId}-${source.sourceName}`}>
                <td>{source.sourceName}</td>
                <td>{source.sceneItemEnabled ? "Yes" : "No"}</td>
                <td>
                  <Button type="button" variant="secondary" size="sm" onClick={() => onToggleObsSource(source)}>
                    {source.sceneItemEnabled ? "Hide" : "Show"}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="live-muted-copy">Connect OBS and select a scene to inspect sources.</p>
      )}
    </Card>
  );
}

function SourceGroupCard({
  group,
  active,
  onApply,
  onEdit,
  onRemove,
}: {
  group: SourceGroup;
  active: boolean;
  onApply: () => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  return (
    <div className={active ? "live-source-group live-source-group--active" : "live-source-group"}>
      <div className="live-source-group__header">
        <strong>{group.name}</strong>
        {active ? <span className="badge badge-ok">Live</span> : null}
      </div>
      <p>
        {group.sceneName} - {group.sources.length} source{group.sources.length === 1 ? "" : "s"}
      </p>
      <div className="actions">
        <Button type="button" variant="primary" size="sm" onClick={onApply}>
          Go live
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={onEdit}>
          Edit
        </Button>
        <Button type="button" variant="danger" size="sm" onClick={onRemove}>
          Delete
        </Button>
      </div>
    </div>
  );
}
