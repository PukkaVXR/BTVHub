import type { ApiNinjaButtonInput } from "../../lib/apiNinja";
import { Button, CopyField } from "../../ui";
import type { StreamDeckGeneratedRequest } from "./streamDeckBuilderTypes";

type Props = {
  request: StreamDeckGeneratedRequest;
  exportInput: ApiNinjaButtonInput;
  apiNinjaConfig: string;
  testResult: { ok: boolean; message: string } | null;
  copiedMessage: string | null;
  onExportAction: (input: ApiNinjaButtonInput) => void;
  onExportNinja: (input: ApiNinjaButtonInput) => void;
  onCopyConfig: (config: string) => void;
  onTest: () => void;
};

export function StreamDeckExportPanel({
  request,
  exportInput,
  apiNinjaConfig,
  testResult,
  copiedMessage,
  onExportAction,
  onExportNinja,
  onCopyConfig,
  onTest,
}: Props) {
  return (
    <section className="stream-deck-builder-panel stream-deck-builder-panel--output">
      <div className="stream-deck-builder-panel__header">
        <span>4</span>
        <div>
          <strong>Export and test</strong>
          <small>Use full actions for visual imports, or `.ninja` for API Ninja-only imports.</small>
        </div>
      </div>

      <div className="stream-deck-export-grid">
        <Button type="button" variant="primary" size="sm" onClick={() => onExportAction(exportInput)}>
          Export Stream Deck action
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={() => onExportNinja(exportInput)}>
          Export .ninja
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={() => onCopyConfig(apiNinjaConfig)}>
          Copy config
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={onTest}>
          Test now
        </Button>
      </div>

      {testResult ? (
        <div className={`stream-deck-test-result ${testResult.ok ? "stream-deck-test-result--ok" : "stream-deck-test-result--bad"}`}>
          {testResult.ok ? "Success" : "Needs attention"}: {testResult.message}
        </div>
      ) : null}

      {copiedMessage ? <div className="stream-deck-test-result stream-deck-test-result--ok">{copiedMessage}</div> : null}

      <CopyField label="Action URL" value={request.url} />
      <div className="stream-deck-builder__meta">
        <div>
          <label>Method</label>
          <input value={request.method} readOnly />
        </div>
        <div>
          <label>Content-Type</label>
          <input value={request.headers["Content-Type"] ?? ""} readOnly placeholder="None" />
        </div>
      </div>
      <label>
        Request body
        <textarea className="stream-deck-builder__body" rows={8} value={request.body} readOnly placeholder="No body for this request" />
      </label>

      {request.notes.length ? (
        <div className="stream-deck-builder-notes">
          {request.notes.map((note) => <p key={note}>{note}</p>)}
        </div>
      ) : null}
    </section>
  );
}
