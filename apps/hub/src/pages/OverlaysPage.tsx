import { useEffect, useState } from "react";
import { api, type OverlayInfo } from "../api";
import { useToast } from "../hooks/useToast";

export default function OverlaysPage() {
  const [overlays, setOverlays] = useState<OverlayInfo[]>([]);
  const [wsOk, setWsOk] = useState<boolean | null>(null);
  const toast = useToast();

  useEffect(() => {
    void api.overlays().then((r) => setOverlays(r.overlays));
    void api.health().then((h) => setWsOk(h.ok));
  }, []);

  const copy = (url: string) => {
    void navigator.clipboard.writeText(url);
    toast("URL copied to clipboard");
  };

  return (
    <>
      <h1>Overlays</h1>
      <p className="subtitle">
        Add these URLs as Browser Sources in OBS (1920×1080, transparent background).
        {wsOk != null && (
          <span style={{ marginLeft: 8 }}>
            Server: {wsOk ? (
              <span className="badge badge-ok">online</span>
            ) : (
              <span className="badge badge-off">offline</span>
            )}
          </span>
        )}
      </p>
      <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16 }}>
        Live chat requires <code>http://127.0.0.1:4782/o/chat.html</code> and Twitch reconnect with{" "}
        <code>user:read:chat</code>.
      </p>
      <div className="grid">
        {overlays.map((o) => (
          <div key={o.id} className="card">
            <h2>{o.name}</h2>
            <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>
              Channels: {o.channels.join(", ")}
            </p>
            <div className="url-box">{o.url}</div>
            <div className="actions">
              <button type="button" className="btn btn-primary btn-sm" onClick={() => copy(o.url)}>
                Copy OBS URL
              </button>
              <a href={o.url} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">
                Preview
              </a>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
