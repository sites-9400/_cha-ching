# Audit batch 3 — Feedback & offline UX

**Date:** 2026-07-29 · **Status:** Approved (audit remediation, Eve: "go do by batch")

Fixes the app's feedback blind spots: failed writes are invisible, dialogs
hang offline awaiting server acks, expense delete has no undo, and a
deployed update needs a full app relaunch to arrive.

## 1. Toast plumbing (new)

**`src/lib/toast.ts`** (new, pure, testable):

```ts
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
```

**`src/components/ToastHost.tsx`** (new): subscribes via `onToast`, keeps a
stack (max ~3), auto-dismisses after `duration` ms (`duration === 0` stays
until tapped). Fixed at bottom center above the tab bar
(`fixed bottom-20 inset-x-0 z-[60] flex flex-col items-center gap-2
pointer-events-none`), each toast
`pointer-events-auto bg-stone-800 text-white text-sm rounded-xl px-4 py-2.5
shadow-lg flex items-center gap-3` with the optional action as
`<button className="font-semibold text-emerald-400">{label}</button>` that
runs the action and dismisses. Tapping the toast body dismisses it. (No
`.dark` additions — stone-800/white reads fine in both themes.)

**`src/App.tsx`**: render `<ToastHost />` once at the root (outside the auth
gate, alongside whatever is returned — read the file and place it so it
mounts for both PinPad and the app).

**Test** `src/lib/toast.test.ts` (new): listener receives fired toast;
identical text within window is deduped (use `resetToastDedupe` between
cases); different text passes; action/duration pass through.

## 2. Global failure surfacing

**`src/main.tsx`**: after render, add:

```ts
window.addEventListener("unhandledrejection", (e) => {
  console.error("[unhandled]", e.reason);
  showToast("Something didn't save — check your connection");
});
```

**Hooks** — `src/hooks/useCollection.ts`, `useDoc.ts`,
`useCollectionGroup.ts`: add the error callback to each `onSnapshot` call:

```ts
      (err) => {
        console.error("[sync]", path, err);
        showToast("Sync error — check connection or reload");
      },
```

(For `useCollectionGroup` log `groupId` instead of `path`.)

## 3. PWA update prompt

**`src/main.tsx`**: extend the existing SW registration block:

```ts
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        // A new SW installing while one controls the page = an update is ready.
        reg.addEventListener("updatefound", () => {
          const sw = reg.installing;
          sw?.addEventListener("statechange", () => {
            if (sw.state === "installed" && navigator.serviceWorker.controller) {
              showToast("Update ready", {
                action: { label: "Reload", run: () => window.location.reload() },
                duration: 0,
              });
            }
          });
        });
        // Re-check whenever the PWA comes back to the foreground.
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") void reg.update();
        });
      })
      .catch(() => {/* progressive enhancement */});
  });
}
```

## 4. Optimistic saves (close first, sync in background)

Firestore's local cache makes writes durable before the server ack — only
the *feedback* should be optimistic. Pattern: replace `await write(); close();`
with `void write().catch((err) => { console.error(err); showToast("<X> didn't save — check connection"); }); close();`

Apply to:
- `QuickAdd.tsx` `save()` — drop the `busy` state entirely (`canSave` = value
  > 0); fire-and-forget `addExpense` with catch-toast; clear the form
  immediately.
- `EditExpenseDialog.tsx` `save()` — fire-and-forget `updateExpense`,
  `onClose()` immediately.
- `AddOneOff.tsx` — same for its save.
- Debts.tsx `saveMin` and the `StatementDialog`/`ConfirmPayDialog`
  `onConfirm` handlers in Debts.tsx — fire-and-forget + close immediately.
  (Read each; keep any validation before the write.)
- `DebtPlan.tsx` payment confirm handler — same.
- `ThisMonth.tsx`: the sync button and skip/delete handlers stay as-is
  (already fire-and-forget via `void`); the **Restart month** ConfirmDialog
  `onConfirm` KEEPS its `await` (multi-read destructive op) but gains
  `.catch` → `showToast("Restart failed — nothing was changed")` via
  try/catch around the await.
- `settings/BackupsEditor.tsx` restore stays awaited (already has
  feedback); leave it.

## 5. Expense delete undo

`QuickAdd.tsx`: replace the direct `void deleteExpense(e.id)` on the ✕ with:

```ts
  function removeExpense(e: Expense) {
    const { id: _id, ...data } = e;
    void deleteExpense(e.id).catch(() => showToast("Delete failed — check connection"));
    showToast(`Deleted ${peso(e.amount)} · ${e.category}`, {
      action: { label: "Undo", run: () => void addExpense(data).catch(() => showToast("Undo failed — re-add manually")) },
      duration: 6000,
    });
  }
```

(Delete already reverses savings/debt side effects; re-adding re-applies
them, so undo is consistent. The re-added expense gets a new id — fine.)

## 6. Quick Add: due-soon strip + backdating

- Render `<DueSoonStrip />` as the first child of Quick Add's `<main>`
  (import from `./DueSoonStrip`) — the most-visited tab now shows imminent
  card due dates.
- Backdate row: new state `const [when, setWhen] = useState("");`
  ("" = now). New section between Note and the Save button:

```tsx
        <div>
          <Label>Date</Label>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setWhen("")}
              className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
                when === "" ? "bg-emerald-600 text-white" : "bg-stone-100 text-stone-600"
              }`}
            >Today</button>
            <button
              onClick={() => setWhen(localIso(new Date(Date.now() - 86400000)).slice(0, 10))}
              className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
                when !== "" && when === localIso(new Date(Date.now() - 86400000)).slice(0, 10)
                  ? "bg-emerald-600 text-white" : "bg-stone-100 text-stone-600"
              }`}
            >Yesterday</button>
            <input
              type="date"
              value={when}
              max={localIso().slice(0, 10)}
              onChange={(e) => setWhen(e.target.value)}
              className="text-xs bg-stone-100 text-stone-600 rounded-full px-3 py-1.5 outline-none"
            />
          </div>
        </div>
```

  `save()` uses `date: when ? \`${when}T12:00:00\` : localIso()` and resets
  `setWhen("")` with the other fields.

## Out of scope

- Toasts for line ticks (LineRow) — covered globally by unhandledrejection.
- Any service-worker file changes (batch 4).
