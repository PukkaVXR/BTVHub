import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { api, type ConfigProfileExport, type IntegrationsInfo, type LocalCommandRequest, type LocalCommandSecurityResponse, type PreflightInfo } from "../api";
import { downloadJsonFile, safeDownloadName } from "../lib/browserDownloads";
import { useToast } from "../hooks/useToast";
import { setupReadinessSteps, type SetupReadinessStep } from "../lib/readiness";
import { readSetupCompleted, writeSetupCompleted } from "../lib/setupCompletion";
import { Button, ButtonAnchor, ButtonLink, Callout, Card, PageHeader } from "../ui";

export default function SetupPage() {
  const [preflight, setPreflight] = useState<PreflightInfo | null>(null);
  const [integrations, setIntegrations] = useState<IntegrationsInfo | null>(null);
  const [localCommands, setLocalCommands] = useState<LocalCommandSecurityResponse | null>(null);
  const [setupCompleted, setSetupCompleted] = useState(() => readSetupCompleted());
  const [celebrating, setCelebrating] = useState(false);
  const toast = useToast();

  const load = () => {
    void Promise.all([api.preflight(), api.integrations(), api.localCommandSecurity()]).then(([p, i, commands]) => {
      setPreflight(p);
      setIntegrations(i);
      setLocalCommands(commands);
    });
  };

  useEffect(() => {
    load();
  }, []);

  const testFollow = async () => {
    await api.testVisualAlert("follow");
    toast("Test visual follow alert sent");
    load();
  };

  const steps = useMemo<SetupReadinessStep[]>(() => setupReadinessSteps(preflight, integrations), [integrations, preflight]);
  const completeCount = steps.filter((step) => step.complete).length;
  const allComplete = steps.length > 0 && steps.every((step) => step.complete);
  const progress = steps.length ? Math.round((completeCount / steps.length) * 100) : 0;
  const nextStep = steps.find((step) => !step.complete);

  const completeSetup = (message?: string) => {
    writeSetupCompleted(true);
    setSetupCompleted(true);
    setCelebrating(true);
    if (message) toast({ message, tone: "success" });
  };

  const markSetupComplete = () => {
    completeSetup("Setup marked complete");
  };

  const jumpToStep = (id: string) => {
    document.getElementById(`setup-step-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const runStepAction = (step: SetupReadinessStep) => {
    if (step.actionId === "test-follow") void testFollow();
    if (step.actionId === "export-backup") void exportConfigBackup();
  };

  const approveCommand = async (command: LocalCommandRequest) => {
    await api.approveLocalCommand({
      command: command.command,
      args: command.args,
      cwd: command.cwd,
      label: `${command.sourceType}: ${command.sourceName}`,
    });
    toast({ message: "Local command approved", tone: "success" });
    load();
  };

  const revokeCommand = async (id: string) => {
    await api.revokeLocalCommand(id);
    toast({ message: "Local command approval revoked", tone: "info" });
    load();
  };

  const exportConfigBackup = async () => {
    try {
      const backup = await api.exportConfigProfile();
      const filename = `${safeDownloadName(`btv-config-${new Date().toISOString().slice(0, 10)}`, "btv-config")}.btv-config.json`;
      downloadJsonFile(filename, backup);
      toast({ message: "Config backup downloaded", tone: "success" });
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not export config backup");
    }
  };

  const importConfigBackup = async (file: File) => {
    try {
      const profile = JSON.parse(await file.text()) as ConfigProfileExport;
      if (!window.confirm("Import this BTV config backup? Current config, alerts, widgets, macros, automations, and webhooks will be replaced.")) return;
      await api.importConfigProfile(profile);
      toast({ message: "Config backup imported", tone: "success" });
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not import config backup");
    }
  };

  useEffect(() => {
    if (allComplete && !setupCompleted) {
      completeSetup("Setup complete. Dashboard is ready to take over.");
    }
  }, [allComplete, setupCompleted]);

  useEffect(() => {
    if (!celebrating) return;
    const timer = window.setTimeout(() => setCelebrating(false), 2600);
    return () => window.clearTimeout(timer);
  }, [celebrating]);

  return (
    <>
      <PageHeader
        title="Setup Wizard"
        description="A quick readiness path for Twitch, OBS, browser sources, and test alerts."
        action={
          <Button type="button" variant={setupCompleted ? "secondary" : "primary"} size="sm" onClick={markSetupComplete}>
            {setupCompleted ? "Setup complete" : "Mark complete"}
          </Button>
        }
      />

      {setupCompleted ? (
        <Callout tone="success" title="Setup is marked complete">
          This keeps Setup tucked away as a Settings page while Dashboard takes over day-to-day readiness.
        </Callout>
      ) : null}

      {celebrating ? (
        <div className="setup-complete-burst" role="status" aria-live="polite">
          <strong>Setup complete</strong>
          <span>Ready for the first real stream run.</span>
        </div>
      ) : null}

      <div className="setup-wizard">
        <Card className="setup-progress-card" hideableId="setup-progress" hideableTitle="Setup Progress">
          <div
            className="setup-progress-ring"
            style={{ "--setup-progress": `${progress}%` } as CSSProperties}
            aria-label={`${progress}% complete`}
          >
            <span>{progress}%</span>
          </div>
          <div>
            <h2>Setup Progress</h2>
            <p>
              {completeCount}/{steps.length} checks complete.
              {nextStep ? ` Next up: ${nextStep.title}.` : " Everything needed for first run is ready."}
            </p>
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={load}>
            Refresh
          </Button>
          <div className="setup-stepper" aria-label="Setup steps">
            {steps.map((step, index) => (
              <button
                type="button"
                className={`setup-stepper__item${step.complete ? " setup-stepper__item--complete" : ""}`}
                key={step.id}
                onClick={() => jumpToStep(step.id)}
              >
                <span>{index + 1}</span>
                <strong>{step.title}</strong>
              </button>
            ))}
          </div>
        </Card>

        <Card className="setup-command-security-card" hideableId="setup-local-command-security" hideableTitle="Local Command Security">
          <div className="setup-step-card__header">
            <span className="setup-step-card__number">!</span>
            <div>
              <h2>Local Command Security</h2>
              <p>
                Macros and effects can only run local commands after the exact command, args, and working directory have been approved here.
              </p>
            </div>
            <span className={localCommands?.requests.some((command) => !command.approved) ? "badge badge-off" : "badge badge-ok"}>
              {localCommands?.requests.some((command) => !command.approved) ? "Review" : "Locked"}
            </span>
          </div>
          {localCommands?.requests.length ? (
            <div className="setup-command-security-list">
              {localCommands.requests.map((command) => (
                <div className="setup-command-security-item" key={`${command.id}-${command.sourceType}-${command.sourceId}`}>
                  <div>
                    <strong>{command.sourceName}</strong>
                    <span>{command.sourceType}</span>
                    <code>{formatCommand(command)}</code>
                    {command.cwd ? <small>cwd: {command.cwd}</small> : null}
                  </div>
                  {command.approved ? (
                    <Button type="button" variant="secondary" size="sm" onClick={() => void revokeCommand(command.id)}>
                      Revoke
                    </Button>
                  ) : (
                    <Button type="button" variant="primary" size="sm" onClick={() => void approveCommand(command)}>
                      Approve
                    </Button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: "var(--color-text-secondary)", fontSize: 13, marginTop: 12 }}>
              No macros or effects currently request local command execution.
            </p>
          )}
          {localCommands?.approvals.length ? (
            <details className="setup-command-approvals">
              <summary>{localCommands.approvals.length} approved command signature(s)</summary>
              <div className="setup-command-security-list">
                {localCommands.approvals.map((approval) => (
                  <div className="setup-command-security-item" key={approval.id}>
                    <div>
                      <strong>{approval.label || approval.command}</strong>
                      <code>{formatCommand(approval)}</code>
                      <small>Approved {new Date(approval.createdAt).toLocaleString()}</small>
                    </div>
                    <Button type="button" variant="secondary" size="sm" onClick={() => void revokeCommand(approval.id)}>
                      Revoke
                    </Button>
                  </div>
                ))}
              </div>
            </details>
          ) : null}
        </Card>

        <Card className="setup-command-security-card" hideableId="setup-backup-restore" hideableTitle="Backup and Restore">
          <div className="setup-step-card__header">
            <span className="setup-step-card__number">7</span>
            <div>
              <h2>Backup and Restore</h2>
              <p>Download a restore-ready BTV config backup, or import one to replace the current local setup.</p>
            </div>
            <span className="badge badge-ok">Ready</span>
          </div>
          <Callout tone="warning" title="Treat backup files as sensitive">
            Config backups include restorable local settings and secrets. Store them like credentials.
          </Callout>
          <div className="actions" style={{ marginTop: 16 }}>
            <Button type="button" variant="secondary" size="sm" onClick={() => void exportConfigBackup()}>
              Download backup
            </Button>
            <label className="ui-button ui-button--secondary ui-button--sm">
              Import backup
              <input
                type="file"
                accept=".json,.btv-config.json,application/json"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) void importConfigBackup(file);
                }}
              />
            </label>
          </div>
        </Card>

        <div className="setup-step-list">
          {steps.map((step, index) => (
            <Card
              key={step.id}
              hideableId={`setup-step-${step.id}`}
              hideableTitle={step.title}
              id={`setup-step-${step.id}`}
              className={`setup-step-card${step.complete ? " setup-step-card--complete" : ""}`}
            >
              <div className="setup-step-card__header">
                <span className="setup-step-card__number">{index + 1}</span>
                <div>
                  <h2>{step.title}</h2>
                  <p>{step.detail}</p>
                </div>
                <span className={step.complete ? "badge badge-ok" : "badge badge-off"}>
                  {step.complete ? "Done" : "Todo"}
                </span>
              </div>
              <div className="setup-step-card__action">
                {step.actionTo?.startsWith("/api/") ? (
                  <ButtonAnchor variant="secondary" size="sm" href={step.actionTo}>
                    {step.actionLabel}
                  </ButtonAnchor>
                ) : step.actionTo ? (
                  <ButtonLink variant="secondary" size="sm" to={step.actionTo}>
                    {step.actionLabel}
                  </ButtonLink>
                ) : (
                  <Button type="button" variant="primary" size="sm" onClick={() => runStepAction(step)}>
                    {step.actionLabel}
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </>
  );
}

function formatCommand(command: { command: string; args?: string[] }): string {
  return [command.command, ...(command.args ?? [])].join(" ");
}
