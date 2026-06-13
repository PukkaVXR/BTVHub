import type { GiphyAssetType, GiphyResult, MediaAssetInfo, SoundAssetInfo } from "../../api";
import { resolvePreviewAssetUrl } from "./AlertPreview";

export type AlertAssetKind = "all" | "image" | "gif" | "video" | "audio";

export function formatAssetBytes(size: number): string {
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  if (size >= 1024) return `${Math.round(size / 1024)} KB`;
  return `${size} B`;
}

function assetAttribution(asset: MediaAssetInfo | SoundAssetInfo): string {
  const metadata = asset.metadata;
  if (!metadata?.source) return "";
  if (metadata.source === "giphy") {
    const kind = metadata.sourceType === "sticker" ? "GIPHY sticker" : "GIPHY GIF";
    return metadata.username ? `${kind} by ${metadata.username}` : kind;
  }
  return "Uploaded locally";
}

type AlertAssetLibraryProps = {
  assetSearch: string;
  assetKind: AlertAssetKind;
  assetUploading: boolean;
  mediaAssets: MediaAssetInfo[];
  soundAssets: SoundAssetInfo[];
  overlayOrigin: string;
  giphyAssetType: GiphyAssetType;
  giphyQuery: string;
  giphyResults: GiphyResult[];
  giphyLoading: boolean;
  onAssetSearchChange: (value: string) => void;
  onAssetKindChange: (value: AlertAssetKind) => void;
  onUpload: (file: File, kind: "media" | "sound") => void;
  onApplyMedia: (asset: MediaAssetInfo) => void;
  onApplySound: (asset: SoundAssetInfo) => void;
  onDelete: (asset: MediaAssetInfo | SoundAssetInfo, kind: "media" | "sound") => void;
  onGiphyAssetTypeChange: (value: GiphyAssetType) => void;
  onGiphyQueryChange: (value: string) => void;
  onGiphySearch: (query?: string) => void;
  onGiphyImport: (asset: GiphyResult) => void;
};

export function AlertAssetLibrary({
  assetSearch,
  assetKind,
  assetUploading,
  mediaAssets,
  soundAssets,
  overlayOrigin,
  giphyAssetType,
  giphyQuery,
  giphyResults,
  giphyLoading,
  onAssetSearchChange,
  onAssetKindChange,
  onUpload,
  onApplyMedia,
  onApplySound,
  onDelete,
  onGiphyAssetTypeChange,
  onGiphyQueryChange,
  onGiphySearch,
  onGiphyImport,
}: AlertAssetLibraryProps) {
  return (
    <>
      <details className="alert-compact-section">
        <summary>Assets</summary>
        <div className="grid" style={{ gridTemplateColumns: "1fr 120px" }}>
          <div>
            <label>Search local assets</label>
            <input value={assetSearch} onChange={(event) => onAssetSearchChange(event.target.value)} placeholder="filename..." />
          </div>
          <div>
            <label>Type</label>
            <select value={assetKind} onChange={(event) => onAssetKindChange(event.target.value as AlertAssetKind)}>
              <option value="all">All</option>
              <option value="image">Images</option>
              <option value="gif">GIFs</option>
              <option value="video">Videos</option>
              <option value="audio">Audio</option>
            </select>
          </div>
        </div>
        <div className="actions" style={{ marginTop: 0, marginBottom: 12 }}>
          <label className="ui-button ui-button--secondary ui-button--sm">
            Upload media
            <input
              type="file"
              accept="image/*,video/*,.gif,.png,.jpg,.jpeg,.webp,.mp4,.webm,.mov"
              style={{ display: "none" }}
              disabled={assetUploading}
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = "";
                if (file) onUpload(file, "media");
              }}
            />
          </label>
          <label className="ui-button ui-button--secondary ui-button--sm">
            Upload sound
            <input
              type="file"
              accept="audio/*,.mp3,.wav,.ogg,.m4a,.webm"
              style={{ display: "none" }}
              disabled={assetUploading}
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = "";
                if (file) onUpload(file, "sound");
              }}
            />
          </label>
        </div>
        <div className="asset-library-grid">
          {mediaAssets.map((asset) => (
            <div key={asset.url} className="asset-card">
              <button type="button" onClick={() => onApplyMedia(asset)} title={`Use ${asset.name}`}>
                {asset.kind === "video" ? (
                  <video src={resolvePreviewAssetUrl(asset.url, overlayOrigin)} muted />
                ) : (
                  <img src={resolvePreviewAssetUrl(asset.url, overlayOrigin)} alt="" />
                )}
                <strong>{asset.name}</strong>
                <span>{asset.kind} - {formatAssetBytes(asset.size)}</span>
                {assetAttribution(asset) && <span>{assetAttribution(asset)}</span>}
              </button>
              <button type="button" className="asset-delete" onClick={() => onDelete(asset, "media")}>Delete</button>
            </div>
          ))}
          {soundAssets.map((asset) => (
            <div key={asset.url} className="asset-card audio">
              <button type="button" onClick={() => onApplySound(asset)} title={`Use ${asset.name}`}>
                <strong>{asset.name}</strong>
                <span>audio - {formatAssetBytes(asset.size)}</span>
                {assetAttribution(asset) && <span>{assetAttribution(asset)}</span>}
              </button>
              <button type="button" className="asset-delete" onClick={() => onDelete(asset, "sound")}>Delete</button>
            </div>
          ))}
        </div>
        {!mediaAssets.length && !soundAssets.length && <p className="subtitle">No local assets match this filter.</p>}
      </details>

      <details className="alert-compact-section">
        <summary>GIPHY</summary>
        <div className="segmented" style={{ marginBottom: 12 }}>
          <button type="button" className={giphyAssetType === "gif" ? "active" : ""} onClick={() => onGiphyAssetTypeChange("gif")}>
            GIFs
          </button>
          <button type="button" className={giphyAssetType === "sticker" ? "active" : ""} onClick={() => onGiphyAssetTypeChange("sticker")}>
            Stickers
          </button>
        </div>
        <div className="form-row">
          <label>Search {giphyAssetType === "sticker" ? "stickers" : "GIFs"}</label>
          <input
            value={giphyQuery}
            onChange={(event) => onGiphyQueryChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") onGiphySearch();
            }}
            placeholder={giphyAssetType === "sticker" ? "sparkle, hype, emote..." : "hype, raid, explosion..."}
          />
        </div>
        <div className="actions" style={{ marginTop: 0, marginBottom: 12 }}>
          <button type="button" className="ui-button ui-button--primary ui-button--sm" onClick={() => onGiphySearch()} disabled={giphyLoading}>
            {giphyLoading ? "Searching..." : "Search"}
          </button>
          <button type="button" className="ui-button ui-button--secondary ui-button--sm" onClick={() => onGiphySearch("")} disabled={giphyLoading}>
            Trending {giphyAssetType === "sticker" ? "stickers" : "GIFs"}
          </button>
        </div>
        <div className="giphy-grid">
          {giphyResults.map((asset) => (
            <button key={asset.id} type="button" className="giphy-card" onClick={() => onGiphyImport(asset)} title={asset.title}>
              <img src={asset.previewUrl} alt={asset.title} />
              <span>{asset.title || (asset.type === "sticker" ? "Import sticker" : "Import GIF")}</span>
            </button>
          ))}
        </div>
      </details>
    </>
  );
}
