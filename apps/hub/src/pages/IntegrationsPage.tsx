import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, type IntegrationsInfo } from "../api";
import { useToast } from "../hooks/useToast";
import {
  Button,
  ButtonAnchor,
  Callout,
  Card,
  CardHeader,
  CopyField,
  FormField,
  PageHeader,
  StatusPill,
} from "../ui";

function secretHint(configured?: boolean) {
  return configured ? "Configured. Leave blank to keep the existing secret." : "Not configured yet.";
}

export default function IntegrationsPage() {
  const [info, setInfo] = useState<IntegrationsInfo | null>(null);
  const [twitchId, setTwitchId] = useState("");
  const [twitchSecret, setTwitchSecret] = useState("");
  const [oauthHost, setOauthHost] = useState("127.0.0.1");
  const [spotifyId, setSpotifyId] = useState("");
  const [spotifySecret, setSpotifySecret] = useState("");
  const [giphyKey, setGiphyKey] = useState("");
  const [obsHost, setObsHost] = useState("127.0.0.1");
  const [obsPort, setObsPort] = useState(4455);
  const [obsPassword, setObsPassword] = useState("");
  const toast = useToast();
  const [searchParams] = useSearchParams();

  const load = () =>
    api.integrations().then((data) => {
      setInfo(data);
      setOauthHost(data.oauthHost ?? "127.0.0.1");
      setTwitchId(data.twitch.clientId ?? "");
      setTwitchSecret("");
      setSpotifyId(data.spotify.clientId ?? "");
      setSpotifySecret("");
      setGiphyKey("");
      setObsHost(data.obs.host);
      setObsPort(data.obs.port);
      setObsPassword("");
    });

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    const twitchError = searchParams.get("twitch_error");
    const desc = searchParams.get("desc");
    if (twitchError === "redirect_mismatch") {
      toast("Twitch redirect URI mismatch. Register the exact HTTPS URL shown below.");
    } else if (twitchError) {
      toast(`Twitch error: ${desc ?? twitchError}`);
    } else if (searchParams.get("twitch") === "connected") {
      toast("Twitch connected");
    }

    const spotifyError = searchParams.get("spotify_error");
    if (spotifyError) {
      toast(decodeURIComponent(spotifyError));
    } else if (searchParams.get("spotify") === "connected") {
      toast("Spotify connected");
    }
  }, [searchParams, toast]);

  const twitchAuthUrl = info?.twitch.authStartUrl ?? "https://127.0.0.1:4783/auth/twitch";
  const oauthOrigin =
    info?.twitch.redirectUri?.replace(/\/auth\/twitch\/callback$/, "") ?? "https://127.0.0.1:4783";
  const chatStatus = info?.twitch.chat;
  const chatSubError = chatStatus?.status === "error";
  const twitchRedirectMismatch = searchParams.get("twitch_error") === "redirect_mismatch";

  const serviceSummary = useMemo(
    () => [
      {
        label: "Twitch",
        connected: Boolean(info?.twitch.connected),
        detail: info?.twitch.connected
          ? info?.twitch.displayName ?? info?.twitch.login ?? "Connected"
          : info?.twitch.configured
            ? "Credentials saved"
            : "Needs credentials",
      },
      {
        label: "Twitch Chat",
        connected: Boolean(chatStatus?.connected),
        detail: chatStatus?.connected
          ? "Live messages"
          : chatStatus?.status === "error"
            ? "Needs reconnect"
            : info?.twitch.connected
              ? "Pending"
              : "Offline",
      },
      {
        label: "OBS",
        connected: Boolean(info?.obs.connected),
        detail: info?.obs.connected ? `${info?.obs.host}:${info?.obs.port}` : info?.obs.hasPassword ? "Saved" : "Needs password",
      },
      {
        label: "Spotify",
        connected: Boolean(info?.spotify.connected),
        detail: info?.spotify.connected ? "Connected" : info?.spotify.configured ? "Credentials saved" : "Optional",
      },
      {
        label: "GIPHY",
        connected: Boolean(info?.giphy?.configured),
        detail: info?.giphy?.configured ? "Key saved" : "Optional",
      },
    ],
    [info],
  );

  return (
    <>
      <PageHeader title="Integrations" description="Connect Twitch, OBS WebSocket, Spotify, and GIPHY from one calm control room." />

      <div className="integrations-summary">
        {serviceSummary.map((service) => (
          <StatusPill
            key={service.label}
            tone={service.connected ? "success" : service.label === "Spotify" || service.label === "GIPHY" ? "neutral" : "warning"}
            label={service.label}
            detail={service.detail}
          />
        ))}
      </div>

      <div className="integrations-callouts">
        <Callout tone="info" title="Local HTTPS is required for Twitch">
          OAuth uses HTTPS on port <strong>4783</strong>. Before connecting Twitch, open{" "}
          <a href={oauthOrigin} target="_blank" rel="noreferrer">
            {oauthOrigin}
          </a>{" "}
          and accept the local certificate warning. Overlay browser sources still use HTTP on port 4782.
        </Callout>

        {info?.twitch.connected && chatSubError ? (
          <Callout tone="danger" title="Chat EventSub failed">
            Status: <code>{chatStatus?.detail ?? info.twitch.eventsubStatus}</code>. Disconnect Twitch, then connect again so OAuth includes{" "}
            <code>user:read:chat</code>, which is required for live chat in OBS.
          </Callout>
        ) : null}

        {info?.twitch.connected && !chatStatus?.connected && !chatSubError ? (
          <Callout tone="warning" title="Chat subscription pending">
            {chatStatus?.detail ?? info.twitch.eventsubStatus ?? "Waiting for EventSub chat subscription"}
          </Callout>
        ) : null}

        {twitchRedirectMismatch ? (
          <Callout tone="danger" title="Twitch redirect URI mismatch">
            Twitch requires the exact HTTPS redirect URL shown in the Twitch card. <code>127.0.0.1</code> and{" "}
            <code>localhost</code> are different hosts, so they must match the OAuth host below.
          </Callout>
        ) : null}
      </div>

      <div className="integrations-grid">
        <Card className="integration-card integration-card--twitch" hideableId="twitch" hideableTitle="Twitch">
          <CardHeader
            title="Twitch"
            description="OAuth, EventSub, chat identity, channel events, and live chat support."
            action={
              <StatusPill
                tone={info?.twitch.connected ? "success" : info?.twitch.configured ? "warning" : "danger"}
                label={info?.twitch.connected ? "Connected" : info?.twitch.configured ? "Ready" : "Not configured"}
                detail={info?.twitch.connected ? info?.twitch.displayName ?? info?.twitch.login : undefined}
              />
            }
          />

          <div className="integration-card__body">
            <FormField label="OAuth host" hint="Must match the host registered in Twitch Developer Console.">
              <select value={oauthHost} onChange={(e) => setOauthHost(e.target.value)}>
                <option value="127.0.0.1">127.0.0.1</option>
                <option value="localhost">localhost</option>
              </select>
            </FormField>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={async () => {
                await api.saveOAuthHost(oauthHost);
                toast("OAuth host saved. Update Twitch console if the URI changed.");
                void load();
              }}
            >
              Apply host
            </Button>

            <CopyField label="Twitch OAuth redirect URI" value={info?.twitch.redirectUri ?? ""} />

            <div className="integration-chat-status" aria-label="Twitch chat readiness">
              <StatusPill
                tone={chatStatus?.connected ? "success" : info?.twitch.connected ? "warning" : "danger"}
                label="Chat listener"
                detail={chatStatus?.detail ?? "Connect Twitch to enable chat"}
              />
              <StatusPill
                tone={chatStatus?.canRead ? "success" : "warning"}
                label="Read scope"
                detail={chatStatus?.canRead ? "Granted" : "Reconnect required"}
              />
              <StatusPill
                tone={chatStatus?.canWrite ? "success" : "neutral"}
                label="Send scope"
                detail={chatStatus?.canWrite ? "Granted" : "Optional"}
              />
            </div>

            {chatStatus?.connected ? (
              <Callout tone="success" title="Chat is live">
                Twitch chat messages are available to overlays, activity tracking, and automation triggers.
              </Callout>
            ) : chatStatus?.canRead === false && info?.twitch.connected ? (
              <Callout tone="warning" title="Chat read scope missing">
                Reconnect Twitch so BTV can request <code>user:read:chat</code> and subscribe to live chat messages.
              </Callout>
            ) : null}

            <div className="integration-card__actions">
              <ButtonAnchor variant="secondary" size="sm" href="https://dev.twitch.tv/console" target="_blank" rel="noreferrer">
                Open Twitch Developer Console
              </ButtonAnchor>
            </div>

            <FormField label="Client ID">
              <input value={twitchId} onChange={(e) => setTwitchId(e.target.value)} placeholder="From Twitch Developer Console" />
            </FormField>

            <FormField label="Client Secret" hint={secretHint(info?.twitch.hasClientSecret)}>
              <input
                type="password"
                value={twitchSecret}
                onChange={(e) => setTwitchSecret(e.target.value)}
                placeholder={info?.twitch.hasClientSecret ? "Leave blank to keep existing" : "Paste client secret"}
              />
            </FormField>
          </div>

          <div className="integration-card__footer">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={async () => {
                const secret = twitchSecret.trim() || undefined;
                if (!twitchId) {
                  toast("Enter client ID");
                  return;
                }
                if (!secret && !info?.twitch.hasClientSecret) {
                  toast("Enter client secret");
                  return;
                }
                await api.saveTwitchConfig(twitchId, secret);
                toast("Twitch credentials saved");
                void load();
              }}
            >
              Save credentials
            </Button>
            <ButtonAnchor href={twitchAuthUrl} variant="primary" size="sm" target="_blank" rel="noreferrer">
              Connect Twitch
            </ButtonAnchor>
            {info?.twitch.connected ? (
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={async () => {
                  await api.disconnectTwitch();
                  toast("Disconnected");
                  setTwitchSecret("");
                  void load();
                }}
              >
                Disconnect
              </Button>
            ) : null}
          </div>
        </Card>

        <Card className="integration-card" hideableId="obs-websocket" hideableTitle="OBS WebSocket">
          <CardHeader
            title="OBS WebSocket"
            description="Connects BTV controls to scenes, sources, browser source repair, and test alerts."
            action={
              <StatusPill
                tone={info?.obs.connected ? "success" : info?.obs.hasPassword ? "warning" : "danger"}
                label={info?.obs.connected ? "Connected" : info?.obs.hasPassword ? "Saved" : "Not configured"}
                detail={info?.obs.connected ? `${info?.obs.host}:${info?.obs.port}` : undefined}
              />
            }
          />

          <div className="integration-card__body">
            <FormField label="Host">
              <input value={obsHost} onChange={(e) => setObsHost(e.target.value)} />
            </FormField>
            <FormField label="Port">
              <input type="number" value={obsPort} onChange={(e) => setObsPort(Number(e.target.value))} />
            </FormField>
            <FormField label="Password" hint={secretHint(info?.obs.hasPassword)}>
              <input
                type="password"
                value={obsPassword}
                onChange={(e) => setObsPassword(e.target.value)}
                placeholder={info?.obs.hasPassword ? "Leave blank to keep existing" : "OBS WebSocket password"}
              />
            </FormField>
          </div>

          <div className="integration-card__footer">
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={async () => {
                const password = obsPassword.trim() || undefined;
                if (!password && !info?.obs.hasPassword) {
                  toast("Enter OBS WebSocket password");
                  return;
                }
                const res = (await api.saveObsConfig(obsHost, obsPort, password)) as { ok: boolean };
                toast(res.ok ? "OBS connected" : "OBS connection failed");
                void load();
              }}
            >
              Save & connect
            </Button>
          </div>
        </Card>

        <Card className="integration-card" hideableId="spotify" hideableTitle="Spotify">
          <CardHeader
            title="Spotify"
            description="Feeds the Now Playing overlay and music-aware stream widgets."
            action={
              <StatusPill
                tone={info?.spotify.connected ? "success" : info?.spotify.configured ? "warning" : "neutral"}
                label={info?.spotify.connected ? "Connected" : info?.spotify.configured ? "Ready" : "Optional"}
              />
            }
          />

          <div className="integration-card__body">
            <Callout tone="info">
              Spotify uses HTTP on port <strong>4782</strong>. Use <code>127.0.0.1</code>, not <code>localhost</code>, in the Spotify Dashboard.
            </Callout>
            <CopyField label="Spotify redirect URI" value={info?.spotify.redirectUri ?? ""} />
            <div className="integration-card__actions">
              <ButtonAnchor variant="secondary" size="sm" href="https://developer.spotify.com/dashboard" target="_blank" rel="noreferrer">
                Open Spotify Dashboard
              </ButtonAnchor>
            </div>
            <FormField label="Client ID">
              <input value={spotifyId} onChange={(e) => setSpotifyId(e.target.value)} />
            </FormField>
            <FormField label="Client Secret" hint={secretHint(info?.spotify.hasClientSecret)}>
              <input
                type="password"
                value={spotifySecret}
                onChange={(e) => setSpotifySecret(e.target.value)}
                placeholder={info?.spotify.hasClientSecret ? "Leave blank to keep existing" : "Paste client secret"}
              />
            </FormField>
          </div>

          <div className="integration-card__footer">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={async () => {
                const secret = spotifySecret.trim() || undefined;
                if (!spotifyId) {
                  toast("Enter client ID");
                  return;
                }
                if (!secret && !info?.spotify.hasClientSecret) {
                  toast("Enter client secret");
                  return;
                }
                await api.saveSpotifyConfig(spotifyId, secret);
                toast("Spotify credentials saved");
                void load();
              }}
            >
              Save credentials
            </Button>
            <ButtonAnchor href={info?.spotify.authStartUrl ?? "http://127.0.0.1:4782/auth/spotify"} variant="primary" size="sm" target="_blank" rel="noreferrer">
              Connect Spotify
            </ButtonAnchor>
            {info?.spotify.connected ? (
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={async () => {
                  await api.disconnectSpotify();
                  toast("Disconnected");
                  setSpotifySecret("");
                  void load();
                }}
              >
                Disconnect
              </Button>
            ) : null}
          </div>
        </Card>

        <Card className="integration-card" hideableId="giphy" hideableTitle="GIPHY">
          <CardHeader
            title="GIPHY"
            description="Powers GIF and sticker search inside the Visual Alert Editor."
            action={<StatusPill tone={info?.giphy?.configured ? "success" : "neutral"} label={info?.giphy?.configured ? "Configured" : "Optional"} />}
          />

          <div className="integration-card__body">
            <FormField
              label="GIPHY SDK API key"
              hint={info?.giphy?.configured ? "Configured. Leave blank to keep the existing key." : "Paste your GIPHY SDK API key."}
            >
              <input
                type="password"
                value={giphyKey}
                onChange={(e) => setGiphyKey(e.target.value)}
                placeholder={info?.giphy?.configured ? "Leave blank to keep existing" : "Paste your GIPHY key"}
              />
            </FormField>
            <div className="integration-card__actions">
              <ButtonAnchor variant="secondary" size="sm" href="https://developers.giphy.com/dashboard/" target="_blank" rel="noreferrer">
                Open GIPHY Dashboard
              </ButtonAnchor>
            </div>
          </div>

          <div className="integration-card__footer">
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={async () => {
                const apiKey = giphyKey.trim() || undefined;
                if (!apiKey && !info?.giphy?.configured) {
                  toast("Enter GIPHY API key");
                  return;
                }
                await api.saveGiphyConfig(apiKey);
                toast("GIPHY key saved");
                void load();
              }}
            >
              Save GIPHY key
            </Button>
          </div>
        </Card>
      </div>
    </>
  );
}
