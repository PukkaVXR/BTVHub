import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
        reject(new Error("Could not read sound file"));
        return;
      }
      resolve(result.split(",", 2)[1] ?? "");
    };
    reader.onerror = () => reject(reader.error ?? new Error("Could not read sound file"));
    reader.readAsDataURL(file);
  });
}

export default function SoundPicker({ value, onChange, placeholder }: SoundPickerProps) {
  const [sounds, setSounds] = useState<SoundAssetInfo[]>([]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const normalizedValue = toSoundAssetPath(value);
  const selected = useMemo(
    () => sounds.find((sound) => toSoundAssetPath(sound.name) === normalizedValue),
    [normalizedValue, sounds],
  );
  const selectedUrl = normalizedValue ? `/assets/${normalizedValue.replace(/^\/+/, "")}` : "";

  const filteredSounds = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return sounds;
    return sounds.filter((sound) => sound.name.toLowerCase().includes(needle));
  }, [query, sounds]);

  const stop = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    setPlayingUrl(null);
  }, []);

  const load = useCallback(() => {
    void api
      .listSounds()
      .then((r) => setSounds(r.sounds))
      .catch((e) => toast(e instanceof Error ? e.message : "Could not load sounds"));
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => stop, [stop]);

  const upload = async (file: File) => {
    try {
      stop();
      const data = await encodeFileToBase64(file);
      const res = await api.uploadSound(file.name, data);
      toast(`Uploaded ${res.name}`);
      onChange(toSoundAssetPath(res.name));
      setOpen(true);
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Upload failed");
    }
  };

  const play = (url: string) => {
    stop();
    const audio = new Audio(url);
    audioRef.current = audio;
    setPlayingUrl(url);
    audio.addEventListener("ended", () => setPlayingUrl(null), { once: true });
    audio.addEventListener("error", () => {
      setPlayingUrl(null);
      toast("Could not play sound");
    }, { once: true });
    void audio.play().catch(() => {
      setPlayingUrl(null);
      toast("Could not play sound");
    });
  };

  const remove = async (sound: SoundAssetInfo) => {
    if (!window.confirm(`Delete ${sound.name} from assets/sounds?`)) return;
    try {
      stop();
      await api.deleteSound(sound.name);
      if (toSoundAssetPath(sound.name) === normalizedValue) onChange("");
      toast(`Deleted ${sound.name}`);
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Delete failed");
    }
  };

  return (
    <div className="sound-picker">
      <div className="sound-picker-controls">
        <input
          className="sound-picker-path"
          value={value}
          onChange={(e) => onChange(toSoundAssetPath(e.target.value))}
          placeholder={placeholder ?? "sounds/alert.mp3"}
        />
        <button type="button" className="ui-button ui-button--secondary ui-button--sm" onClick={() => setOpen((o) => !o)}>
          {open ? "Hide" : "Browse"}
        </button>
        <button
          type="button"
          className="ui-button ui-button--secondary ui-button--sm"
          onClick={() => fileRef.current?.click()}
        >
          Upload
        </button>
        {normalizedValue && (
          <>
            <button
              type="button"
              className="ui-button ui-button--secondary ui-button--sm"
              onClick={() => play(selected?.url ?? selectedUrl)}
            >
              Preview
            </button>
            {playingUrl && (
              <button type="button" className="ui-button ui-button--secondary ui-button--sm" onClick={stop}>
                Stop
              </button>
            )}
            <button type="button" className="ui-button ui-button--secondary ui-button--sm" onClick={() => onChange("")}>
              Clear
            </button>
          </>
        )}
      </div>

      {normalizedValue && (
        <div className="sound-picker-selected">
          <strong>{selected?.name ?? normalizedValue.replace(/^sounds\//, "")}</strong>
          <span>{selected ? `${formatBytes(selected.size)} in assets/sounds` : "Custom path"}</span>
        </div>
      )}

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
        <div className="sound-picker-library">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search sound library"
          />
          {sounds.length === 0 ? (
            <p className="sound-picker-empty">
              No sounds in <code>assets/sounds/</code>. Upload a file or add one there.
            </p>
          ) : filteredSounds.length === 0 ? (
            <p className="sound-picker-empty">No sounds match "{query}".</p>
          ) : (
            <div className="sound-picker-list">
              {filteredSounds.map((sound) => {
                const path = toSoundAssetPath(sound.name);
                const active = path === normalizedValue;
                const playing = sound.url === playingUrl;
                return (
                  <div key={sound.name} className={`sound-picker-row${active ? " active" : ""}`}>
                    <button
                      type="button"
                      className="sound-picker-name"
                      onClick={() => {
                        onChange(path);
                        setOpen(false);
                      }}
                    >
                      <strong>{sound.name}</strong>
                      <span>{formatBytes(sound.size)}</span>
                    </button>
                    <button
                      type="button"
                      className="ui-button ui-button--secondary ui-button--sm"
                      onClick={() => (playing ? stop() : play(sound.url))}
                    >
                      {playing ? "Stop" : "Play"}
                    </button>
                    <button
                      type="button"
                      className="ui-button ui-button--secondary ui-button--sm"
                      onClick={() => void remove(sound)}
                    >
                      Delete
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
