import { useCallback, useEffect, useRef, useState } from "react";
import { api, type MediaAssetInfo } from "../api";
import { useToast } from "../hooks/useToast";

interface MediaPickerProps {
  value: string;
  onChange: (path: string) => void;
}

export function toMediaAssetPath(nameOrPath: string): string {
  const trimmed = nameOrPath.trim().replace(/^\/+/, "");
  if (!trimmed) return "";
  if (trimmed.startsWith("assets/")) return trimmed.slice("assets/".length);
  if (trimmed.startsWith("media/")) return trimmed;
  return `media/${trimmed}`;
}

export default function MediaPicker({ value, onChange }: MediaPickerProps) {
  const [media, setMedia] = useState<MediaAssetInfo[]>([]);
  const [open, setOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const load = useCallback(() => {
    void api.listMedia().then((r) => setMedia(r.media));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const upload = (file: File) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const result = String(reader.result ?? "");
        const base64 = result.includes(",") ? result.split(",")[1]! : result;
        const res = await api.uploadMedia(file.name, base64);
        toast(`Uploaded ${res.name}`);
        onChange(toMediaAssetPath(res.name));
        load();
      } catch (e) {
        toast(e instanceof Error ? e.message : "Upload failed");
      }
    };
    reader.onerror = () => toast("Failed to read file");
    reader.readAsDataURL(file);
  };

  return (
    <div className="media-picker">
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input
          style={{ flex: 1, minWidth: 140, margin: 0 }}
          value={value}
          onChange={(e) => onChange(toMediaAssetPath(e.target.value))}
          placeholder="media/clip.mp4"
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
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="video/*,image/*,.gif,.mp4,.webm,.mov"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload(f);
          e.target.value = "";
        }}
      />
      {open && (
        <div
          style={{
            marginTop: 8,
            maxHeight: 200,
            overflow: "auto",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: 8,
          }}
        >
          {media.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--muted)" }}>
              No media in <code>assets/media/</code> — upload MP4, WebM, GIF, or images.
            </p>
          ) : (
            media.map((m) => (
              <div
                key={m.name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "4px 0",
                  fontSize: 13,
                }}
              >
                {m.kind !== "video" && (
                  <img
                    src={m.url}
                    alt=""
                    style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 4 }}
                  />
                )}
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ flex: 1, textAlign: "left" }}
                  onClick={() => {
                    onChange(toMediaAssetPath(m.name));
                    setOpen(false);
                  }}
                >
                  {m.name} <span style={{ opacity: 0.6 }}>({m.kind})</span>
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
