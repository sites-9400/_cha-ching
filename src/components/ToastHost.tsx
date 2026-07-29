import { useEffect, useRef, useState } from "react";
import { onToast, type ToastMsg } from "../lib/toast";

const MAX_TOASTS = 3;

/** Global toast stack — subscribes to lib/toast and renders above the tab bar.
 *  Mount once at the app root so it's available for both PinPad and the app. */
export default function ToastHost() {
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  function dismiss(id: number) {
    const t = timers.current.get(id);
    if (t) clearTimeout(t);
    timers.current.delete(id);
    setToasts((prev) => prev.filter((x) => x.id !== id));
  }

  useEffect(() => onToast((t) => {
    setToasts((prev) => [...prev, t].slice(-MAX_TOASTS));
    if (t.duration > 0) {
      timers.current.set(t.id, setTimeout(() => dismiss(t.id), t.duration));
    }
  }), []);

  useEffect(() => () => {
    for (const t of timers.current.values()) clearTimeout(t);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-20 inset-x-0 z-[60] flex flex-col items-center gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          onClick={() => dismiss(t.id)}
          className="pointer-events-auto bg-stone-800 text-white text-sm rounded-xl px-4 py-2.5 shadow-lg flex items-center gap-3"
        >
          <span>{t.text}</span>
          {t.action && (
            <button
              onClick={(e) => { e.stopPropagation(); t.action!.run(); dismiss(t.id); }}
              className="font-semibold text-emerald-400"
            >{t.action.label}</button>
          )}
        </div>
      ))}
    </div>
  );
}
