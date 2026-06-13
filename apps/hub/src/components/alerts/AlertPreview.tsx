import { Component } from "react";
import type { CSSProperties, ErrorInfo, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import type { AlertKeyframe, AlertLayer, AlertLayerAnimation, StreamEventType } from "@btv/shared";

export type TestPayload = {
  user?: string;
  login?: string;
  amount?: number;
  message?: string;
  variables?: Record<string, unknown>;
  payload?: Record<string, unknown>;
};

export type ResizeHandle = "nw" | "ne" | "sw" | "se";

type LayerStyle = CSSProperties & { "--btv-intensity"?: string };

function payloadPath(payload: Record<string, unknown> | undefined, path: string): string {
  let value: unknown = payload;
  for (const key of path.split(".")) {
    if (!value || typeof value !== "object") return "";
    value = (value as Record<string, unknown>)[key];
  }
  return value == null ? "" : String(value);
}

function renderTemplate(text: string, eventType: StreamEventType, testPayload: TestPayload): string {
  return text
    .replaceAll("{user}", testPayload.user ?? "TestUser")
    .replaceAll("{login}", testPayload.login ?? "testuser")
    .replaceAll("{event}", eventType)
    .replaceAll("{amount}", String(testPayload.amount ?? (eventType === "cheer" ? 100 : 1)))
    .replaceAll("{message}", testPayload.message ?? "Test visual alert from hub")
    .replace(/\{var:([^}]+)\}/g, (_, key: string) => payloadPath(testPayload.variables, key.trim()))
    .replace(/\{payload\.([^}]+)\}/g, (_, path: string) => payloadPath(testPayload.payload, path));
}

function cssFilter(layer: AlertLayer): string | undefined {
  const filter = layer.filter;
  if (!filter) return undefined;
  const parts = [
    `brightness(${filter.brightness ?? 1})`,
    `contrast(${filter.contrast ?? 1})`,
    `saturate(${filter.saturation ?? 1})`,
  ];
  if (filter.blur) parts.push(`blur(${filter.blur}px)`);
  if (filter.hueRotate) parts.push(`hue-rotate(${filter.hueRotate}deg)`);
  if (filter.glow) parts.push(`drop-shadow(0 0 ${filter.glow}px ${filter.glowColor ?? "rgba(91, 140, 255, 0.9)"})`);
  return parts.join(" ");
}

function numericKeyframeValue(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function layerAtPlayhead(layer: AlertLayer, playheadMs: number): AlertLayer {
  if (!layer.keyframes.length) return layer;
  const frames = [...layer.keyframes].sort((a, b) => a.atMs - b.atMs);
  const before = [...frames].reverse().find((frame) => frame.atMs <= playheadMs);
  const after = frames.find((frame) => frame.atMs >= playheadMs && frame.id !== before?.id);
  const readFrame = (frame: AlertKeyframe | undefined, key: string, fallback: number) => numericKeyframeValue(frame?.properties[key], fallback);

  if (!before && !after) return layer;
  if (before && !after) {
    return {
      ...layer,
      x: readFrame(before, "x", layer.x),
      y: readFrame(before, "y", layer.y),
      opacity: readFrame(before, "opacity", layer.opacity),
      scale: readFrame(before, "scale", layer.scale),
      rotation: readFrame(before, "rotation", layer.rotation),
    } as AlertLayer;
  }

  if (!before && after) {
    return {
      ...layer,
      x: readFrame(after, "x", layer.x),
      y: readFrame(after, "y", layer.y),
      opacity: readFrame(after, "opacity", layer.opacity),
      scale: readFrame(after, "scale", layer.scale),
      rotation: readFrame(after, "rotation", layer.rotation),
    } as AlertLayer;
  }

  const span = Math.max(1, after!.atMs - before!.atMs);
  const t = Math.max(0, Math.min(1, (playheadMs - before!.atMs) / span));
  return {
    ...layer,
    x: lerp(readFrame(before, "x", layer.x), readFrame(after, "x", layer.x), t),
    y: lerp(readFrame(before, "y", layer.y), readFrame(after, "y", layer.y), t),
    opacity: lerp(readFrame(before, "opacity", layer.opacity), readFrame(after, "opacity", layer.opacity), t),
    scale: lerp(readFrame(before, "scale", layer.scale), readFrame(after, "scale", layer.scale), t),
    rotation: lerp(readFrame(before, "rotation", layer.rotation), readFrame(after, "rotation", layer.rotation), t),
  } as AlertLayer;
}

function cssEasing(easing?: AlertLayerAnimation["easing"]): string {
  if (easing === "linear") return "linear";
  if (easing === "ease-in") return "ease-in";
  if (easing === "ease-in-out") return "ease-in-out";
  if (easing === "bounce") return "cubic-bezier(.2,1.6,.35,1)";
  if (easing === "elastic") return "cubic-bezier(.2,1.8,.35,1)";
  return "ease-out";
}

function layerStyle(layer: AlertLayer, playheadMs?: number): LayerStyle {
  const displayLayer = playheadMs == null ? layer : layerAtPlayhead(layer, playheadMs);
  const animation = layer.animation?.preset && layer.animation.preset !== "none"
    ? `${layer.animation.preset} ${layer.animation.durationMs}ms ${cssEasing(layer.animation.easing)} ${layer.animation.delayMs}ms ${layer.animation.loop ? "infinite" : "both"}`
    : undefined;
  return {
    position: "absolute",
    left: displayLayer.x,
    top: displayLayer.y,
    width: displayLayer.width,
    height: displayLayer.height,
    opacity: displayLayer.opacity,
    transform: `rotate(${displayLayer.rotation}deg) scale(${displayLayer.scale})`,
    transformOrigin: "center",
    mixBlendMode: layer.blendMode as CSSProperties["mixBlendMode"],
    filter: cssFilter(layer),
    display: layer.visible ? "flex" : "none",
    alignItems: "center",
    justifyContent: "center",
    pointerEvents: "auto",
    cursor: layer.locked ? "not-allowed" : "move",
    animation,
    "--btv-intensity": String(layer.animation?.intensity ?? 1),
  } satisfies LayerStyle;
}

export function resolvePreviewAssetUrl(assetUrl: string, overlayOrigin: string): string {
  if (!assetUrl) return "";
  if (/^(https?:|data:|blob:)/i.test(assetUrl)) return assetUrl;
  if (assetUrl.startsWith("/")) return `${overlayOrigin.replace(/\/$/, "")}${assetUrl}`;
  return assetUrl;
}

function SelectionHandles({
  disabled,
  onResizePointerDown,
  onRotatePointerDown,
}: {
  disabled: boolean;
  onResizePointerDown: (handle: ResizeHandle, event: ReactPointerEvent<HTMLSpanElement>) => void;
  onRotatePointerDown: (event: ReactPointerEvent<HTMLSpanElement>) => void;
}) {
  if (disabled) return null;
  return (
    <>
      <span className="alert-rotate-handle" onPointerDown={onRotatePointerDown} />
      {(["nw", "ne", "sw", "se"] as ResizeHandle[]).map((handle) => (
        <span
          key={handle}
          className={`alert-resize-handle ${handle}`}
          onPointerDown={(event) => onResizePointerDown(handle, event)}
        />
      ))}
    </>
  );
}

export class AlertPreviewErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean; message: string }> {
  state = { failed: false, message: "" };

  static getDerivedStateFromError(error: unknown) {
    return { failed: true, message: error instanceof Error ? error.message : "Preview render failed" };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error("Alert preview render error:", error, info.componentStack);
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="alert-preview-error">
          <strong>Preview render failed</strong>
          <span>{this.state.message}</span>
        </div>
      );
    }
    return this.props.children;
  }
}

export function PreviewLayer({
  layer,
  eventType,
  testPayload,
  selected,
  playheadMs,
  overlayOrigin,
  onPointerDown,
  onResizePointerDown,
  onRotatePointerDown,
}: {
  layer: AlertLayer;
  eventType: StreamEventType;
  testPayload: TestPayload;
  selected: boolean;
  playheadMs?: number;
  overlayOrigin: string;
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onResizePointerDown: (handle: ResizeHandle, event: ReactPointerEvent<HTMLSpanElement>) => void;
  onRotatePointerDown: (event: ReactPointerEvent<HTMLSpanElement>) => void;
}) {
  const mediaUrl = layer.type === "video" || layer.type === "image" || layer.type === "gif"
    ? resolvePreviewAssetUrl(layer.assetUrl, overlayOrigin)
    : "";
  const selectionStyle: CSSProperties = selected
    ? { outline: "3px solid rgba(91, 140, 255, 0.95)", outlineOffset: 4 }
    : {};

  if (layer.type === "text") {
    return (
      <div
        onPointerDown={onPointerDown}
        style={{
          ...layerStyle(layer, playheadMs),
          ...selectionStyle,
          color: layer.color,
          fontFamily: layer.fontFamily,
          fontSize: layer.fontSize,
          fontWeight: layer.fontWeight,
          textAlign: layer.align,
          WebkitTextStroke: layer.strokeWidth ? `${layer.strokeWidth}px ${layer.strokeColor ?? "#000"}` : undefined,
          textShadow: layer.shadow,
          lineHeight: 1.05,
          whiteSpace: "pre-wrap",
        }}
      >
        {renderTemplate(layer.text, eventType, testPayload)}
        {selected && <SelectionHandles disabled={layer.locked} onResizePointerDown={onResizePointerDown} onRotatePointerDown={onRotatePointerDown} />}
      </div>
    );
  }

  if (layer.type === "shape") {
    return (
      <div
        onPointerDown={onPointerDown}
        style={{
          ...layerStyle(layer, playheadMs),
          ...selectionStyle,
          background: layer.fill,
          border: `${layer.borderWidth}px solid ${layer.borderColor}`,
          borderRadius: layer.shape === "ellipse" ? "50%" : layer.radius,
        }}
      >
        {selected && <SelectionHandles disabled={layer.locked} onResizePointerDown={onResizePointerDown} onRotatePointerDown={onRotatePointerDown} />}
      </div>
    );
  }

  if (layer.type === "audio") return null;

  if (layer.type === "particle") {
    return (
      <div onPointerDown={onPointerDown} style={{ ...layerStyle(layer, playheadMs), ...selectionStyle }}>
        <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", color: layer.color, border: `2px dashed ${layer.color}`, borderRadius: 12 }}>
          {layer.particle} particles
        </div>
        {selected && <SelectionHandles disabled={layer.locked} onResizePointerDown={onResizePointerDown} onRotatePointerDown={onRotatePointerDown} />}
      </div>
    );
  }

  if (layer.type === "browser") {
    return (
      <div onPointerDown={onPointerDown} style={{ ...layerStyle(layer, playheadMs), ...selectionStyle }}>
        <iframe
          title={layer.name}
          sandbox={layer.sandbox ? "allow-same-origin" : undefined}
          srcDoc={`<style>${layer.css}</style>${layer.html}`}
          style={{ width: "100%", height: "100%", border: 0, pointerEvents: "none", background: "transparent" }}
        />
        {selected && <SelectionHandles disabled={layer.locked} onResizePointerDown={onResizePointerDown} onRotatePointerDown={onRotatePointerDown} />}
      </div>
    );
  }

  return (
    <div onPointerDown={onPointerDown} style={{ ...layerStyle(layer, playheadMs), ...selectionStyle }}>
      {layer.assetUrl ? (
        layer.type === "video" ? (
          <video src={mediaUrl} muted={layer.muted} loop={layer.loop} autoPlay style={{ width: "100%", height: "100%", objectFit: layer.fit }} />
        ) : (
          <img src={mediaUrl} alt="" style={{ width: "100%", height: "100%", objectFit: layer.fit }} />
        )
      ) : (
        <div style={{ width: "100%", height: "100%", border: "2px dashed rgba(255,255,255,0.35)", borderRadius: 8, display: "grid", placeItems: "center", color: "#dbe6ff" }}>
          Add asset URL
        </div>
      )}
      {selected && <SelectionHandles disabled={layer.locked} onResizePointerDown={onResizePointerDown} onRotatePointerDown={onRotatePointerDown} />}
    </div>
  );
}
