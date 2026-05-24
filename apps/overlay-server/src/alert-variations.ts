import type { AlertChaosModifier, AlertLayer, AlertProject, AlertVariation, StreamEvent } from "@btv/shared";

export interface AlertVariationResolution {
  project: AlertProject;
  variation?: AlertVariation;
}

export function resolveAlertProjectVariation(
  project: AlertProject,
  event: StreamEvent,
  forcedVariationId?: string,
): AlertVariationResolution {
  const variations = project.variations.filter((variation) => variation.enabled);
  const forced = forcedVariationId ? variations.find((variation) => variation.id === forcedVariationId) : undefined;
  const selected = forced ?? variations
    .filter((variation) => variationMatchesEvent(variation, event))
    .sort((a, b) => b.priority - a.priority)[0];

  if (!selected) return { project: applyChaos(project) };

  return {
    variation: selected,
    project: applyChaos({
      ...project,
      id: `${project.id}::${selected.id}`,
      name: `${project.name} - ${selected.name}`,
      durationMs: selected.durationMs ?? project.durationMs,
      canvas: selected.canvas ?? project.canvas,
      timeline: selected.timeline ?? project.timeline,
      layers: selected.layers.length ? selected.layers : project.layers,
      variations: [],
      tags: [...new Set([...project.tags, "variation", selected.id, selected.legendary ? "legendary" : ""])].filter(Boolean),
    }, selected.legendary),
  };
}

function applyChaos(project: AlertProject, legendary = false): AlertProject {
  if (!project.chaos.enabled || !project.chaos.modifiers.length) return project;
  const chance = Math.min(100, (project.chaos.intensity * 100) + (legendary ? project.chaos.legendaryBoost : 0));
  if (Math.random() * 100 >= chance) return project;
  const modifier = project.chaos.modifiers[Math.floor(Math.random() * project.chaos.modifiers.length)]!;
  const intensity = legendary ? Math.min(1, project.chaos.intensity + 0.25) : project.chaos.intensity;
  return {
    ...project,
    layers: applyModifier(project.layers, modifier, intensity, project.durationMs),
    tags: [...new Set([...project.tags, "chaos", `chaos:${modifier}`])],
  };
}

function applyModifier(layers: AlertLayer[], modifier: AlertChaosModifier, intensity: number, durationMs: number): AlertLayer[] {
  if (modifier === "flash") {
    return [
      ...layers,
      {
        id: `chaos-flash-${Date.now()}`,
        type: "shape",
        name: "Chaos flash",
        visible: true,
        locked: true,
        startMs: 0,
        endMs: Math.min(durationMs, 420),
        x: 0,
        y: 0,
        width: 1920,
        height: 1080,
        rotation: 0,
        opacity: 0.25 + intensity * 0.45,
        scale: 1,
        blendMode: "screen",
        keyframes: [],
        shape: "rectangle",
        fill: "rgba(255,255,255,0.9)",
        borderColor: "transparent",
        borderWidth: 0,
        radius: 0,
        animation: { preset: "fade-out", delayMs: 0, durationMs: 420, easing: "ease-out", intensity: 1, loop: false },
      },
    ];
  }

  return layers.map((layer) => {
    if (layer.type === "audio") return layer;
    if (modifier === "shake") {
      return { ...layer, animation: { preset: "wiggle", delayMs: 0, durationMs: 220, easing: "ease-in-out", intensity: 0.7 + intensity * 2, loop: true } } as AlertLayer;
    }
    if (modifier === "scale_punch") {
      return { ...layer, animation: { preset: "pop-in", delayMs: 0, durationMs: 380, easing: "ease-out", intensity: 0.8 + intensity * 1.8, loop: false } } as AlertLayer;
    }
    if (modifier === "hue_shift") {
      return {
        ...layer,
        filter: {
          blur: layer.filter?.blur ?? 0,
          brightness: layer.filter?.brightness ?? 1,
          contrast: layer.filter?.contrast ?? 1,
          saturation: Math.min(3, (layer.filter?.saturation ?? 1) + intensity),
          hueRotate: (layer.filter?.hueRotate ?? 0) + Math.round(120 + intensity * 180),
          glow: layer.filter?.glow ?? 0,
          glowColor: layer.filter?.glowColor ?? "rgba(91, 140, 255, 0.9)",
        },
      } as AlertLayer;
    }
    return layer;
  });
}

function variationMatchesEvent(variation: AlertVariation, event: StreamEvent): boolean {
  const condition = variation.condition;
  if (condition.eventType && condition.eventType !== event.type) return false;
  if (condition.minAmount != null && (event.amount ?? 0) < condition.minAmount) return false;
  if (condition.userRole && !eventHasRole(event, condition.userRole)) return false;
  if (condition.channelPointTitle) {
    const title = String(event.payload.rewardTitle ?? event.payload.channelPointTitle ?? "");
    if (title.toLowerCase() !== condition.channelPointTitle.toLowerCase()) return false;
  }
  if (condition.randomChance != null && Math.random() * 100 >= condition.randomChance) return false;
  return true;
}

function eventHasRole(event: StreamEvent, role: string): boolean {
  const roles = event.payload.roles;
  return Array.isArray(roles) && roles.map(String).includes(role);
}
