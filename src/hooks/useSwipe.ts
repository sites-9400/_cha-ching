import { useRef } from "react";

/** Horizontal swipe detection for touch: a quick, mostly-horizontal swipe
 *  (≥ 60 px, |dx| ≥ 1.5 × |dy|, < 700 ms) fires onLeft / onRight. Vertical
 *  scrolling is untouched. The click that can follow a swipe is swallowed so
 *  a swipe that ends on a line never ticks it. Gestures starting in inputs or
 *  horizontally scrollable strips are ignored. */
export function useSwipe(onLeft: () => void, onRight: () => void) {
  const start = useRef<{ x: number; y: number; t: number } | null>(null);
  const swallow = useRef(false);
  return {
    onTouchStart: (e: React.TouchEvent) => {
      const el = e.target as HTMLElement;
      if (e.touches.length !== 1 || el.closest("input, textarea, select, [data-no-swipe]")) { start.current = null; return; }
      const t = e.touches[0];
      start.current = { x: t.clientX, y: t.clientY, t: Date.now() };
    },
    onTouchEnd: (e: React.TouchEvent) => {
      const s = start.current; start.current = null;
      if (!s) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - s.x, dy = t.clientY - s.y;
      if (Date.now() - s.t > 700 || Math.abs(dx) < 60 || Math.abs(dx) < 1.5 * Math.abs(dy)) return;
      swallow.current = true;
      window.setTimeout(() => { swallow.current = false; }, 400);
      if (dx < 0) onLeft(); else onRight();
    },
    onClickCapture: (e: React.MouseEvent) => {
      if (swallow.current) { e.preventDefault(); e.stopPropagation(); swallow.current = false; }
    },
  };
}
