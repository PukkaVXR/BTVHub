import type { ThemeLayoutMeta } from "@btv/shared";

export const defaultThemeLayout = (): ThemeLayoutMeta => ({
  anchor: "top-center",
  offsetX: 0,
  offsetY: 80,
  width: 420,
});

export function layoutSlotCss(layout: ThemeLayoutMeta): string {
  const { anchor, offsetX, offsetY, width } = layout;
  const base = [
    "position: fixed",
    `width: ${width}px`,
    "max-width: calc(100vw - 48px)",
    "pointer-events: none",
    "z-index: 10",
    "box-sizing: border-box",
  ];

  switch (anchor) {
    case "top-left":
      return [...base, `top: ${offsetY}px`, `left: ${24 + offsetX}px`].join("; ") + ";";
    case "top-center":
      return [
        ...base,
        `top: ${offsetY}px`,
        "left: 50%",
        `margin-left: ${offsetX}px`,
        "transform: translateX(-50%)",
      ].join("; ") + ";";
    case "top-right":
      return [...base, `top: ${offsetY}px`, `right: ${24 - offsetX}px`].join("; ") + ";";
    case "center":
      return [
        ...base,
        "top: 50%",
        "left: 50%",
        `margin-left: ${offsetX}px`,
        `margin-top: ${offsetY}px`,
        "transform: translate(-50%, -50%)",
      ].join("; ") + ";";
    case "bottom-left":
      return [...base, `bottom: ${offsetY}px`, `left: ${24 + offsetX}px`].join("; ") + ";";
    case "bottom-center":
      return [
        ...base,
        `bottom: ${offsetY}px`,
        "left: 50%",
        `margin-left: ${offsetX}px`,
        "transform: translateX(-50%)",
      ].join("; ") + ";";
    case "bottom-right":
      return [...base, `bottom: ${offsetY}px`, `right: ${24 - offsetX}px`].join("; ") + ";";
    default:
      return layoutSlotCss(defaultThemeLayout());
  }
}
