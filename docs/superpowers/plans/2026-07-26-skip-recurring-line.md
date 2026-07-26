# Skip a Recurring Line for One Month — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a recurring line be removed from the month view — either skipped for just this month (reversible) or deleted from the recurring template entirely.

**Architecture:** A skipped month line keeps its Firestore doc and gains `skipped: true` alongside `overridden: true`. Because `reconcileLines` already ignores overridden lines, template sync cannot resurrect it and `reconcile.ts` needs no change. A pure `activeLines()` helper filters skipped lines at the four places that read month lines, so every money selector, the cutoff-closed check, and the month CSV export inherit the behaviour for free.

**Tech Stack:** React 18 + TypeScript (strict), Vite, Vitest, Firebase Firestore v11, Tailwind v4.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-26-skip-recurring-line-design.md`.
- Pure logic goes in `src/lib/*.ts` with a colocated `*.test.ts`; components never contain money math.
- TypeScript is strict — no `any`, no non-null assertions.
- **This repo is on a Dropbox CloudStorage mount. Implementers must NOT run `npm`, `npx`, `vitest`, `tsc`, or `npm run build` — those commands stall for 20+ minutes here. The controller runs all verification.** Use Read/Edit tools rather than shell commands for file work.
- **Implementers must NOT run any git command.** The controller owns version control.
- Do NOT change `src/lib/reconcile.ts`. Its existing `overridden` handling is what makes this feature work; the plan adds tests proving that, not changes.
- Do NOT filter skipped lines inside `src/lib/repo.ts`. `syncMonthFromTemplate` must pass the **raw** month lines to `reconcileLines` so it can see skipped lines and leave them alone.

---

### Task 1: `skipped` field + `activeLines` filter (pure)

**Files:**
- Modify: `src/lib/types.ts` (the `MonthLine` interface)
- Modify: `src/lib/selectors.ts` (add one exported helper)
- Modify: `src/lib/selectors.test.ts` (append tests)
- Modify: `src/lib/reconcile.test.ts` (append tests)

**Interfaces:**
- Consumes: `MonthLine` from `./types`.
- Produces, for Tasks 2 and 3: `MonthLine.skipped?: boolean`, and
  `activeLines<T extends { skipped?: boolean }>(lines: readonly T[]): T[]` exported from `src/lib/selectors.ts`.

**Background you need:**

`reconcileLines` (`src/lib/reconcile.ts`) diffs the template against a month's lines. Two existing behaviours make this feature safe, and Task 1 adds tests locking them in: the upsert loop does `if (direct?.overridden) { consumed.add(direct.id); continue; }` (line 43), and the `deletes` filter excludes `l.overridden` (line 70). A skipped line always carries `overridden: true`, so it is neither refreshed from the template nor deleted.

- [ ] **Step 1: Add the field**

In `src/lib/types.ts`, the `MonthLine` interface currently ends:

```ts
export interface MonthLine extends TemplateLine {
  status: LineStatus;
  paidDate?: string; // ISO date
  oneOff: boolean;
  overridden?: boolean; // inline-edited for this month; template sync must not clobber it
}
```

Add one field:

```ts
export interface MonthLine extends TemplateLine {
  status: LineStatus;
  paidDate?: string; // ISO date
  oneOff: boolean;
  overridden?: boolean; // inline-edited for this month; template sync must not clobber it
  skipped?: boolean; // removed from THIS month only; hidden from the view and all money math
}
```

- [ ] **Step 2: Write the failing tests**

Append to `src/lib/selectors.test.ts`. Reuse whatever `MonthLine` fixture helper that file already defines at the top; if it defines one named `M`, use it — otherwise add this one directly above the new `describe` block:

```ts
const SL = (o: Partial<MonthLine>): MonthLine =>
  ({ id: "l", name: "Line", amount: 0, channel: "CIMB", cutoff: 1, order: 0, status: "", oneOff: false, ...o });

describe("activeLines", () => {
  it("drops lines flagged skipped", () => {
    const rows = activeLines([SL({ id: "a" }), SL({ id: "b", skipped: true })]);
    expect(rows.map((l) => l.id)).toEqual(["a"]);
  });

  it("keeps lines with skipped false or the field absent", () => {
    const rows = activeLines([SL({ id: "a" }), SL({ id: "b", skipped: false })]);
    expect(rows.map((l) => l.id)).toEqual(["a", "b"]);
  });

  it("lets a cutoff close when its only unticked line is skipped", () => {
    const lines = [SL({ id: "a", status: "PAID" }), SL({ id: "b", status: "", skipped: true })];
    expect(isCutoffClosed(lines, 1)).toBe(false);
    expect(isCutoffClosed(activeLines(lines), 1)).toBe(true);
  });
});
```

Add `activeLines` to that file's existing import from `./selectors` (and `isCutoffClosed` if it is not already imported there).

Append to `src/lib/reconcile.test.ts` — this file already defines `T` and `M` fixture helpers at the top; use them:

```ts
describe("reconcileLines — skipped lines", () => {
  it("never resurrects a skipped line while its template line still exists", () => {
    const template = [T({ id: "netflix", name: "Netflix", amount: 549 })];
    const month = [M({ id: "netflix", name: "Netflix", amount: 549, overridden: true, skipped: true })];
    const { upserts, deletes } = reconcileLines(template, month);
    expect(upserts).toEqual([]);
    expect(deletes).toEqual([]);
  });

  it("leaves a skipped line alone even when its template line was removed", () => {
    const month = [M({ id: "netflix", overridden: true, skipped: true })];
    const { upserts, deletes } = reconcileLines([], month);
    expect(upserts).toEqual([]);
    expect(deletes).toEqual([]);
  });
});
```

- [ ] **Step 3: Note for the controller**

Do not run the tests yourself (see Global Constraints). State in your report that Step 2's tests are expected to fail until Step 4 adds `activeLines`.

- [ ] **Step 4: Add the helper**

In `src/lib/selectors.ts`, directly below the `isCutoffClosed` function (it ends at line 29), add:

```ts
/** Month lines that count. A skipped line was removed from this month only —
 *  it stays in Firestore so the skip can be undone, but it is hidden from the
 *  month view and from every money calculation. Pure. */
export const activeLines = <T extends { skipped?: boolean }>(lines: readonly T[]): T[] =>
  lines.filter((l) => !l.skipped);
```

- [ ] **Step 5: Report**

Write your report and return. The controller runs `npx vitest run --no-file-parallelism` and `npm run typecheck`.

---

### Task 2: Repo writes — skip and undo

**Files:**
- Modify: `src/lib/repo.ts`

**Interfaces:**
- Consumes: `MonthLine.skipped` from Task 1.
- Produces, for Task 3:
  - `skipLineForMonth(monthKey: string, line: MonthLine): Promise<void>`
  - `unskipLine(monthKey: string, id: string): Promise<void>`

**Background you need:**

A recurring line that pays a debt and is ticked PAID has already written a payment doc (carrying `lineId`) and decremented that debt's `currentBalance`. `toggleLinePaid` (`repo.ts:37-65`) contains the untick path that reverses exactly this: it scans the debt's payments for `lineId === line.id`, deletes each, and increments the balance back. `skipLineForMonth` mirrors that logic in one batch. Everything it needs — `collection`, `doc`, `getDocs`, `increment`, `writeBatch`, `updateDoc`, `db`, `debtPayments`, `debtsCol`, `monthLines` — is already imported at the top of `repo.ts`. Add no new imports.

- [ ] **Step 1: Add both functions**

In `src/lib/repo.ts`, directly after `deleteMonthLine` (which ends at line 297), add:

```ts
/** Remove a line from THIS month only, keeping the template intact. The doc is
 *  kept (flagged `skipped`) so the skip can be undone, and `overridden` stops
 *  template sync from resurrecting it. A ticked debt line is reversed first —
 *  its payment doc is deleted and the debt's balance restored — all in one
 *  batch, so a failure can't strand a restored balance without its payment. */
export async function skipLineForMonth(monthKey: string, line: MonthLine): Promise<void> {
  const batch = writeBatch(db);
  if (line.status !== "" && line.debtId) {
    const snap = await getDocs(collection(db, debtPayments(line.debtId)));
    for (const d of snap.docs) {
      if (d.data().lineId === line.id) {
        batch.delete(d.ref);
        batch.update(doc(db, debtsCol(), line.debtId), {
          currentBalance: increment(d.data().amount as number),
        });
      }
    }
  }
  batch.update(doc(db, monthLines(monthKey), line.id), {
    status: "", paidDate: "", overridden: true, skipped: true,
  });
  await batch.commit();
}

/** Undo a skip. Clearing `overridden` re-arms template sync, so the line
 *  refreshes from the template on the next sync. */
export async function unskipLine(monthKey: string, id: string): Promise<void> {
  await updateDoc(doc(db, monthLines(monthKey), id), { skipped: false, overridden: false });
}
```

**`overridden: true` is load-bearing — do not "simplify" it away.** Without it, `reconcileLines`' upsert loop reaches the line (`reconcile.ts:43` only short-circuits on `overridden`) and pushes a rebuilt line that has no `skipped` field. `syncMonthFromTemplate` writes upserts with `batch.set` (`repo.ts:384`), which *replaces* the document — so the `skipped` flag would be wiped and the line would silently come back on the next template sync. With `overridden: true` the loop skips it entirely and the `deletes` filter (`reconcile.ts:70`) excludes it, so the skip survives.

Trade-off this accepts: if the template line is later deleted from Settings → Recurring, the skipped doc is not cleaned up (the `deletes` filter excludes overridden lines). It stays in Firestore, permanently hidden by `activeLines` and absent from all math. Harmless, and preferable to the line reappearing.

- [ ] **Step 2: Report**

Write your report and return. Do not run verification or git commands.

---

### Task 3: UI — the ✕, the three-way dialog, and the undo row

**Files:**
- Modify: `src/components/ConfirmDialog.tsx`
- Modify: `src/components/MonthProvider.tsx`
- Modify: `src/components/ThisMonth.tsx`
- Modify: `src/components/QuickAdd.tsx`
- Modify: `src/components/dashboard/SpendingCalendar.tsx`
- Modify: `src/components/settings/TemplateEditor.tsx`

**Interfaces:**
- Consumes: `activeLines` from `../lib/selectors` (Task 1); `skipLineForMonth`, `unskipLine` from `../lib/repo` (Task 2).
- Produces: nothing — this is the last task.

- [ ] **Step 1: Give `ConfirmDialog` an optional second action**

In `src/components/ConfirmDialog.tsx`, extend the props and add one stacked button. Existing call sites pass neither new prop and must render exactly as before:

```tsx
interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  secondaryLabel?: string;
  onConfirm: () => void | Promise<void>;
  onSecondary?: () => void | Promise<void>;
  onCancel: () => void;
}

export default function ConfirmDialog({
  title, message, confirmLabel = "Delete", secondaryLabel, onConfirm, onSecondary, onCancel,
}: ConfirmDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4" onClick={onCancel}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xs p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-bold text-base mb-1">{title}</h3>
        <p className="text-sm text-stone-500 mb-4">{message}</p>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 py-2 rounded-lg text-sm text-stone-500 bg-stone-100">Cancel</button>
          <button onClick={() => void onConfirm()} className="flex-1 py-2 rounded-lg text-sm font-semibold text-white bg-red-600">
            {confirmLabel}
          </button>
        </div>
        {onSecondary && (
          <button
            onClick={() => void onSecondary()}
            className="mt-2 w-full py-2 rounded-lg text-sm font-semibold text-red-700 bg-red-50"
          >
            {secondaryLabel}
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Filter skipped lines in `MonthProvider` and expose them**

In `src/components/MonthProvider.tsx`:

Add `activeLines` to the existing import from `../lib/selectors` (currently `import { generateMonthLines } from "../lib/selectors";`).

Add one field to the `MonthCtx` interface, directly after `lines: MonthLine[];`:

```ts
  skippedLines: MonthLine[];
```

Change the `lines` memo so saved months are filtered (leave the projected branch alone — generated lines have no skipped concept):

```ts
  const lines = useMemo<MonthLine[]>(
    () => (isProjected ? generateMonthLines(template, events, viewedKey) : activeLines(savedLines)),
    [isProjected, template, events, viewedKey, savedLines],
  );

  const skippedLines = useMemo<MonthLine[]>(
    () => (isProjected ? [] : savedLines.filter((l) => l.skipped)),
    [isProjected, savedLines],
  );
```

Add `skippedLines` to the `value` object alongside `lines`:

```ts
  const value: MonthCtx = {
    viewedKey, currentKey, mode, editable, lines, skippedLines, incomes, ready, goPrev, goNext, start,
  };
```

- [ ] **Step 3: Filter the three components that read month lines directly**

Each currently assigns the hook result straight to `lines`. Split into the raw read plus a filtered value, and add `activeLines` to each file's imports from the selectors module (adding the import if the file has none).

`src/components/QuickAdd.tsx:19` — from:
```ts
  const lines = useCollection<MonthLine>(monthLines(currentMonthKey()));
```
to:
```ts
  const allLines = useCollection<MonthLine>(monthLines(currentMonthKey()));
  const lines = activeLines(allLines);
```

`src/components/dashboard/SpendingCalendar.tsx:31` — from:
```ts
  const lines = useCollection<MonthLine>(monthLines(monthKey));
```
to:
```ts
  const allLines = useCollection<MonthLine>(monthLines(monthKey));
  const lines = activeLines(allLines);
```

`src/components/settings/TemplateEditor.tsx:31` — from:
```ts
  const monthLineList = useCollection<MonthLine>(monthLines(monthKey));
```
to:
```ts
  const allMonthLines = useCollection<MonthLine>(monthLines(monthKey));
  const monthLineList = activeLines(allMonthLines);
```

- [ ] **Step 4: Wire the ✕, the dialog, and the undo row in `ThisMonth.tsx`**

Add to the existing repo import on line 12 — it becomes:

```ts
import { deleteMonthIncome, deleteMonthLine, deleteTemplateLine, setIncomeReceived, skipLineForMonth, syncMonthFromTemplate, unskipLine } from "../lib/repo";
```

Add `ConfirmDialog` to the imports:

```ts
import ConfirmDialog from "./ConfirmDialog";
```

Destructure `skippedLines` from `useMonth()` on line 24:

```ts
  const { viewedKey, currentKey, mode, editable, lines, skippedLines, incomes, ready, goPrev, goNext, start } = useMonth();
```

Add state next to the other `useState` calls (around line 39):

```ts
  const [confirmLine, setConfirmLine] = useState<MonthLine | null>(null);
```

Inside the `([1, 2] as const).map((cutoff) => {` block, next to the existing `const cutLines = …` line, add:

```ts
        const cutSkipped = skippedLines.filter((l) => l.cutoff === cutoff);
```

Change `LineRow`'s `onDelete` prop (currently `onDelete={editable && l.oneOff ? () => void deleteMonthLine(viewedKey, l.id) : undefined}`) to:

```tsx
                  onDelete={editable && !closed
                    ? (l.oneOff
                        ? () => void deleteMonthLine(viewedKey, l.id)
                        : () => setConfirmLine(l))
                    : undefined}
```

Directly after the closing `</ul>` of the lines list, add the skipped rows:

```tsx
            {cutSkipped.length > 0 && (
              <ul className="mt-2 flex flex-col gap-1">
                {cutSkipped.map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-2 text-xs text-stone-400">
                    <span className="truncate">{l.name} · skipped this month</span>
                    {editable && (
                      <button
                        onClick={() => void unskipLine(viewedKey, l.id)}
                        className="shrink-0 font-semibold text-emerald-700"
                      >undo</button>
                    )}
                  </li>
                ))}
              </ul>
            )}
```

Finally, render the dialog. Find where `AddOneOff` and `EditLineDialog` are rendered near the end of the component and add alongside them:

```tsx
      {confirmLine && (
        <ConfirmDialog
          title={`Remove ${confirmLine.name}?`}
          message="Skip it for this month only, or delete it from your recurring template so it stops appearing in future months too."
          confirmLabel="Just this month"
          secondaryLabel="Remove from template too"
          onConfirm={async () => {
            await skipLineForMonth(viewedKey, confirmLine);
            setConfirmLine(null);
          }}
          onSecondary={async () => {
            await deleteTemplateLine(confirmLine.id);
            await syncMonthFromTemplate(viewedKey);
            setConfirmLine(null);
          }}
          onCancel={() => setConfirmLine(null)}
        />
      )}
```

- [ ] **Step 5: Report**

Write your report and return. Do not run verification or git commands. In the report, confirm that no existing `ConfirmDialog` call site was changed and that the three direct-read components still compile against their new `lines` value.

---

## Controller verification (after Task 3)

```bash
npm run typecheck && npx vitest run --no-file-parallelism && npm run build
```

## Manual verification (reviewer, after Task 3)

1. Month tab → tap ✕ on a plain recurring line → **Just this month**. The line disappears, the cutoff's planned total drops by its amount, and a dimmed `… · skipped this month · undo` row appears.
2. Tap **undo** → the line comes back with a blank tick and the total is restored.
3. Tick a recurring line that pays a debt as PAID, note the debt's balance, then ✕ → **Just this month**. The debt balance goes back up, and Settings → Export CSV → This month no longer lists that payment.
4. ✕ → **Remove from template too** on another line → gone from the month AND from Settings → Recurring.
5. Close a cutoff (tick everything) → the ✕ no longer appears on that cutoff's lines.
6. A one-off line's ✕ still deletes immediately with no dialog.
