import type { Theme, ThemeLayoutMeta } from "@btv/shared";
import { defaultThemeLayout } from "./layoutCss";

/** Read layout from theme meta or legacy CSS heuristics. */
export function parseThemeLayout(theme: Theme): ThemeLayoutMeta {
  if (theme.layout) return { ...defaultThemeLayout(), ...theme.layout };

  const css = theme.css;
  const widthMatch = css.match(/\.btv-alert-slot\s*\{[^}]*width:\s*(\d+)px/i);
  const width = widthMatch ? Number(widthMatch[1]) : 420;

  if (/bottom:\s*\d+px.*left:\s*50%|left:\s*50%.*bottom:/is.test(css)) {
    return { anchor: "bottom-center", offsetX: 0, offsetY: 80, width };
  }
  if (/top:\s*(\d+)px/is.test(css) && /left:\s*50%/i.test(css)) {
    const top = css.match(/top:\s*(\d+)px/i);
    return {
      anchor: "top-center",
      offsetX: 0,
      offsetY: top ? Number(top[1]) : 80,
      width,
    };
  }
  if (/position:\s*fixed.*bottom:/is.test(css) && /\.alert-card/i.test(css)) {
    return { anchor: "bottom-center", offsetX: 0, offsetY: 80, width: 320 };
  }

  return defaultThemeLayout();
}
