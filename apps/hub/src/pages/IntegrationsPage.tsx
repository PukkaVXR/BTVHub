import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, type IntegrationsInfo } from "../api";
import { useToast } from "../hooks/useToast";

export default function IntegrationsPage() {
  const [info, setInfo] = useState<IntegrationsInfo | null>(null);
  const [twitchId, setTwitchId] = useState("");
  const [twitchSecret, setTwitchSecret] = useState("");
  const [oauthHost, setOauthHost] = useState("127.0.0.1");
  const [spotifyId, setSpotifyId] = useState("");
  const [spotifySecret, setSpotifySecret] = useState("");
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
      if (data.twitch.hasClientSecret) setTwitchSecret("••••••••");
      setSpotifyId(data.spotify.clientId ?? "");
      if (data.spotify.hasClientSecret) setSpotifySecret("••••••••");
      setObsHost(data.obs.host);
      setObsPort(data.obs.port);
      if (data.obs.hasPassword) setObsPassword("••••••••");
    });

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    const twitchError = searchParams.get("twitch_error");
    const desc = searchParams.get("desc");
    if (twitchError === "redirect_mismatch") {
      toast(
        "Twitch redirect URI mismatch — register the exact HTTPS URL shown below.",
      );
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

  const copyRedirect = (uri: string) => {
    void navigator.clipboard.writeText(uri);
    toast("Redirect URI copied");
  };

  const twitchAuthUrl = info?.twitch.authStartUrl ?? "https://127.0.0.1:4783/auth/twitch";
  const oauthOrigin =
    info?.twitch.redirectUri?.replace(/\/auth\/twitch\/callback$/, "") ?? "https://127.0.0.1:4783";

  const chatSubError = info?.twitch.eventsubStatus?.includes("sub_error:channel.chat");

  return (
    <>
      <h1>Integrations</h1>
      <p className="subtitle">Connect Twitch, Spotify, and OBS WebSocket.</p>

      {info?.twitch.connected && chatSubError && (
        <div
          className="card"
          style={{
            borderColor: "var(--danger)",
            marginBottom: 16,
            fontSize: 14,
            lineHeight: 1.6,
          }}
        >
          <strong>Chat EventSub failed</strong>
          <p style={{ marginTop: 8, color: "var(--muted)" }}>
            Status: <code>{info.twitch.eventsubStatus}</code>
          </p>
          <p style={{ color: "var(--muted)" }}>
            Disconnect Twitch, then Connect again so OAuth includes{" "}
            <code>user:read:chat</code> (required for live chat in OBS).
          </p>
        </div>
      )}

      {info?.twitch.connected && !info.twitch.chatSubscribed && !chatSubError && (
        <div
          className="card"
          style={{ borderColor: "var(--warning, #e6a700)", marginBottom: 16, fontSize: 14 }}
        >
          <strong>Chat subscription pending</strong>
          <p style={{ marginTop: 8, color: "var(--muted)" }}>
            EventSub status: {info.twitch.eventsubStatus ?? "starting…"}
          </p>
        </div>
      )}

      {searchParams.get("twitch_error") === "redirect_mismatch" && (
        <div
          className="card"
          style={{
            borderColor: "var(--danger)",
            marginBottom: 16,
            fontSize: 14,
            lineHeight: 1.6,
          }}
        >
          <strong>Twitch redirect URI mismatch</strong>
          <p style={{ marginTop: 8, color: "var(--muted)" }}>
            Twitch requires <strong>HTTPS</strong>. In the{" "}
            <a href="https://dev.twitch.tv/console" target="_blank" rel="noreferrer">
              Twitch Developer Console
            </a>
            , open your application → <em>OAuth Redirect URLs</em> and add this exact line:
          </p>
          <div className="url-box">{info?.twitch.redirectUri}</div>
          <p style={{ color: "var(--muted)", marginTop: 8 }}>
            <code>127.0.0.1</code> and <code>localhost</code> are different — match the OAuth host
            selected below.
          </p>
        </div>
      )}

      <div className="card">
        <h2>Local HTTPS (required for Twitch)</h2>
        <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.6, marginBottom: 12 }}>
          OAuth uses HTTPS on port <strong>4783</strong> (self-signed cert). Before Connect Twitch,
          open{" "}
          <a href={oauthOrigin} target="_blank" rel="noreferrer">
            {oauthOrigin}
          </a>{" "}
          and accept the security warning. OBS overlays stay on HTTP port{" "}
          <strong>4782</strong> (see Overlays page).
        </p>
      </div>

      <div className="card">
        <h2>Twitch</h2>
        {info?.twitch.connected ? (
          <p>
            Connected as <strong>{info.twitch.displayName ?? info.twitch.login}</strong>
            {info.twitch.eventsubStatus && (
              <span style={{ fontSize: 13, color: "var(--muted)", marginLeft: 8 }}>
                · EventSub: {info.twitch.eventsubStatus}
              </span>
            )}
          </p>
        ) : (
          <p className="subtitle">Not connected</p>
        )}

        <div className="form-row">
          <label>OAuth host (must match Twitch redirect URL)</label>
          <select
            value={oauthHost}
            onChange={(e) => setOauthHost(e.target.value)}
            style={{ marginBottom: 8 }}
          >
            <option value="127.0.0.1">127.0.0.1</option>
            <option value="localhost">localhost</option>
          </select>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={async () => {
              await api.saveOAuthHost(oauthHost);
              toast("OAuth host saved — update Twitch console if the URI changed");
              void load();
            }}
          >
            Apply host
          </button>
        </div>

        <p
          style={{
            fontSize: 13,
            marginBottom: 8,
            padding: "10px 12px",
            background: "rgba(145, 71, 255, 0.15)",
            borderRadius: 8,
            border: "1px solid var(--accent)",
          }}
        >
          <strong>Important:</strong> Twitch must use port <strong>4783</strong>, not 4782.
          Overlays use 4782 (HTTP); OAuth uses 4783 (HTTPS). After scope updates, disconnect and
          reconnect Twitch.
        </p>
        <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>
          Register this exact redirect URI in Twitch Developer Console:
        </p>
        <div className="url-box">{info?.twitch.redirectUri}</div>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          style={{ marginBottom: 12 }}
          onClick={() => info?.twitch.redirectUri && copyRedirect(info.twitch.redirectUri)}
        >
          Copy redirect URI
        </button>

        <div className="form-row">
          <label>Client ID</label>
          <input
            value={twitchId}
            onChange={(e) => setTwitchId(e.target.value)}
            placeholder="From Twitch Developer Console"
          />
        </div>
        <div className="form-row">
          <label>Client Secret {info?.twitch.hasClientSecret && "(saved)"}</label>
          <input
            type="password"
            value={twitchSecret}
            onChange={(e) => setTwitchSecret(e.target.value)}
            placeholder={info?.twitch.hasClientSecret ? "Leave •••• to keep existing" : ""}
          />
        </div>
        <div className="actions">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={async () => {
              const secret =
                twitchSecret === "••••••••" ? undefined : twitchSecret;
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
          </button>
          <a
            href={twitchAuthUrl}
            className="btn btn-primary btn-sm"
            target="_blank"
            rel="noreferrer"
          >
            Connect Twitch
          </a>
          {info?.twitch.connected && (
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={async () => {
                await api.disconnectTwitch();
                toast("Disconnected");
                setTwitchSecret("");
                void load();
              }}
            >
              Disconnect
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <h2>Spotify</h2>
        {info?.spotify.connected ? (
          <span className="badge badge-ok">Connected</span>
        ) : (
          <span className="badge badge-off">Not connected</span>
        )}
        <p style={{ fontSize: 13, marginBottom: 8, color: "var(--muted)" }}>
          Spotify uses <strong>HTTP</strong> on port <strong>4782</strong> (loopback). Use{" "}
          <code>127.0.0.1</code>, not <code>localhost</code>, in the Spotify Dashboard.
        </p>
        <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>
          Redirect URI (register in Spotify Dashboard):
        </p>
        <div className="url-box">{info?.spotify.redirectUri}</div>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          style={{ marginBottom: 12 }}
          onClick={() => info?.spotify.redirectUri && copyRedirect(info.spotify.redirectUri)}
        >
          Copy redirect URI
        </button>
        <div className="form-row">
          <label>Client ID</label>
          <input value={spotifyId} onChange={(e) => setSpotifyId(e.target.value)} />
        </div>
        <div className="form-row">
          <label>Client Secret {info?.spotify.hasClientSecret && "(saved)"}</label>
          <input
            type="password"
            value={spotifySecret}
            onChange={(e) => setSpotifySecret(e.target.value)}
            placeholder={info?.spotify.hasClientSecret ? "Leave •••• to keep existing" : ""}
          />
        </div>
        <div className="actions">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={async () => {
              const secret =
                spotifySecret === "••••••••" ? undefined : spotifySecret;
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
          </button>
          <a
            href={info?.spotify.authStartUrl ?? "http://127.0.0.1:4782/auth/spotify"}
            className="btn btn-primary btn-sm"
            target="_blank"
            rel="noreferrer"
          >
            Connect Spotify
          </a>
          {info?.spotify.connected && (
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={async () => {
                await api.disconnectSpotify();
                toast("Disconnected");
                setSpotifySecret("");
                void load();
              }}
            >
              Disconnect
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <h2>OBS WebSocket</h2>
        <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 12 }}>
          Status: {info?.obs.connected ? "Connected" : "Disconnected"}
          {info?.obs.hasPassword && !info.obs.connected && " — reconnects on server start"}
        </p>
        <div className="form-row">
          <label>Host</label>
          <input value={obsHost} onChange={(e) => setObsHost(e.target.value)} />
        </div>
        <div className="form-row">
          <label>Port</label>
          <input
            type="number"
            value={obsPort}
            onChange={(e) => setObsPort(Number(e.target.value))}
          />
        </div>
        <div className="form-row">
          <label>Password</label>
          <input
            type="password"
            value={obsPassword}
            onChange={(e) => setObsPassword(e.target.value)}
            placeholder={info?.obs.hasPassword ? "Leave •••• to keep existing" : ""}
          />
        </div>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={async () => {
            const password =
              obsPassword === "••••••••" ? undefined : obsPassword;
            if (!password && !info?.obs.hasPassword) {
              toast("Enter OBS WebSocket password");
              return;
            }
            const res = (await api.saveObsConfig(obsHost, obsPort, password)) as {
              ok: boolean;
            };
            toast(res.ok ? "OBS connected" : "OBS connection failed");
            void load();
          }}
        >
          Save & connect
        </button>
      </div>
    </>
  );
}
