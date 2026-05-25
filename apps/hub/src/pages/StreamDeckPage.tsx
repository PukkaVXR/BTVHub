import { Link } from "react-router-dom";
import { Card, CardHeader, EmptyState, PageHeader } from "../ui";

const STREAM_DECK_ACTIONS = [
  { label: "Run macro", method: "POST", path: "/api/actions/macro/:macroId" },
  { label: "Apply source group", method: "POST", path: "/api/actions/source-group/:groupId" },
  { label: "Switch OBS scene", method: "POST", path: "/api/actions/obs/scene" },
  { label: "Toggle OBS source", method: "POST", path: "/api/actions/obs/source-visibility" },
  { label: "Move OBS source", method: "POST", path: "/api/actions/obs/source-motion" },
  { label: "Update OBS text", method: "POST", path: "/api/actions/obs/text" },
  { label: "Status check", method: "GET", path: "/api/stream-deck/status" },
];

export default function StreamDeckPage() {
  return (
    <>
      <PageHeader
        title="Stream Deck"
        description="Dedicated home for Stream Deck actions, API Ninja requests, and live control shortcuts."
      />

      <Card>
        <CardHeader
          title="Action endpoints"
          description="Use these endpoints in Stream Deck plugins or API Ninja buttons. The full request builder is still available on Dashboard while this page is being expanded."
          action={<Link className="btn btn-primary btn-sm" to="/">Open dashboard builder</Link>}
        />
        <div className="stream-deck-endpoints">
          {STREAM_DECK_ACTIONS.map((action) => (
            <div className="stream-deck-endpoint" key={action.path}>
              <span>{action.label}</span>
              <code>{action.method}</code>
              <code>{action.path}</code>
            </div>
          ))}
        </div>
      </Card>

      <EmptyState
        title="Builder migration in progress"
        description="This route is now part of the new shell, so the Dashboard can be slimmed down in a later pass without breaking navigation."
        action={<Link className="btn btn-secondary btn-sm" to="/macros">Manage macros</Link>}
      />
    </>
  );
}
