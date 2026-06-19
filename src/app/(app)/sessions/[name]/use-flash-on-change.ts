import { type RefObject, useEffect } from "react";

// Replays the `player-row-flash` keyframe animation whenever `active` flips to
// true. The triggering event lives in the parent (a player just changed); the
// child only sees a prop, so an effect that imperatively restarts the CSS
// animation is the idiomatic React shape. Removing the class, forcing a reflow,
// then re-adding it restarts the keyframes even if it was already applied.
export function useFlashOnChange<T extends HTMLElement>(
  ref: RefObject<T | null>,
  active: boolean | undefined,
): void {
  useEffect(() => {
    if (!active) return;
    const el = ref.current;
    if (!el) return;
    el.classList.remove("player-row-flash");
    void el.offsetWidth;
    el.classList.add("player-row-flash");
  }, [ref, active]);
}
