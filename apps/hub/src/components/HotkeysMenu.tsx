import { useEffect, useRef } from "react";
import { GLOBAL_HOTKEYS, isEditableHotkeyTarget, matchesHotkey } from "../lib/hotkeys";

const GROUPS = ["Navigation", "Live control", "Emergency", "Editor"] as const;

export function HotkeysMenu() {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const openHotkey = GLOBAL_HOTKEYS.find((hotkey) => hotkey.id === "hotkeys-menu")!;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableHotkeyTarget(event.target) || !matchesHotkey(event, openHotkey.keys)) return;
      event.preventDefault();
      if (detailsRef.current) detailsRef.current.open = !detailsRef.current.open;
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openHotkey.keys]);

  return (
    <details ref={detailsRef} className="hotkeys-menu">
      <summary className="hotkeys-menu__trigger" aria-label="Open keyboard shortcuts">
        <span>Hotkeys</span>
        <kbd>{openHotkey.keys.join(" ")}</kbd>
      </summary>
      <div className="hotkeys-menu__panel">
        <div className="hotkeys-menu__header">
          <strong>Keyboard shortcuts</strong>
          <p>Global live controls ignore typing in forms so your text inputs stay calm.</p>
        </div>
        <div className="hotkeys-menu__groups">
          {GROUPS.map((group) => {
            const hotkeys = GLOBAL_HOTKEYS.filter((hotkey) => hotkey.group === group);
            if (!hotkeys.length) return null;
            return (
              <section className="hotkeys-menu__group" key={group}>
                <h3>{group}</h3>
                {hotkeys.map((hotkey) => (
                  <div className="hotkeys-menu__item" key={hotkey.id}>
                    <span>
                      <strong>{hotkey.label}</strong>
                      <small>{hotkey.description}</small>
                    </span>
                    <span className="hotkeys-menu__keys" aria-label={hotkey.keys.join(" plus ")}>
                      {hotkey.keys.map((key) => (
                        <kbd key={key}>{key}</kbd>
                      ))}
                    </span>
                  </div>
                ))}
              </section>
            );
          })}
        </div>
      </div>
    </details>
  );
}
