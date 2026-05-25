export interface ObsSceneBody {
  sceneName?: string;
}

export interface ObsSourceVisibilityBody {
  sceneName?: string;
  sourceName?: string;
  visible?: boolean;
}

export interface ObsTextBody {
  inputName?: string;
  text?: string;
}

export interface ObsInputSettingsBody {
  inputName?: string;
  inputSettings?: Record<string, unknown>;
  overlay?: boolean;
}

export interface ObsSourceMotionBody {
  sceneName?: string;
  sourceName?: string;
  mode?: "set" | "dvd" | "path";
  durationMs?: number;
  fps?: number;
  visible?: boolean;
  restore?: boolean;
  boundsWidth?: number;
  boundsHeight?: number;
  speedX?: number;
  speedY?: number;
  x?: number;
  y?: number;
  scale?: number;
  width?: number;
  height?: number;
  path?: Array<{ x: number; y: number; scale?: number }>;
}

export type ObsBrowserSourceShape = "rectangle" | "rounded" | "circle";

export interface ObsBrowserSourceLayout {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  shape: ObsBrowserSourceShape;
  borderRadius: number;
  cropTop: number;
  cropRight: number;
  cropBottom: number;
  cropLeft: number;
  opacity: number;
  visible: boolean;
  locked: boolean;
}

export interface ObsBrowserSourceCanvas {
  width: number;
  height: number;
}

export interface ObsBrowserSourceLayoutsBody {
  canvas?: ObsBrowserSourceCanvas;
  layouts?: ObsBrowserSourceLayout[];
}

export interface ObsBrowserSourceLayoutApplyBody extends ObsBrowserSourceLayoutsBody {
  sceneName?: string;
}
