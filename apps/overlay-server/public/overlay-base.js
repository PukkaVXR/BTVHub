import { OverlayClient, clearMediaEffect, playSoundEffect, renderAlert, stopAllSounds } from "/js/overlay-client.js";

const params = new URLSearchParams(location.search);
const channels = (params.get("channels") || "*").split(",").filter(Boolean);

const client = new OverlayClient({
  channels,
  onMessage: handleMessage,
  onStateChange: (state) => {
    document.body.dataset.wsState = state;
  },
});

client.connect();

const alertContainer = document.getElementById("alerts") || document.body;
const chatContainer = document.getElementById("chat-messages");
const goalBar = document.getElementById("goal-bar");
const goalLabel = document.getElementById("goal-label");
const goalCurrent = document.getElementById("goal-current");
const goalTarget = document.getElementById("goal-target");
const goalFill = document.getElementById("goal-fill");
const tickerList = document.getElementById("ticker-list");
const nowPlaying = document.getElementById("now-playing");
const effectLayer = document.getElementById("effect-layer");

let activeAlertCleanup = null;

function handleMessage(msg) {
  switch (msg.kind) {
    case "alert:play":
      activeAlertCleanup?.();
      activeAlertCleanup = renderAlert(alertContainer, msg.alert);
      break;
    case "chat:message":
      appendChat(msg.message);
      break;
    case "goal:update":
      updateGoal(msg.goal);
      break;
    case "ticker:event":
      appendTicker(msg.event);
      break;
    case "widget:nowPlaying":
      updateNowPlaying(msg.track);
      break;
    case "effect:play":
      playEffect(msg.effect);
      break;
    case "overlay:emergency":
      handleEmergency(msg.action);
      break;
  }
}

function handleEmergency(action) {
  if (action === "stop_sounds" || action === "all") {
    stopAllSounds();
  }
  if (action === "hide_overlays" || action === "all") {
    document.body.dataset.emergencyHidden = "true";
    document.body.style.visibility = "hidden";
  }
  if (action === "reset_overlay_state" || action === "all") {
    activeAlertCleanup?.();
    activeAlertCleanup = null;
    clearMediaEffect();
    stopAllSounds();
    if (effectLayer) effectLayer.className = "";
    if (alertContainer && alertContainer !== document.body) alertContainer.innerHTML = "";
    delete document.body.dataset.emergencyHidden;
    document.body.style.visibility = "";
  }
}

function appendChat(m) {
  if (!chatContainer) return;
  const el = document.createElement("div");
  el.className = "chat-line";
  el.innerHTML = `<span class="chat-user">${escapeHtml(m.user.displayName)}:</span> ${escapeHtml(m.text)}`;
  chatContainer.appendChild(el);
  while (chatContainer.children.length > 20) {
    chatContainer.firstChild?.remove();
  }
  setTimeout(() => el.classList.add("fade-out"), 7000);
  setTimeout(() => el.remove(), 8000);
}

function updateGoal(g) {
  if (!goalBar) return;
  if (goalLabel) goalLabel.textContent = g.label;
  if (goalCurrent) goalCurrent.textContent = String(g.current);
  if (goalTarget) goalTarget.textContent = String(g.target);
  if (goalFill) {
    const pct = Math.min(100, (g.current / g.target) * 100);
    goalFill.style.width = `${pct}%`;
  }
}

function appendTicker(ev) {
  if (!tickerList) return;
  const li = document.createElement("li");
  const label = { follow: "Follow", sub: "Sub", cheer: "Cheer", raid: "Raid" }[ev.type] || ev.type;
  li.textContent = `${label}: ${ev.user?.displayName ?? "Someone"}`;
  tickerList.prepend(li);
  while (tickerList.children.length > 15) tickerList.lastChild?.remove();
}

function updateNowPlaying(track) {
  if (!nowPlaying) return;
  if (!track) {
    nowPlaying.innerHTML = '<span class="np-idle">Nothing playing</span>';
    return;
  }
  nowPlaying.innerHTML = `
    ${track.albumArtUrl ? `<img class="np-art" src="${track.albumArtUrl}" alt="" />` : ""}
    <div class="np-info">
      <div class="np-title">${escapeHtml(track.title)}</div>
      <div class="np-artist">${escapeHtml(track.artist)}</div>
    </div>`;
}

function playEffect(effect) {
  if (!effectLayer) return;
  if (effect.type === "visual") {
    const style = String(effect.config.style ?? "flash");
    effectLayer.className = `effect-active effect-${style}`;
    setTimeout(() => (effectLayer.className = ""), Number(effect.config.durationMs ?? 800));
  }
  if (effect.type === "soundboard" && effect.config.soundUrl) {
    playSoundEffect({ soundUrl: String(effect.config.soundUrl) });
  }
}

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Audio unlock for OBS
document.addEventListener("click", () => {
  const ctx = window.__btvAudioCtx || new AudioContext();
  window.__btvAudioCtx = ctx;
  if (ctx.state === "suspended") ctx.resume();
}, { once: true });
