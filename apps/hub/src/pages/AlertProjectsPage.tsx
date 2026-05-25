import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { AlertProject } from "@btv/shared";
import { api } from "../api";
import { Card, CardHeader, EmptyState, PageHeader, StatusPill } from "../ui";

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

export default function AlertProjectsPage() {
  const [projects, setProjects] = useState<AlertProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  return (
    <>
      <PageHeader
        title="Alert Projects"
        description="Choose a cinematic alert to edit, or jump into routing to decide when each alert fires."
        action={<Link className="btn btn-secondary btn-sm" to="/alerts/routing">Routing</Link>}
      />

      {error ? (
        <Card>
          <StatusPill tone="danger" label="Could not load alerts" detail={error} />
        </Card>
      ) : null}

      {loading ? (
        <Card>
          <CardHeader title="Loading alert projects" description="Checking your visual alert library..." />
        </Card>
      ) : null}

      {!loading && !sortedProjects.length ? (
        <EmptyState
          title="No alert projects yet"
          description="Open the editor from an alert test or import/migrate alerts to start building."
          action={<Link className="btn btn-primary btn-sm" to="/alerts/routing">Go to routing</Link>}
        />
      ) : null}

      {!loading && sortedProjects.length ? (
        <div className="alert-project-list">
          {sortedProjects.map((project) => (
            <Card key={project.id} className="alert-project-card">
              <CardHeader
                title={project.name}
                description={`${project.eventType} • ${project.durationMs}ms • ${project.layers.length} layer${project.layers.length === 1 ? "" : "s"}`}
                action={<Link className="btn btn-primary btn-sm" to={`/alerts/${encodeURIComponent(project.id)}`}>Open editor</Link>}
              />
              <div className="alert-project-card__meta">
                <span>Updated {formatUpdated(project.updatedAt)}</span>
                <span>{project.canvas.width}x{project.canvas.height}</span>
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
