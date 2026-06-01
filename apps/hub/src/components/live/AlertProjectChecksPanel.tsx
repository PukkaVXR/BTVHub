import type { PreflightInfo } from "../../api";
import { ButtonLink, Card, CardHeader } from "../../ui";

interface AlertProjectChecksPanelProps {
  preflight: PreflightInfo | null;
}

export function AlertProjectChecksPanel({ preflight }: AlertProjectChecksPanelProps) {
  const projects = preflight?.alertProjects.projects ?? [];
  if (!projects.length || !preflight) return null;

  return (
    <Card>
      <CardHeader
        title="Alert Project Checks"
        action={
          <span className={preflight.alertProjects.errors ? "badge badge-off" : "badge"}>
            {preflight.alertProjects.errors} broken / {preflight.alertProjects.warnings} warning
            {preflight.alertProjects.warnings === 1 ? "" : "s"}
          </span>
        }
      />
      <table className="table live-panel-table">
        <thead>
          <tr>
            <th>Project</th>
            <th>Event</th>
            <th>Issue</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {projects.slice(0, 6).map((project) => (
            <tr key={project.id}>
              <td>{project.name}</td>
              <td>{project.eventType}</td>
              <td>{project.issues[0]?.message ?? `${project.errors} error(s), ${project.warnings} warning(s)`}</td>
              <td>
                <ButtonLink variant="secondary" size="sm" to={`/alerts/${encodeURIComponent(project.id)}`}>
                  Open
                </ButtonLink>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {projects.length > 6 ? (
        <p className="live-muted-copy">{projects.length - 6} more project(s) have checks hidden.</p>
      ) : null}
    </Card>
  );
}
