import type { AutomationCondition } from "../../api";

type EventRuleConditionsEditorProps = {
  conditions: AutomationCondition[];
  onChange: (conditions: AutomationCondition[]) => void;
};

function conditionTemplate(type: AutomationCondition["type"]): AutomationCondition {
  switch (type) {
    case "min_amount":
      return { type, amount: 1 };
    case "message_includes":
      return { type, text: "hello" };
    case "user_role":
      return { type, role: "moderator" };
    case "variable_compare":
      return { type, name: "counter", operator: "exists" };
    default:
      return { type: "min_amount", amount: 1 };
  }
}

export function EventRuleConditionsEditor({ conditions, onChange }: EventRuleConditionsEditorProps) {
  const updateCondition = (index: number, condition: AutomationCondition) => {
    const next = [...conditions];
    next[index] = condition;
    onChange(next);
  };

  return (
    <>
      <div className="automation-builder-step">
        <strong>2. Conditions</strong>
        <span>Optional gates that must pass before actions run.</span>
      </div>
      {conditions.map((condition, index) => (
        <div className="card" key={`${condition.type}-${index}`} style={{ marginBottom: 12 }}>
          <div className="grid">
            <div>
              <label>Condition</label>
              <select
                value={condition.type}
                onChange={(event) => updateCondition(index, conditionTemplate(event.target.value as AutomationCondition["type"]))}
              >
                <option value="min_amount">Minimum amount</option>
                <option value="message_includes">Message includes</option>
                <option value="user_role">User role</option>
                <option value="variable_compare">Variable compare</option>
              </select>
            </div>
            {condition.type === "min_amount" && (
              <div>
                <label>Amount</label>
                <input
                  type="number"
                  value={condition.amount}
                  onChange={(event) => updateCondition(index, { type: "min_amount", amount: Number(event.target.value) })}
                />
              </div>
            )}
            {condition.type === "message_includes" && (
              <div>
                <label>Text</label>
                <input
                  value={condition.text}
                  onChange={(event) => updateCondition(index, { type: "message_includes", text: event.target.value })}
                />
              </div>
            )}
            {condition.type === "user_role" && (
              <div>
                <label>Role</label>
                <select
                  value={condition.role}
                  onChange={(event) => updateCondition(index, {
                    type: "user_role",
                    role: event.target.value as Extract<AutomationCondition, { type: "user_role" }>["role"],
                  })}
                >
                  <option value="moderator">Moderator</option>
                  <option value="broadcaster">Broadcaster</option>
                  <option value="subscriber">Subscriber</option>
                  <option value="vip">VIP</option>
                </select>
              </div>
            )}
            {condition.type === "variable_compare" && (
              <>
                <div>
                  <label>Variable</label>
                  <input value={condition.name} onChange={(event) => updateCondition(index, { ...condition, name: event.target.value })} />
                </div>
                <div>
                  <label>Operator</label>
                  <select
                    value={condition.operator}
                    onChange={(event) => updateCondition(index, { ...condition, operator: event.target.value as typeof condition.operator })}
                  >
                    <option value="exists">Exists</option>
                    <option value="equals">Equals</option>
                    <option value="not_equals">Not equals</option>
                    <option value="greater_than">Greater than</option>
                    <option value="less_than">Less than</option>
                  </select>
                </div>
                <div>
                  <label>Value</label>
                  <input
                    value={String(condition.value ?? "")}
                    onChange={(event) => updateCondition(index, { ...condition, value: event.target.value })}
                  />
                </div>
              </>
            )}
          </div>
          <button
            type="button"
            className="ui-button ui-button--danger ui-button--sm"
            onClick={() => onChange(conditions.filter((_, conditionIndex) => conditionIndex !== index))}
          >
            Remove condition
          </button>
        </div>
      ))}
      <button
        type="button"
        className="ui-button ui-button--secondary ui-button--sm"
        style={{ marginBottom: 16 }}
        onClick={() => onChange([...conditions, conditionTemplate("min_amount")])}
      >
        Add condition
      </button>
    </>
  );
}
