import type { StreamEvent, ThemeLayoutMeta } from "@btv/shared";
import { layoutSlotCss } from "./layoutCss";
import type { ThemeLayoutId, ThemeVisualModel } from "./types";

const layoutKeyframes: Record<ThemeLayoutId, string> = {
  slideUp: `@keyframes btv-in { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: translateY(0); } }`,
  slideLeft: `@keyframes btv-in { from { opacity: 0; transform: translateX(-60px); } to { opacity: 1; transform: translateX(0); } }`,
  pop: `@keyframes btv-in { 0% { opacity: 0; transform: scale(0.6); } 70% { transform: scale(1.05); } 100% { opacity: 1; transform: scale(1); } }`,
  minimal: `@keyframes btv-in { from { opacity: 0; } to { opacity: 1; } }`,
};

export function buildTheme(model: ThemeVisualModel): {
  html: string;
  css: string;
  js: string;
  durationMs: number;
  layout: ThemeLayoutMeta;
} {
  const glow = model.glow
    ? `box-shadow: 0 0 24px ${model.primaryColor}88, 0 8px 32px rgba(0,0,0,0.4);`
    : "box-shadow: 0 8px 24px rgba(0,0,0,0.35);";

  const bgImage = model.imageUrl
    ? `background-image: linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5)), url('${model.imageUrl.replace(/'/g, "%27")}'); background-size: cover; background-position: center;`
    : "";

  const html = `<div class="alert-card">
  <h1 class="alert-title"></h1>
  <p class="alert-subtitle"></p>
</div>`;

  const css = `${layoutKeyframes[model.animation]}
.btv-alert-slot { ${layoutSlotCss(model.placement)} }
.btv-alert-root { font-family: ${model.fontFamily}; width: 100%; }
.alert-card {
  width: 100%;
  box-sizing: border-box;
  ${bgImage}
  background-color: ${model.backgroundColor};
  color: ${model.accentColor};
  border-radius: ${model.borderRadius}px;
  border-left: 4px solid ${model.primaryColor};
  padding: 20px 28px;
  min-width: 280px;
  ${glow}
  animation: btv-in 0.45s ease-out;
}
.alert-title {
  margin: 0;
  font-size: 1.5rem;
  color: ${model.primaryColor};
}
.alert-subtitle {
  margin: 8px 0 0;
  font-size: 1rem;
  opacity: 0.9;
}`;

  const js = `function onShow(event, root, onHide) {
  var title = root.querySelector('.alert-title');
  var sub = root.querySelector('.alert-subtitle');
  var name = event.user && event.user.displayName ? event.user.displayName : 'Someone';
  var labels = {
    follow: 'just followed!',
    sub: 'subscribed!',
    cheer: 'cheered ' + (event.amount || 0) + ' bits!',
    raid: 'is raiding!',
    gift_sub: 'gifted a sub!',
    channel_points: 'used channel points!',
    chat: 'said in chat',
  };
  if (title) title.textContent = name;
  if (sub) sub.textContent = labels[event.type] || event.type;
}`;

  return { html, css, js, durationMs: model.durationMs, layout: model.placement };
}

export function mockEvent(type: StreamEvent["type"]): StreamEvent {
  return {
    id: "preview",
    source: "manual",
    type,
    user: { id: "1", displayName: "PreviewUser", login: "preview" },
    message: "Thanks for watching!",
    amount: type === "cheer" ? 500 : undefined,
    payload: {},
    at: new Date().toISOString(),
  };
}
