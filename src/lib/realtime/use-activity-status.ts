import { useEffect, useState } from "react";

// User interactions that count as "still watching". Pointer/scroll/key/tap
// cover active use; `visibilitychange` covers returning to the tab (e.g. after
// unlocking the phone), which is the key mobile-glance signal.
const ACTIVITY_EVENTS = [
  "pointermove",
  "pointerdown",
  "scroll",
  "keydown",
  "touchstart",
  "click",
] as const;

export const DEFAULT_IDLE_TIMEOUT_MS = 10 * 60 * 1000;

// Returns `true` while the user has interacted within `timeoutMs`, flipping to
// `false` once that window elapses with no interaction. A hidden tab keeps
// counting down; becoming visible again counts as interaction and resumes.
export function useActivityStatus(
  timeoutMs: number = DEFAULT_IDLE_TIMEOUT_MS,
): boolean {
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let timer: ReturnType<typeof setTimeout>;

    const markActive = () => {
      setActive(true);
      clearTimeout(timer);
      timer = setTimeout(() => setActive(false), timeoutMs);
    };

    const onVisibility = () => {
      // Only a return-to-visible counts as activity; going hidden must not
      // reset the timer, so a backgrounded tab still goes idle.
      if (document.visibilityState === "visible") markActive();
    };

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, markActive, { passive: true });
    }
    document.addEventListener("visibilitychange", onVisibility);

    markActive();

    return () => {
      clearTimeout(timer);
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, markActive);
      }
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [timeoutMs]);

  return active;
}
