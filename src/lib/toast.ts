export interface ToastAction { label: string; run: () => void }
export interface ToastMsg { id: number; text: string; action?: ToastAction; duration: number }

type Listener = (t: ToastMsg) => void;
let listener: Listener | null = null;
let nextId = 1;
let lastText = "";
let lastAt = 0;

/** Fire a toast from anywhere — components, catch handlers, global listeners.
 *  duration 0 = sticky until dismissed. Identical texts within 5s are
 *  deduped so a burst of sync errors shows once. */
export function showToast(text: string, opts?: { action?: ToastAction; duration?: number }): void {
  const now = Date.now();
  if (text === lastText && now - lastAt < 5000) return;
  lastText = text;
  lastAt = now;
  listener?.({ id: nextId++, text, action: opts?.action, duration: opts?.duration ?? 4000 });
}

export function onToast(l: Listener): () => void {
  listener = l;
  return () => { if (listener === l) listener = null; };
}

/** Test seam: reset the dedupe memory. */
export function resetToastDedupe(): void {
  lastText = "";
  lastAt = 0;
}
