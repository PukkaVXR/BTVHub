import type { ThemeAnchor, ThemeLayoutMeta } from "@btv/shared";
import { defaultThemeLayout } from "./layoutCss";

export type ThemeLayoutId = "slideUp" | "slideLeft" | "pop" | "minimal";

export interface ThemeVisualModel {
  animation: ThemeLayoutId;
  placement: ThemeLayoutMeta;
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  fontFamily: string;
  borderRadius: number;
  glow: boolean;
  durationMs: number;
  imageUrl?: string;
}

export const defaultVisualModel = (): ThemeVisualModel => ({
  animation: "slideUp",
  placement: defaultThemeLayout(),
  primaryColor: "#9147ff",
  accentColor: "#ffffff",
  backgroundColor: "rgba(20, 10, 40, 0.92)",
  fontFamily: "'Segoe UI', system-ui, sans-serif",
  borderRadius: 12,
  glow: true,
  durationMs: 5000,
});

export type { ThemeAnchor, ThemeLayoutMeta };