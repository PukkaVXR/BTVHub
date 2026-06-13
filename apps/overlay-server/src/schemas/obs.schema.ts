import { z } from "@btv/shared";

export const ObsSceneBodySchema = z.object({ sceneName: z.string().optional() });
export type ObsSceneBody = z.output<typeof ObsSceneBodySchema>;

export const ObsSourceVisibilityBodySchema = z.object({
  sceneName: z.string().optional(),
  sourceName: z.string().optional(),
  visible: z.boolean().optional(),
});
export type ObsSourceVisibilityBody = z.output<typeof ObsSourceVisibilityBodySchema>;

export const ObsTextBodySchema = z.object({ inputName: z.string().optional(), text: z.string().optional() });
export type ObsTextBody = z.output<typeof ObsTextBodySchema>;

export const ObsInputSettingsBodySchema = z.object({
  inputName: z.string().optional(),
  inputSettings: z.record(z.unknown()).optional(),
  overlay: z.boolean().optional(),
});
export type ObsInputSettingsBody = z.output<typeof ObsInputSettingsBodySchema>;

export const ObsSourceMotionBodySchema = z.object({
  sceneName: z.string().optional(),
  sourceName: z.string().optional(),
  mode: z.enum(["set", "dvd", "path"]).optional(),
  durationMs: z.coerce.number().optional(),
  fps: z.coerce.number().optional(),
  visible: z.boolean().optional(),
  restore: z.boolean().optional(),
  boundsWidth: z.coerce.number().optional(),
  boundsHeight: z.coerce.number().optional(),
  speedX: z.coerce.number().optional(),
  speedY: z.coerce.number().optional(),
  x: z.coerce.number().optional(),
  y: z.coerce.number().optional(),
  scale: z.coerce.number().optional(),
  width: z.coerce.number().optional(),
  height: z.coerce.number().optional(),
  path: z.array(z.object({ x: z.coerce.number(), y: z.coerce.number(), scale: z.coerce.number().optional() })).optional(),
});
export type ObsSourceMotionBody = z.output<typeof ObsSourceMotionBodySchema>;

export type ObsBrowserSourceShape = "rectangle" | "rounded" | "circle";

export const ObsBrowserSourceCanvasSchema = z.object({
  width: z.coerce.number(),
  height: z.coerce.number(),
});

export const ObsBrowserSourceLayoutSchema = z.object({
  id: z.string(),
  x: z.coerce.number(),
  y: z.coerce.number(),
  width: z.coerce.number(),
  height: z.coerce.number(),
  rotation: z.coerce.number(),
  shape: z.enum(["rectangle", "rounded", "circle"]),
  borderRadius: z.coerce.number(),
  cropTop: z.coerce.number(),
  cropRight: z.coerce.number(),
  cropBottom: z.coerce.number(),
  cropLeft: z.coerce.number(),
  opacity: z.coerce.number(),
  visible: z.boolean(),
  locked: z.boolean(),
});

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

export const ObsBrowserSourceLayoutsBodySchema = z.object({
  canvas: ObsBrowserSourceCanvasSchema.optional(),
  layouts: z.array(ObsBrowserSourceLayoutSchema).optional(),
});
export type ObsBrowserSourceLayoutsBody = z.output<typeof ObsBrowserSourceLayoutsBodySchema>;

export const ObsBrowserSourceLayoutApplyBodySchema = ObsBrowserSourceLayoutsBodySchema.extend({ sceneName: z.string().optional() });
export type ObsBrowserSourceLayoutApplyBody = z.output<typeof ObsBrowserSourceLayoutApplyBodySchema>;
