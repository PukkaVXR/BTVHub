import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { AlertLayer, AlertProject } from "@btv/shared";
import { api } from "../api";
import { AlertsSectionTabs } from "../components/alerts/AlertsSectionTabs";
import { Button, ButtonLink, Card, CardHeader, EmptyState, PageHeader, StatusPill } from "../ui";

function formatUpdated(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function nowIso() {
  return new Date().toISOString();
}

function newId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function createStarterProject(): AlertProject {
  const now = nowIso();
  const layers: AlertLayer[] = [
    {
      id: newId("shape"),
      type: "shape",
      name: "Alert card",
      visible: true,
      locked: false,
      startMs: 0,
      endMs: 5000,
      x: 620,
      y: 390,
      width: 680,
      height: 250,
      rotation: 0,
      opacity: 1,
      scale: 1,
      blendMode: "normal",
      keyframes: [],
      shape: "rectangle",
      fill: "rgba(91, 140, 255, 0.86)",
      borderColor: "rgba(255,255,255,0.18)",
      borderWidth: 2,
      radius: 24,
    },
    {
      id: newId("text"),
      type: "text",
      name: "Title",
      visible: true,
      locked: false,
      startMs: 0,
      endMs: 5000,
      x: 690,
      y: 460,
      width: 540,
      height: 80,
      rotation: 0,
      opacity: 1,
      scale: 1,
      blendMode: "normal",
      keyframes: [],
      text: "{user}",
      fontFamily: "Inter, Segoe UI, sans-serif",
      fontSize: 64,
      fontWeight: 900,
      color: "#ffffff",
      align: "center",
      strokeWidth: 0,
    },
    {
      id: newId("text"),
      type: "text",
      name: "Subtitle",
      visible: true,
      locked: false,
      startMs: 250,
      endMs: 5000,
      x: 720,
      y: 545,
      width: 480,
      height: 52,
      rotation: 0,
      opacity: 0.92,
      scale: 1,
      blendMode: "normal",
      keyframes: [],
      text: "Thanks for the {event}!",
      fontFamily: "Inter, Segoe UI, sans-serif",
      fontSize: 30,
      fontWeight: 750,
      color: "#dbe6ff",
      align: "center",
      strokeWidth: 0,
    },
  ];

  return {
    id: newId("alert"),
    name: "New cinematic alert",
    eventType: "follow",
    durationMs: 5000,
    timeline: {
      durationMs: 5000,
      fps: 60,
      snapMs: 100,
      zoom: 1,
    },
    canvas: {
      width: 1920,
      height: 1080,
      background: "transparent",
      backgroundColor: "transparent",
    },
    layers,
    variations: [],
    chaos: {
      enabled: false,
      intensity: 0.35,
      modifiers: ["shake", "flash", "hue_shift", "scale_punch"],
      legendaryBoost: 0,
    },
    safeMode: false,
    tags: ["visual-editor"],
    createdAt: now,
    updatedAt: now,
  };
}

function cloneProject(project: AlertProject): AlertProject {
  const now = nowIso();
  return {
    ...project,
    id: newId("alert"),
    name: `${project.name} copy`,
    layers: project.layers.map((layer) => ({ ...layer, id: newId(layer.type) }) as AlertLayer),
    variations: project.variations.map((variation) => ({
      ...variation,
      id: newId("variation"),
      layers: variation.layers.map((layer) => ({ ...layer, id: newId(layer.type) }) as AlertLayer),
    })),
    tags: [...new Set([...(project.tags ?? []), "copy"])],
    createdAt: now,
    updatedAt: now,
  };
}

export default function AlertProjectsPage() {
  const [projects, setProjects] = useState<AlertProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyProjectId, setBusyProjectId] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    setLoading(true);
    void api
      .alertProjects()
      .then((items) => {
        if (!active) return;
        setProjects(items);
        setError("");
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Could not load alert projects");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const sortedProjects = useMemo(
    () => [...projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [projects],
  );

  const createProject = async () => {
    const next = createStarterProject();
    setBusyProjectId(next.id);
    try {
      await api.saveAlertProject(next);
      setProjects((current) => [next, ...current]);
      navigate(`/alerts/${encodeURIComponent(next.id)}`);
    } finally {
      setBusyProjectId("");
    }
  };

  const duplicateProject = async (project: AlertProject) => {
    const next = cloneProject(project);
    setBusyProjectId(project.id);
    try {
      await api.saveAlertProject(next);
      setProjects((current) => [next, ...current]);
      navigate(`/alerts/${encodeURIComponent(next.id)}`);
    } finally {
      setBusyProjectId("");
    }
  };

  const deleteProject = async (project: AlertProject) => {
    if (!window.confirm(`Delete alert project "${project.name}"?`)) return;
    setBusyProjectId(project.id);
    try {
      await api.deleteAlertProject(project.id);
      setProjects((current) => current.filter((item) => item.id !== project.id));
    } finally {
      setBusyProjectId("");
    }
  };

  return (
    <>
      <PageHeader
        title="Alert Projects"
        description="Choose a cinematic alert to edit, or jump into routing to decide when each alert fires."
        action={
          <div className="alert-project-header-actions">
            <Button type="button" variant="primary" size="sm" onClick={() => void createProject()}>
              New project
            </Button>
            <ButtonLink variant="secondary" size="sm" to="/alerts/routing">Routing</ButtonLink>
          </div>
        }
      />
      <AlertsSectionTabs />

      {error ? (
        <Card hideableId="load-error" hideableTitle="Load Error">
          <StatusPill tone="danger" label="Could not load alerts" detail={error} />
        </Card>
      ) : null}

      {loading ? (
        <Card hideableId="loading-projects" hideableTitle="Loading Projects">
          <CardHeader title="Loading alert projects" description="Checking your visual alert library..." />
        </Card>
      ) : null}

      {!loading && !sortedProjects.length ? (
        <EmptyState
          title="No alert projects yet"
          description="Create a starter project, then shape it in the visual editor."
          action={
            <div className="alert-project-header-actions">
              <Button type="button" variant="primary" size="sm" onClick={() => void createProject()}>
                New project
              </Button>
              <ButtonLink variant="secondary" size="sm" to="/alerts/routing">Go to routing</ButtonLink>
            </div>
          }
        />
      ) : null}

      {!loading && sortedProjects.length ? (
        <div className="alert-project-list">
          {sortedProjects.map((project) => (
            <Card key={project.id} className="alert-project-card" hideableId={`project-${project.id}`} hideableTitle={project.name}>
              <CardHeader
                title={project.name}
                description={`${project.eventType} - ${project.durationMs}ms - ${project.layers.length} layer${project.layers.length === 1 ? "" : "s"}`}
                action={
                  <div className="alert-project-card__actions">
                    <ButtonLink variant="primary" size="sm" to={`/alerts/${encodeURIComponent(project.id)}`}>Open editor</ButtonLink>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={busyProjectId === project.id}
                      onClick={() => void duplicateProject(project)}
                    >
                      Duplicate
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      disabled={busyProjectId === project.id}
                      onClick={() => void deleteProject(project)}
                    >
                      Delete
                    </Button>
                  </div>
                }
              />
              <div className="alert-project-card__meta">
                <span>Updated {formatUpdated(project.updatedAt)}</span>
                <span>{project.canvas.width}x{project.canvas.height}</span>
                <span>{project.eventType}</span>
                {project.tags.slice(0, 3).map((tag) => <span key={tag}>{tag}</span>)}
                {project.variations.length ? <span>{project.variations.length} variation{project.variations.length === 1 ? "" : "s"}</span> : null}
                {project.chaos.enabled ? <span>Chaos enabled</span> : null}
              </div>
            </Card>
          ))}
        </div>
      ) : null}
    </>
  );
}
