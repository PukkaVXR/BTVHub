import { StreamDeckRequestBuilder } from "../components/streamDeck";
import { ButtonAnchor, ButtonLink, Card, CardHeader, CopyField, EmptyState, PageHeader } from "../ui";

const STREAM_DECK_BASE_URL = "http://127.0.0.1:4782";

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
        action={
          <ButtonAnchor variant="secondary" size="sm" href="/tutorials/stream-deck-setup.md" target="_blank" rel="noreferrer">
            Open setup tutorial
          </ButtonAnchor>
        }
      />

      <Card>
        <CardHeader
          title="Action endpoints"
          description="Use these endpoints in Stream Deck plugins or API Ninja buttons."
          action={<ButtonLink variant="secondary" size="sm" to="/">Back to dashboard</ButtonLink>}
        />
        <div className="stream-deck-endpoints">
          {STREAM_DECK_ACTIONS.map((action) => (
            <div className="stream-deck-endpoint" key={action.path}>
              <div>
                <span>{action.label}</span>
                <small>{action.method}</small>
              </div>
              <CopyField label="Endpoint URL" value={`${STREAM_DECK_BASE_URL}${action.path}`} />
            </div>
          ))}
        </div>
      </Card>

      <StreamDeckRequestBuilder />

      <EmptyState
        title="Want more shortcuts?"
        description="Macros and activity layouts become selectable Stream Deck actions as soon as you create them."
        action={<ButtonLink variant="secondary" size="sm" to="/macros">Manage macros</ButtonLink>}
      />
    </>
  );
}
