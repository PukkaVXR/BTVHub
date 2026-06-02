import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { api, type IntegrationsInfo, type PreflightInfo } from "../api";
import { useToast } from "../hooks/useToast";
import { setupReadinessSteps, type SetupReadinessStep } from "../lib/readiness";
import { readSetupCompleted, writeSetupCompleted } from "../lib/setupCompletion";
import { Button, ButtonAnchor, ButtonLink, Callout, Card, PageHeader } from "../ui";

export default function SetupPage() {
  const [preflight, setPreflight] = useState<PreflightInfo | null>(null);
  const [integrations, setIntegrations] = useState<IntegrationsInfo | null>(null);
  const [setupCompleted, setSetupCompleted] = useState(() => readSetupCompleted());
  const [celebrating, setCelebrating] = useState(false);
  const toast = useToast();

  const load = () => {
    void Promise.all([api.preflight(), api.integrations()]).then(([p, i]) => {
      setPreflight(p);
      setIntegrations(i);
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
        <Card className="setup-progress-card">
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

        <div className="setup-step-list">
          {steps.map((step, index) => (
            <Card
              key={step.id}
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
