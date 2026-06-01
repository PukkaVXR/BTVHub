import type { ChangeEvent } from "react";
import { Link } from "react-router-dom";
import type { AlertProject, StreamEventType } from "@btv/shared";
import { Button, ButtonLink } from "../../ui";

interface AlertEditorToolbarProps {
  projects: AlertProject[];
  eventTypes: StreamEventType[];
  selectedProjectId: string;
  selectedTestEventType: StreamEventType;
  selectedVariationId: string;
  variationOptions: Array<{ id: string; name: string }>;
  saving: boolean;
  dirty: boolean;
  canUndo: boolean;
  canRedo: boolean;
  canUseProject: boolean;
  onSelectProject: (projectId: string) => void;
  onSelectTestEventType: (eventType: StreamEventType) => void;
  onSelectVariation: (variationId: string) => void;
  onTestInObs: () => void;
  onSave: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onCreateProject: () => void;
  onCreateSamplePack: () => void;
  onSaveTemplate: () => void;
  onDuplicateProject: () => void;
  onExportProject: () => void;
  onImportProject: (file: File) => void;
  onCopyObsUrl: () => void;
  onDeleteProject: () => void;
}

export function AlertEditorBreadcrumbs({ projectName }: { projectName?: string }) {
  return (
    <nav className="alert-editor-breadcrumbs" aria-label="Alert editor breadcrumb">
      <Link to="/alerts">Alerts</Link>
      <span>/</span>
      <span>{projectName ?? "New project"}</span>
      <span>/</span>
      <strong>Layers</strong>
    </nav>
  );
}

export function AlertEditorToolbar({
  projects,
  eventTypes,
  selectedProjectId,
  selectedTestEventType,
  selectedVariationId,
  variationOptions,
  saving,
  dirty,
  canUndo,
  canRedo,
  canUseProject,
  onSelectProject,
  onSave,
  onUndo,
  onRedo,
  onCreateProject,
  onCreateSamplePack,
  onSaveTemplate,
  onDuplicateProject,
  onExportProject,
  onImportProject,
  onCopyObsUrl,
  onDeleteProject,
  onSelectTestEventType,
  onSelectVariation,
  onTestInObs,
}: AlertEditorToolbarProps) {
  const importProject = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (file) onImportProject(file);
  };

  return (
    <section className="alert-editor-toolbar" aria-label="Alert editor actions">
      <div className="alert-editor-toolbar__project">
        <label>
          <span>Project</span>
          <select value={selectedProjectId} onChange={(event) => onSelectProject(event.target.value)}>
            {projects.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
        </label>
        <span className={`alert-save-status${dirty ? " dirty" : ""}`}>{dirty ? "Unsaved changes" : "Saved"}</span>
      </div>

      <div className="alert-editor-toolbar__group" aria-label="File actions">
        <span>File</span>
        <Button type="button" variant="primary" size="sm" onClick={onSave} disabled={!canUseProject || saving}>
          {saving ? "Saving..." : dirty ? "Save *" : "Save"}
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={onCreateProject}>New</Button>
        <Button type="button" variant="secondary" size="sm" onClick={onExportProject} disabled={!canUseProject}>Export</Button>
        <label className="ui-button ui-button--secondary ui-button--sm alert-editor-toolbar__import">
          <span>Import</span>
          <input type="file" accept="application/json,.json,.btv-alert.json" onChange={importProject} />
        </label>
      </div>

      <div className="alert-editor-toolbar__group" aria-label="Edit actions">
        <span>Edit</span>
        <Button type="button" variant="secondary" size="sm" onClick={onUndo} disabled={!canUndo}>Undo</Button>
        <Button type="button" variant="secondary" size="sm" onClick={onRedo} disabled={!canRedo}>Redo</Button>
        <Button type="button" variant="secondary" size="sm" onClick={onDuplicateProject} disabled={!canUseProject}>Duplicate</Button>
        <Button type="button" variant="danger" size="sm" onClick={onDeleteProject} disabled={!canUseProject}>Delete</Button>
      </div>

      <div className="alert-editor-toolbar__group alert-editor-toolbar__test" aria-label="Test actions">
        <span>Test</span>
        <select
          aria-label="Test event type"
          value={selectedTestEventType}
          onChange={(event) => onSelectTestEventType(event.target.value as StreamEventType)}
        >
          {eventTypes.map((type) => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
        <select
          aria-label="Test variation"
          value={selectedVariationId}
          onChange={(event) => onSelectVariation(event.target.value)}
          disabled={!variationOptions.length}
        >
          <option value="">Base project</option>
          {variationOptions.map((variation) => (
            <option key={variation.id} value={variation.id}>{variation.name}</option>
          ))}
        </select>
        <Button type="button" variant="primary" size="sm" onClick={onTestInObs} disabled={!canUseProject || saving}>
          Test in OBS
        </Button>
      </div>

      <div className="alert-editor-toolbar__group" aria-label="OBS and template actions">
        <span>OBS</span>
        <Button type="button" variant="secondary" size="sm" onClick={onCopyObsUrl}>Copy OBS URL</Button>
        <details className="alert-editor-toolbar__overflow alert-editor-toolbar__shortcuts">
          <summary className="ui-button ui-button--secondary ui-button--sm">Shortcuts</summary>
          <div>
            <span><kbd>Ctrl</kbd> <kbd>S</kbd> Save</span>
            <span><kbd>Ctrl</kbd> <kbd>Z</kbd> Undo</span>
            <span><kbd>Ctrl</kbd> <kbd>Y</kbd> Redo</span>
            <span><kbd>Ctrl</kbd> <kbd>D</kbd> Duplicate layer</span>
            <span><kbd>Delete</kbd> Delete layer</span>
            <span><kbd>Arrows</kbd> Nudge layer</span>
          </div>
        </details>
        <details className="alert-editor-toolbar__overflow">
          <summary className="ui-button ui-button--secondary ui-button--sm">More</summary>
          <div>
            <Button type="button" variant="secondary" size="sm" onClick={onCreateSamplePack} disabled={saving}>Sample pack</Button>
            <Button type="button" variant="secondary" size="sm" onClick={onSaveTemplate} disabled={!canUseProject}>Save template</Button>
            <ButtonLink variant="secondary" size="sm" to="/alerts/routing">Routing</ButtonLink>
            <ButtonLink variant="ghost" size="sm" to="/themes">Legacy themes</ButtonLink>
          </div>
        </details>
      </div>
    </section>
  );
}
