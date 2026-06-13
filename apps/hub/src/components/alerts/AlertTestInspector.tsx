import type { AlertLayer, AlertProject, AlertVariation, StreamEventType } from "@btv/shared";

type AudioLayer = Extract<AlertLayer, { type: "audio" }>;

type AlertTestInspectorProps = {
  project: AlertProject;
  eventTypes: StreamEventType[];
  selectedVariationId: string;
  selectedVariation: AlertVariation | null;
  audioLayer: AudioLayer | null;
  payloadJson: string;
  payloadError: string;
  saving: boolean;
  onTestEvent: (eventType: StreamEventType, variationId?: string) => void;
  onVariationChange: (variationId: string) => void;
  onTestAudio: (layer: AudioLayer) => void;
  onPayloadJsonChange: (payloadJson: string) => void;
};

export function AlertTestInspector({
  project,
  eventTypes,
  selectedVariationId,
  selectedVariation,
  audioLayer,
  payloadJson,
  payloadError,
  saving,
  onTestEvent,
  onVariationChange,
  onTestAudio,
  onPayloadJsonChange,
}: AlertTestInspectorProps) {
  const testingDisabled = saving || Boolean(payloadError);

  return (
    <div className="alert-test-panel">
      <details open className="alert-inspector-section">
        <summary>Test Event</summary>
        <p className="subtitle">Fire this project into OBS using the selected payload. Invalid JSON disables the test buttons.</p>
        <div className="alert-routing-test-grid">
          {eventTypes.map((type) => (
            <button
              key={type}
              type="button"
              className={`ui-button ui-button--sm ${project.eventType === type ? "ui-button--primary" : "ui-button--secondary"}`}
              onClick={() => onTestEvent(type)}
              disabled={testingDisabled}
            >
              Test {type}
            </button>
          ))}
        </div>
      </details>
      <details open className="alert-inspector-section">
        <summary>Variation, Chaos & Audio</summary>
        <div className="alert-test-flow-grid">
          <div>
            <label>Variation</label>
            <select value={selectedVariationId} onChange={(event) => onVariationChange(event.target.value)}>
              <option value="">Base project</option>
              {project.variations.map((variation) => (
                <option key={variation.id} value={variation.id}>
                  {variation.name}{variation.enabled ? "" : " (disabled)"}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className="ui-button ui-button--secondary ui-button--sm"
            onClick={() => selectedVariation && onTestEvent(selectedVariation.condition.eventType ?? project.eventType, selectedVariation.id)}
            disabled={testingDisabled || !selectedVariation}
          >
            Test selected variation
          </button>
          <span className={`alert-test-state ${project.chaos.enabled ? "enabled" : ""}`}>
            Chaos {project.chaos.enabled ? `on (${Math.round(project.chaos.intensity * 100)}%)` : "off"}
          </span>
          <button
            type="button"
            className="ui-button ui-button--secondary ui-button--sm"
            onClick={() => audioLayer && onTestAudio(audioLayer)}
            disabled={!audioLayer?.assetUrl || Boolean(audioLayer?.muted)}
          >
            Test audio layer
          </button>
        </div>
        <p className="subtitle">
          {audioLayer
            ? `Audio target: ${audioLayer.name}${audioLayer.muted ? " (muted)" : ""}`
            : "Add an audio layer to test sound playback from this panel."}
        </p>
      </details>
      <details open className="alert-inspector-section">
        <summary>Payload JSON</summary>
        <div className="form-row">
          <textarea
            rows={12}
            value={payloadJson}
            onChange={(event) => onPayloadJsonChange(event.target.value)}
            spellCheck={false}
          />
          <p className={payloadError ? "form-error" : "subtitle"}>
            {payloadError
              ? `Invalid JSON: ${payloadError}`
              : (
                <>
                  Template variables: <code>{"{user}"}</code>, <code>{"{login}"}</code>, <code>{"{event}"}</code>, <code>{"{amount}"}</code>, <code>{"{message}"}</code>, <code>{"{payload.rewardTitle}"}</code>.
                </>
              )}
          </p>
        </div>
      </details>
    </div>
  );
}
