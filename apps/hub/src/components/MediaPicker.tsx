import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, type MediaAssetInfo } from "../api";
import { useToast } from "../hooks/useToast";

interface MediaPickerProps {
  value: string;
  onChange: (path: string) => void;
}

type MediaFilter = "all" | MediaAssetInfo["kind"];

export function toMediaAssetPath(nameOrPath: string): string {
  const trimmed = nameOrPath.trim().replace(/^\/+/, "");
  if (!trimmed) return "";
  if (trimmed.startsWith("assets/")) return trimmed.slice("assets/".length);
  if (trimmed.startsWith("media/")) return trimmed;
  return `media/${trimmed}`;
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;
  return `${value >= 10 || index === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`;
}

function encodeFileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Could not read media file"));
        return;
      }
      resolve(result.split(",", 2)[1] ?? "");
    };
    reader.onerror = () => reject(reader.error ?? new Error("Could not read media file"));
    reader.readAsDataURL(file);
  });
}

export default function MediaPicker({ value, onChange }: MediaPickerProps) {
  const [media, setMedia] = useState<MediaAssetInfo[]>([]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<MediaFilter>("all");
  const [preview, setPreview] = useState<MediaAssetInfo | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const normalizedValue = toMediaAssetPath(value);
  const selected = useMemo(
    () => media.find((asset) => toMediaAssetPath(asset.name) === normalizedValue),
    [media, normalizedValue],
  );

  const filteredMedia = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return media.filter((asset) => {
      if (kind !== "all" && asset.kind !== kind) return false;
      return !needle || asset.name.toLowerCase().includes(needle);
    });
  }, [kind, media, query]);

  const load = useCallback(() => {
    void api
      .listMedia()
      .then((r) => setMedia(r.media))
      .catch((e) => toast(e instanceof Error ? e.message : "Could not load media"));
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const upload = async (file: File) => {
    try {
      const base64 = await encodeFileToBase64(file);
      const res = await api.uploadMedia(file.name, base64);
      toast(`Uploaded ${res.name}`);
      onChange(toMediaAssetPath(res.name));
      setOpen(true);
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Upload failed");
    }
  };

  const remove = async (asset: MediaAssetInfo) => {
    if (!window.confirm(`Delete ${asset.name} from assets/media?`)) return;
    try {
      await api.deleteMedia(asset.name);
      if (toMediaAssetPath(asset.name) === normalizedValue) onChange("");
      if (preview?.name === asset.name) setPreview(null);
      toast(`Deleted ${asset.name}`);
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Delete failed");
    }
  };

  return (
    <div className="media-picker">
      <div className="media-picker-controls">
        <input
          className="media-picker-path"
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
        {selected && (
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPreview(selected)}>
            Preview
          </button>
        )}
        {normalizedValue && (
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => onChange("")}>
            Clear
          </button>
        )}
      </div>

      {normalizedValue && (
        <div className="media-picker-selected">
          {selected && selected.kind !== "video" ? (
            <img src={selected.url} alt="" />
          ) : selected ? (
            <video src={selected.url} muted />
          ) : (
            <div className="media-picker-placeholder">?</div>
          )}
          <div>
            <strong>{selected?.name ?? normalizedValue.replace(/^media\//, "")}</strong>
            <span>
              {selected ? `${selected.kind} - ${formatBytes(selected.size)} in assets/media` : "Custom path"}
            </span>
          </div>
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="video/*,image/*,.gif,.png,.jpg,.jpeg,.webp,.mp4,.webm,.mov"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
          e.target.value = "";
        }}
      />

      {open && (
        <div className="media-picker-library">
          <div className="media-picker-filter-row">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search media library"
            />
            <select value={kind} onChange={(e) => setKind(e.target.value as MediaFilter)}>
              <option value="all">All</option>
              <option value="image">Images</option>
              <option value="gif">GIFs</option>
              <option value="video">Videos</option>
            </select>
          </div>

          {media.length === 0 ? (
            <p className="media-picker-empty">
              No media in <code>assets/media/</code>. Upload MP4, WebM, GIF, or images.
            </p>
          ) : filteredMedia.length === 0 ? (
            <p className="media-picker-empty">No media matches this filter.</p>
          ) : (
            <div className="media-picker-grid">
              {filteredMedia.map((asset) => {
                const active = toMediaAssetPath(asset.name) === normalizedValue;
                return (
                  <div key={asset.name} className={`media-picker-card${active ? " active" : ""}`}>
                    <button
                      type="button"
                      className="media-picker-asset"
                      onClick={() => {
                        onChange(toMediaAssetPath(asset.name));
                        setOpen(false);
                      }}
                      title={`Use ${asset.name}`}
                    >
                      {asset.kind === "video" ? (
                        <video src={asset.url} muted />
                      ) : (
                        <img src={asset.url} alt="" />
                      )}
                      <strong>{asset.name}</strong>
                      <span>{asset.kind} - {formatBytes(asset.size)}</span>
                    </button>
                    <div className="media-picker-card-actions">
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPreview(asset)}>
                        View
                      </button>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => void remove(asset)}>
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {preview && (
        <div className="media-picker-preview" role="dialog" aria-modal="true">
          <div className="media-picker-preview-panel">
            <div className="media-picker-preview-header">
              <div>
                <strong>{preview.name}</strong>
                <span>{preview.kind} - {formatBytes(preview.size)}</span>
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPreview(null)}>
                Close
              </button>
            </div>
            {preview.kind === "video" ? (
              <video src={preview.url} controls autoPlay muted loop />
            ) : (
              <img src={preview.url} alt="" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
