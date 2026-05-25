const DEFAULT_THEME = {
  fontFamily: '"Segoe UI", system-ui, sans-serif',
  textColor: "#ffffff",
  mutedColor: "rgba(255,255,255,0.72)",
  accentColor: "#9147ff",
  panelBackground: "rgba(0,0,0,0.6)",
  itemBackground: "rgba(255,255,255,0.07)",
  borderColor: "rgba(255,255,255,0.12)",
  borderRadius: 12,
  shadow: 35,
  glow: 0,
  pulse: false,
  backgroundImage: "",
  backgroundOpacity: 0.18,
  backgroundBlur: 0,
  widgets: {},
};

const TARGET_SELECTOR = {
  alerts: "#alerts",
  chat: ".chat-widget",
  goals: ".goal-widget",
  ticker: ".ticker-widget",
  eventList: ".event-list-widget",
  nowPlaying: ".now-playing-widget",
};

applyOverlayTheme();

async function applyOverlayTheme() {
  try {
    const theme = await fetch("/api/overlay-theme", { cache: "no-store" }).then((r) => r.ok ? r.json() : DEFAULT_THEME);
    apply(theme ?? DEFAULT_THEME);
  } catch {
    apply(DEFAULT_THEME);
  }
}

function apply(theme) {
  const root = document.documentElement;
  applyVars(root, theme, DEFAULT_THEME);
  root.style.setProperty("--btv-overlay-bg-opacity", String(number(theme.backgroundOpacity, DEFAULT_THEME.backgroundOpacity)));
  root.style.setProperty("--btv-overlay-bg-blur", `${number(theme.backgroundBlur, DEFAULT_THEME.backgroundBlur)}px`);
  document.body.classList.toggle("btv-theme-pulse", theme.pulse === true);
  document.body.dataset.overlayThemeReady = "true";
  applyBackground(document.body, theme.backgroundImage);

  for (const [target, selector] of Object.entries(TARGET_SELECTOR)) {
    const element = document.querySelector(selector);
    const config = theme.widgets?.[target];
    if (!element || !config) continue;
    element.classList.toggle("btv-theme-disabled", config.enabled === false);
    element.classList.toggle("btv-theme-pulse-local", config.pulse === true);
    if (config.enabled === false) {
      element.removeAttribute("data-btv-themed");
      continue;
    }
    element.dataset.btvThemed = "true";
    const localConfig = compact(config);
    if (target === "chat") {
      delete localConfig.textColor;
      delete localConfig.mutedColor;
    }
    applyVars(element, { ...theme, ...localConfig }, theme);
    element.style.setProperty("--btv-overlay-bg-opacity", String(number(config.backgroundOpacity, theme.backgroundOpacity ?? DEFAULT_THEME.backgroundOpacity)));
    element.style.setProperty("--btv-overlay-bg-blur", `${number(config.backgroundBlur, theme.backgroundBlur ?? DEFAULT_THEME.backgroundBlur)}px`);
    applyBackground(element, config.backgroundImage);
  }
}

function applyVars(element, values, fallback) {
  const accent = safe(values.accentColor, fallback.accentColor ?? DEFAULT_THEME.accentColor);
  element.style.setProperty("--btv-overlay-font", safe(values.fontFamily, fallback.fontFamily ?? DEFAULT_THEME.fontFamily));
  element.style.setProperty("--btv-overlay-text", safe(values.textColor, fallback.textColor ?? DEFAULT_THEME.textColor));
  element.style.setProperty("--btv-overlay-muted", safe(values.mutedColor, fallback.mutedColor ?? DEFAULT_THEME.mutedColor));
  element.style.setProperty("--btv-overlay-accent", accent);
  element.style.setProperty("--btv-overlay-panel-bg", safe(values.panelBackground, fallback.panelBackground ?? DEFAULT_THEME.panelBackground));
  element.style.setProperty("--btv-overlay-item-bg", safe(values.itemBackground, fallback.itemBackground ?? DEFAULT_THEME.itemBackground));
  element.style.setProperty("--btv-overlay-border", safe(values.borderColor, fallback.borderColor ?? DEFAULT_THEME.borderColor));
  element.style.setProperty("--btv-overlay-radius", `${number(values.borderRadius, fallback.borderRadius ?? DEFAULT_THEME.borderRadius)}px`);
  element.style.setProperty("--btv-overlay-shadow", `0 18px 50px rgba(0,0,0,${number(values.shadow, fallback.shadow ?? DEFAULT_THEME.shadow) / 100})`);
  element.style.setProperty("--btv-overlay-glow", `0 0 ${number(values.glow, fallback.glow ?? DEFAULT_THEME.glow)}px ${accent}`);
}

function applyBackground(element, image) {
  if (typeof image === "string" && image.trim()) {
    element.classList.add("btv-has-overlay-bg");
    element.style.setProperty("--btv-overlay-bg-image", `url("${image.replace(/"/g, "%22")}")`);
  } else {
    element.classList.remove("btv-has-overlay-bg");
    element.style.removeProperty("--btv-overlay-bg-image");
  }
}

function compact(config) {
  return Object.fromEntries(Object.entries(config).filter(([, value]) => value !== undefined && value !== ""));
}

function safe(value, fallback) {
  return typeof value === "string" && value.trim() && !/[;{}<>]/.test(value) ? value.trim() : fallback;
}

function number(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
