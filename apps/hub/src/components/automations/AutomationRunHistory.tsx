import type { AutomationRule, AutomationRun } from "../../api";

type AutomationRunHistoryProps = {
  rules: AutomationRule[];
  runs: AutomationRun[];
};

export function AutomationRunHistory({ rules, runs }: AutomationRunHistoryProps) {
  const ruleNames = new Map(rules.map((rule) => [rule.id, rule.name]));

  return (
    <div className="card">
      <h2>Automation run history</h2>
      <table className="table">
        <thead>
          <tr>
            <th>Time</th>
            <th>Rule</th>
            <th>Status</th>
            <th>Message</th>
            <th>Event</th>
          </tr>
        </thead>
        <tbody>
          {runs.slice(0, 25).map((run) => (
            <tr key={run.id}>
              <td>{new Date(run.created_at).toLocaleString()}</td>
              <td>{ruleNames.get(run.rule_id) ?? run.rule_id}</td>
              <td>{run.status}</td>
              <td>{run.message}</td>
              <td>{run.event_id ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!runs.length && <p style={{ color: "var(--muted)", padding: 12 }}>No automation runs yet.</p>}
    </div>
  );
}
