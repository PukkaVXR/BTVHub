import { useCallback, useEffect, useRef, useState } from "react";
import { api, type SoundAssetInfo } from "../api";
import { useToast } from "../hooks/useToast";

interface SoundPickerProps {
  value: string;
  onChange: (path: string) => void;
  /** Stored as path under /assets/, e.g. sounds/foo.mp3 */
  placeholder?: string;
}

/** Normalize to sounds/filename for alert rules. */
export function toSoundAssetPath(nameOrPath: string): string {
  const trimmed = nameOrPath.trim().replace(/^\/+/, "");
  if (!trimmed) return "";
  if (trimmed.startsWith("assets/")) return trimmed.slice("assets/".length);
  if (trimmed.startsWith("sounds/")) return trimmed;
  return `sounds/${trimmed}`;
}

export default function SoundPicker({ value, onChange, placeholder }: SoundPickerProps) {
  const [sounds, setSounds] = useState<SoundAssetInfo[]>([]);
  const [open, setOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const load = useCallback(() => {
    void api.listSounds().then((r) => setSounds(r.sounds));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const upload = async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const data = btoa(String.fromCharCode(...new Uint8Array(buf)));
      const res = await api.uploadSound(file.name, data);
      toast(`Uploaded ${res.name}`);
      onChange(toSoundAssetPath(res.name));
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Upload failed");
    }
  };

  const play = (url: string) => {
    const audio = new Audio(url);
    void audio.play().catch(() => toast("Could not play sound"));
  };

  return (
    <div className="sound-picker">
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input
          style={{ flex: 1, minWidth: 140, margin: 0 }}
          value={value}
          onChange={(e) => onChange(toSoundAssetPath(e.target.value))}
          placeholder={placeholder ?? "sounds/alert.mp3"}
        />
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOpen((o) => !o)}>
          {open ? "Hide" : "Browse"}
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => fileRef.current?.click()}
        >
          Upload
        </button>
        {value && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => play(`/assets/${value.replace(/^\//, "")}`)}
          >
            Test
          </button>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="audio/*,.mp3,.wav,.ogg,.m4a,.webm"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
          e.target.value = "";
        }}
      />
      {open && (
        <div
          style={{
            marginTop: 8,
            maxHeight: 160,
            overflow: "auto",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: 8,
          }}
        >
          {sounds.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--muted)" }}>
              No sounds in <code>assets/sounds/</code> — upload or add files there.
            </p>
          ) : (
            sounds.map((s) => (
              <div
                key={s.name}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "4px 0",
                  fontSize: 13,
                }}
              >
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ flex: 1, textAlign: "left", marginRight: 8 }}
                  onClick={() => {
                    onChange(toSoundAssetPath(s.name));
                    setOpen(false);
                  }}
                >
                  {s.name}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => play(s.url)}
                >
                  ▶
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
