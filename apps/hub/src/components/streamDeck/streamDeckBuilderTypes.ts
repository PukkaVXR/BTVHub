export type StreamDeckBuilderAction =
  | "macro"
  | "sourceGroup"
  | "emergency"
  | "alertControl"
  | "testAlert"
  | "obsScene"
  | "sourceVisibility"
  | "sourceMotion"
  | "text"
  | "inputSettings"
  | "status";

export interface StreamDeckBuilderPatch {
  keyTitle: string;
  action: StreamDeckBuilderAction;
  color: string;
  iconLabel: string;
  emergencyAction: string;
  alertAction: string;
  testEventType: string;
  sourceVisible: boolean;
  motionMode: "dvd" | "set" | "path";
  motionX: number;
  motionY: number;
  motionWidth: number;
  motionHeight: number;
  motionDurationMs: number;
  motionSpeedX: number;
  motionSpeedY: number;
  motionRestore: boolean;
  textValue: string;
  inputSettingsJson: string;
}

export interface StreamDeckActionPreset {
  id: string;
  title: string;
  description: string;
  action: StreamDeckBuilderAction;
  color: string;
  iconLabel: string;
  configure?: () => Partial<StreamDeckBuilderPatch>;
}

export interface StreamDeckActionGroup {
  title: string;
  actions: Array<{
    value: StreamDeckBuilderAction;
    label: string;
    detail: string;
  }>;
}

export interface StreamDeckBehaviorValues {
  macroId: string;
  sourceGroupId: string;
  sceneName: string;
  sourceName: string;
  sourceVisible: boolean;
  motionMode: "dvd" | "set" | "path";
  motionX: number;
  motionY: number;
  motionWidth: number;
  motionHeight: number;
  motionDurationMs: number;
  motionSpeedX: number;
  motionSpeedY: number;
  motionRestore: boolean;
  textInputName: string;
  textValue: string;
  inputSettingsJson: string;
  emergencyAction: string;
  alertAction: string;
  testEventType: string;
  statusEndpoint: string;
}

export interface StreamDeckKeyAppearancePatch {
  keyTitle: string;
  keyColor: string;
  iconLabel: string;
}

export type StreamDeckDesignTab = "text" | "background" | "style";
export type StreamDeckBackgroundFit = "cover" | "contain" | "stretch";
export type StreamDeckImageEffect = "none" | "glow" | "vignette" | "scanlines" | "glass";
export type StreamDeckTextPlacement = "bottom" | "center" | "top";

export interface StreamDeckDesignValues {
  keyTitle: string;
  iconLabel: string;
  keyColor: string;
  showTitle: boolean;
  titleColor: string;
  fontSize: number;
  backgroundImageDataUrl: string;
  backgroundFit: StreamDeckBackgroundFit;
  backgroundOpacity: number;
  backgroundPositionX: number;
  backgroundPositionY: number;
  imageEffect: StreamDeckImageEffect;
  showArtworkOverlay: boolean;
  badgeText: string;
  subtitle: string;
  textPlacement: StreamDeckTextPlacement;
  designTab: StreamDeckDesignTab;
}

export interface StreamDeckGeneratedRequest {
  method: "GET" | "POST";
  url: string;
  headers: Record<string, string>;
  body: string;
  notes: string[];
  warnings: string[];
}
