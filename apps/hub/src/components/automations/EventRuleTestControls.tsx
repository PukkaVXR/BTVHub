import type { AutomationRule } from "../../api";
import { Callout } from "../../ui";

type RuleTestResult = { tone: "success" | "danger"; message: string } | null;

type EventRuleTestControlsProps = {
  rule: AutomationRule;
  result: RuleTestResult;
  testEventJson: string;
  onTestEventJsonChange: (value: string) => void;
  onTest: (rule: AutomationRule) => void;
  onSave: () => void;
  onCancel: () => void;
  onRun: (rule: AutomationRule) => void;
  onDelete: (id: string) => void;
};

export function EventRuleTestControls({
  rule,
  result,
  testEventJson,
  onTestEventJsonChange,
  onTest,
  onSave,
  onCancel,
  onRun,
  onDelete,
}: EventRuleTestControlsProps) {
  return (
    <>
      <div className="automation-builder-step">
        <strong>4. Test & save</strong>
        <span>Run this rule with the current payload, then save when it behaves correctly.</span>
      </div>
      {result && (
        <Callout tone={result.tone} title={result.tone === "success" ? "Rule test passed" : "Rule test failed"}>
          {result.message}
        </Callout>
      )}
      <div className="actions">
        <button type="button" className="ui-button ui-button--primary ui-button--sm" onClick={() => onTest(rule)}>Test rule</button>
        <button type="button" className="ui-button ui-button--secondary ui-button--sm" onClick={onSave}>Save rule</button>
        <button type="button" className="ui-button ui-button--secondary ui-button--sm" onClick={onCancel}>Cancel</button>
        <button type="button" className="ui-button ui-button--secondary ui-button--sm" onClick={() => onRun(rule)}>Run now</button>
        <button type="button" className="ui-button ui-button--danger ui-button--sm" onClick={() => onDelete(rule.id)}>Delete rule</button>
      </div>

      <details className="alert-compact-section automation-advanced-payload">
        <summary>Advanced test payload JSON</summary>
        <div className="form-row" style={{ marginTop: 12 }}>
          <label>Test event payload</label>
          <textarea
            rows={8}
            value={testEventJson}
            onChange={(event) => onTestEventJsonChange(event.target.value)}
            style={{ fontFamily: "monospace", lineHeight: 1.45 }}
          />
        </div>
      </details>
    </>
  );
}
