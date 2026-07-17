# Closed Cutoffs, Envelopes & Card Cycles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop template edits from mutating finished cutoffs, tie Quick Add spending to envelope lines (Allowance) so pesos are counted once, and add per-card statement cycles (statement day, due day, statement balance, minimum due) that drive the debt plan and a due-soon warning.

**Architecture:** All money math stays in pure, Vitest-tested modules under `src/lib/` (`selectors.ts`, `reconcile.ts`, `allocate.ts`, new `cycles.ts`); React components only read Firestore collections and call the pure functions. "Closed" is always derived (all lines ticked), never stored. Cycles live in a new `debts/{id}/cycles/{YYYY-MM}` subcollection read via the existing `useCollectionGroup` hook.

**Tech Stack:** React 18 + TypeScript + Vite, Tailwind CSS, Firebase Firestore (client-only), Vitest.

**Spec:** `docs/superpowers/specs/2026-07-18-cutoff-envelopes-card-cycles-design.md`

## Global Constraints

- Repo root: `/Users/gamaliel/Library/CloudStorage/Dropbox/Personal Workspace/cha-ching` — all paths below are relative to it.
- Run tests with `npx vitest run <file>` (non-watch); full suite `npx vitest run`; typecheck `npm run typecheck`.
- Firestore is initialized WITHOUT `ignoreUndefinedProperties` — never write a field whose value is `undefined`; either omit the key (`...(cond ? { k: v } : {})`) or use a real value (`false`).
- Derived values are never stored: no "closed" flag in Firestore.
- Match existing code style: no semicolon-free style, 2-space indent, Tailwind utility classes inline, `peso()` for money display, comments only for non-obvious constraints.
- Every commit message follows the repo's existing `feat:`/`fix:` conventional style and ends with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: `isCutoffClosed` selector

**Files:**
- Modify: `src/lib/selectors.ts`
- Test: `src/lib/selectors.test.ts`

**Interfaces:**
- Produces: `isCutoffClosed(lines: readonly MonthLine[], cutoff: 1 | 2): boolean` — used by Tasks 2, 3, 4.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/selectors.test.ts` (reuse the file's existing imports; add `isCutoffClosed` to the import from `./selectors` and `MonthLine`, `LineStatus` to the types import if not present):

```ts
const closedLine = (cutoff: 1 | 2, status: LineStatus = "", id = Math.random().toString(36).slice(2)): MonthLine => ({
  id, name: "x", amount: 100, channel: "CIMB", cutoff, order: 1, status, oneOff: false,
});

describe("isCutoffClosed", () => {
  it("is false for a cutoff with no lines", () => {
    expect(isCutoffClosed([], 1)).toBe(false);
  });
  it("is false while any line is unticked", () => {
    expect(isCutoffClosed([closedLine(1, "PAID"), closedLine(1, "")], 1)).toBe(false);
  });
  it("is true when every line is ticked (any non-blank status)", () => {
    expect(isCutoffClosed([closedLine(1, "PAID"), closedLine(1, "SENT"), closedLine(1, "TRANSFERRED")], 1)).toBe(true);
  });
  it("ignores the other cutoff's lines", () => {
    expect(isCutoffClosed([closedLine(1, "PAID"), closedLine(2, "")], 1)).toBe(true);
    expect(isCutoffClosed([closedLine(1, "PAID"), closedLine(2, "")], 2)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/selectors.test.ts`
Expected: FAIL — `isCutoffClosed` is not exported.

- [ ] **Step 3: Write minimal implementation**

Add to `src/lib/selectors.ts`:

```ts
/** A started cutoff is closed when it has lines and every one is ticked. Derived, never stored. */
export function isCutoffClosed(lines: readonly MonthLine[], cutoff: 1 | 2): boolean {
  const cut = lines.filter((l) => l.cutoff === cutoff);
  return cut.length > 0 && cut.every((l) => l.status !== "");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/selectors.test.ts`
Expected: PASS (all tests in file).

- [ ] **Step 5: Commit**

```bash
git add src/lib/selectors.ts src/lib/selectors.test.ts
git commit -m "feat: isCutoffClosed selector — all-lines-ticked defines a closed cutoff"
```

---

### Task 2: Freeze closed cutoffs in template sync

**Files:**
- Modify: `src/lib/reconcile.ts`
- Modify: `src/lib/repo.ts:236-251` (`syncMonthFromTemplate`)
- Test: `src/lib/reconcile.test.ts`

**Interfaces:**
- Consumes: `isCutoffClosed` from Task 1.
- Produces: `reconcileLines(template: TemplateLine[], monthLines: MonthLine[], closedCutoffs?: ReadonlySet<number>): { upserts: MonthLine[]; deletes: string[] }` — third param defaults to empty set, so existing call sites stay valid.

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/reconcile.test.ts` (reuse its existing line/template factories if present; otherwise these local ones):

```ts
const tpl = (id: string, cutoff: 1 | 2, name = id): TemplateLine => ({
  id, name, amount: 100, channel: "CIMB", cutoff, order: 1,
});
const ml = (id: string, cutoff: 1 | 2, status: LineStatus, name = id): MonthLine => ({
  ...tpl(id, cutoff, name), status, oneOff: false,
});

describe("reconcileLines with closed cutoffs", () => {
  it("does not upsert a new template line into a closed cutoff", () => {
    const { upserts } = reconcileLines([tpl("new", 1)], [ml("a", 1, "PAID")], new Set([1]));
    expect(upserts.find((u) => u.id === "new")).toBeUndefined();
  });
  it("does not delete lines that live in a closed cutoff", () => {
    // "orphan" has no template counterpart — normally it would be deleted.
    const { deletes } = reconcileLines([], [ml("orphan", 1, "PAID")], new Set([1]));
    expect(deletes).toEqual([]);
  });
  it("does not move an existing line out of a closed cutoff", () => {
    // Template moved the line to cutoff 2, but its month doc sits in closed cutoff 1.
    const { upserts } = reconcileLines([tpl("a", 2)], [ml("a", 1, "PAID")], new Set([1]));
    expect(upserts.find((u) => u.id === "a")).toBeUndefined();
  });
  it("still reconciles open cutoffs normally", () => {
    const { upserts, deletes } = reconcileLines(
      [tpl("new2", 2)],
      [ml("a", 1, "PAID"), ml("gone", 2, "")],
      new Set([1]),
    );
    expect(upserts.map((u) => u.id)).toContain("new2");
    expect(deletes).toContain("gone");
  });
  it("defaults to no closed cutoffs (back-compat)", () => {
    const { upserts } = reconcileLines([tpl("new", 1)], [ml("a", 1, "PAID")]);
    expect(upserts.map((u) => u.id)).toContain("new");
  });
});
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npx vitest run src/lib/reconcile.test.ts`
Expected: FAIL — third argument not accepted / new behavior missing. Pre-existing tests must still pass once implemented.

- [ ] **Step 3: Implement the freeze in `reconcileLines`**

In `src/lib/reconcile.ts`, change the signature and add the two guards (keep everything else — including the overridden guard and name/cutoff fallback matching — exactly as is):

```ts
export function reconcileLines(
  template: TemplateLine[],
  monthLines: MonthLine[],
  closedCutoffs: ReadonlySet<number> = new Set(),
): { upserts: MonthLine[]; deletes: string[] } {
  const byId = new Map(monthLines.map((l) => [l.id, l]));
  const templateIds = new Set(template.map((t) => t.id));
  const consumed = new Set<string>(); // month-line ids matched by a template line

  const upserts: MonthLine[] = [];
  for (const t of template) {
    const direct = byId.get(t.id);
    // Closed cutoffs are frozen: never insert into one, never move a line out of one.
    if (closedCutoffs.has(t.cutoff) || (direct && closedCutoffs.has(direct.cutoff))) {
      if (direct) consumed.add(direct.id);
      continue;
    }
    if (direct?.overridden) { consumed.add(direct.id); continue; } // leave inline-edits untouched

    let existing = direct;
    if (!existing) {
      // Fallback: an untracked, non-oneOff, non-overridden month line with the same
      // name + cutoff — a line whose id diverged from the template's.
      existing = monthLines.find(
        (l) => !l.oneOff && !l.overridden && !consumed.has(l.id) && !templateIds.has(l.id)
          && l.name === t.name && l.cutoff === t.cutoff,
      );
    }
    if (existing) consumed.add(existing.id);

    upserts.push({
      id: t.id, name: t.name, amount: t.amount, channel: t.channel, cutoff: t.cutoff,
      order: t.order, oneOff: false,
      status: existing?.status ?? "",
      ...(t.debtId ? { debtId: t.debtId } : {}),
      ...(existing?.paidDate ? { paidDate: existing.paidDate } : {}),
    });
  }

  const deletes = monthLines
    .filter((l) => !l.oneOff && !l.overridden && !templateIds.has(l.id) && !closedCutoffs.has(l.cutoff))
    .map((l) => l.id);

  return { upserts, deletes };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/reconcile.test.ts`
Expected: PASS — new tests and all pre-existing reconcile tests.

- [ ] **Step 5: Wire the closed set into `syncMonthFromTemplate`**

In `src/lib/repo.ts`, add `isCutoffClosed` to the existing import from `./selectors` (it currently imports `generateMonthLines`), then change the body of `syncMonthFromTemplate`:

```ts
export async function syncMonthFromTemplate(monthKey: string): Promise<void> {
  const [tSnap, mSnap] = await Promise.all([
    getDocs(collection(db, templateLines())),
    getDocs(collection(db, monthLines(monthKey))),
  ]);
  const template = tSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as TemplateLine[];
  const lines = mSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as MonthLine[];
  const closed = new Set(([1, 2] as const).filter((c) => isCutoffClosed(lines, c)));
  const { upserts, deletes } = reconcileLines(template, lines, closed);
  const batch = writeBatch(db);
  for (const l of upserts) {
    const { id, ...rest } = l;
    batch.set(doc(db, monthLines(monthKey), id), rest);
  }
  for (const id of deletes) batch.delete(doc(db, monthLines(monthKey), id));
  await batch.commit();
}
```

- [ ] **Step 6: Typecheck and full test run**

Run: `npm run typecheck && npx vitest run`
Expected: both clean.

- [ ] **Step 7: Commit**

```bash
git add src/lib/reconcile.ts src/lib/reconcile.test.ts src/lib/repo.ts
git commit -m "fix: template sync freezes closed cutoffs — new lines start next month"
```

---

### Task 3: Closed-cutoff UI (badge, one-off label, template notice)

**Files:**
- Modify: `src/components/ThisMonth.tsx`
- Modify: `src/components/AddOneOff.tsx`
- Modify: `src/components/settings/TemplateEditor.tsx`

**Interfaces:**
- Consumes: `isCutoffClosed` from Task 1.
- Produces: `AddOneOff` gains a required `lines: MonthLine[]` prop (ThisMonth is its only caller).

- [ ] **Step 1: ✓ CLOSED badge in ThisMonth**

In `src/components/ThisMonth.tsx`: add `isCutoffClosed` to the existing import from `../lib/selectors`. Inside the `([1, 2] as const).map((cutoff) => {` body, after the `cutIncomes` line, add:

```tsx
const closed = isCutoffClosed(lines, cutoff);
```

Replace the `<h2>` line with:

```tsx
<h2 className="font-semibold mb-1 flex items-center gap-2">
  {cutoff === 1 ? "1ST CUTOFF" : "2ND CUT-OFF"}
  {editable && closed && (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">✓ CLOSED</span>
  )}
</h2>
```

And change the `AddOneOff` mount at the bottom to pass lines:

```tsx
{adding && <AddOneOff monthKey={viewedKey} lines={lines} onClose={() => setAdding(false)} />}
```

- [ ] **Step 2: "(closed)" labels in AddOneOff's cutoff picker**

In `src/components/AddOneOff.tsx`: import `isCutoffClosed` from `../lib/selectors` and `MonthLine` from `../lib/types`. Change the component signature:

```tsx
export default function AddOneOff({ monthKey, lines, onClose }: { monthKey: string; lines: MonthLine[]; onClose: () => void }) {
```

Replace the cutoff `<select>` options with:

```tsx
<option value={1}>1{isCutoffClosed(lines, 1) ? " (closed)" : ""}</option>
<option value={2}>2{isCutoffClosed(lines, 2) ? " (closed)" : ""}</option>
```

- [ ] **Step 3: Closed-cutoff notice in TemplateEditor**

In `src/components/settings/TemplateEditor.tsx`:

1. Import `isCutoffClosed` from `../../lib/selectors`.
2. Add state next to the other useStates: `const [notice, setNotice] = useState<string | null>(null);`
3. Change `Form`'s `onDone` prop type to pass back the saved values, and the call site. Replace the `if (editing)` block with:

```tsx
if (editing) {
  return (
    <Form
      line={editing}
      onDone={async (saved) => {
        await syncMonthFromTemplate(monthKey);
        setNotice(
          isCutoffClosed(monthLineList, saved.cutoff)
            ? `Cutoff ${saved.cutoff} is closed for ${monthKey} — this line starts next month.`
            : null,
        );
        setEditing(null);
      }}
      onCancel={() => setEditing(null)}
    />
  );
}
```

4. In `Form`, change the prop type and `save()`:

```tsx
function Form({ line, onDone, onCancel }: {
  line: TemplateLine | Omit<TemplateLine, "id">;
  onDone: (saved: Omit<TemplateLine, "id">) => void | Promise<void>;
  onCancel: () => void;
}) {
```

and in `save()` replace `await onDone();` with `await onDone(f);`.

5. Render the notice right under the "Edits sync…" paragraph, and update that copy:

```tsx
<p className="text-xs text-stone-400 mb-3">Edits sync into the current month's open cutoffs, keeping your ticks. Closed cutoffs are frozen.</p>
{notice && (
  <p className="mb-3 rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 flex justify-between gap-2">
    <span>{notice}</span>
    <button onClick={() => setNotice(null)} className="font-semibold shrink-0">✕</button>
  </p>
)}
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/components/ThisMonth.tsx src/components/AddOneOff.tsx src/components/settings/TemplateEditor.tsx
git commit -m "feat: closed-cutoff UI — CLOSED badge, (closed) picker labels, template notice"
```

---

### Task 4: Envelope math (`isEnvelope`, `envelopeSpent`, new `unplannedForCutoff`)

**Files:**
- Modify: `src/lib/types.ts` (TemplateLine)
- Modify: `src/lib/selectors.ts`
- Modify: `src/lib/reconcile.ts` (carry `isEnvelope` through sync)
- Modify: `src/components/ThisMonth.tsx` (call-site signature fix, keeps typecheck green)
- Test: `src/lib/selectors.test.ts`, `src/lib/reconcile.test.ts`

**Interfaces:**
- Produces:
  - `TemplateLine.isEnvelope?: boolean` (inherited by `MonthLine`).
  - `envelopeSpent(expenses: readonly { amount: number; date: string; envelopeLineId?: string }[], monthKey: string, lineId: string): number`
  - `unplannedForCutoff(expenses: readonly { amount: number; date: string; envelopeLineId?: string }[], monthKey: string, cutoff: 1 | 2, lines: readonly MonthLine[]): number` — NOTE: new 4th param `lines` (breaking change; ThisMonth is the only caller).

- [ ] **Step 1: Add the type field**

In `src/lib/types.ts`, add to `TemplateLine`:

```ts
export interface TemplateLine {
  id: string;
  name: string;
  amount: number;
  channel: Channel;
  cutoff: 1 | 2;
  order: number;
  debtId?: string;
  isEnvelope?: boolean; // Quick Add spending can draw from this line instead of free cash
}
```

- [ ] **Step 2: Write the failing selector tests**

Append to `src/lib/selectors.test.ts` (reuses `closedLine` from Task 1; extend it or build lines inline where `isEnvelope`/`amount` matter):

```ts
const env = (id: string, cutoff: 1 | 2, amount: number, status: LineStatus = ""): MonthLine => ({
  id, name: id, amount, channel: "CIMB", cutoff, order: 1, status, oneOff: false, isEnvelope: true,
});
const exp = (amount: number, date: string, envelopeLineId?: string) =>
  ({ amount, date, ...(envelopeLineId ? { envelopeLineId } : {}) });

describe("envelopeSpent", () => {
  it("sums only this month's expenses linked to the line", () => {
    const expenses = [exp(100, "2026-07-05", "allow"), exp(50, "2026-07-20", "allow"),
      exp(999, "2026-06-30", "allow"), exp(70, "2026-07-06", "other"), exp(40, "2026-07-07")];
    expect(envelopeSpent(expenses, "2026-07", "allow")).toBe(150);
  });
});

describe("unplannedForCutoff (envelopes + closed cutoffs)", () => {
  const openLines = [env("allow", 1, 1000), closedLine(2, "")];

  it("attributes envelope-less expenses by day rule when cutoffs are open", () => {
    const expenses = [exp(100, "2026-07-15"), exp(200, "2026-07-28"), exp(300, "2026-07-05")];
    expect(unplannedForCutoff(expenses, "2026-07", 1, openLines)).toBe(100);
    expect(unplannedForCutoff(expenses, "2026-07", 2, openLines)).toBe(500);
  });

  it("excludes envelope-linked expenses from unplanned", () => {
    const expenses = [exp(100, "2026-07-15", "allow")];
    expect(unplannedForCutoff(expenses, "2026-07", 1, openLines)).toBe(0);
  });

  it("counts only the envelope's overspend excess, in the envelope's cutoff", () => {
    const expenses = [exp(900, "2026-07-15", "allow"), exp(400, "2026-07-16", "allow")];
    // spent 1300 of 1000 → 300 excess charged to cutoff 1
    expect(unplannedForCutoff(expenses, "2026-07", 1, openLines)).toBe(300);
    expect(unplannedForCutoff(expenses, "2026-07", 2, openLines)).toBe(0);
  });

  it("treats an orphaned envelopeLineId as unplanned", () => {
    const expenses = [exp(100, "2026-07-15", "deleted-line")];
    expect(unplannedForCutoff(expenses, "2026-07", 1, openLines)).toBe(100);
  });

  it("rolls date-attributed expenses off a closed cutoff onto the open one", () => {
    const lines = [closedLine(1, "PAID"), closedLine(2, "")];
    const expenses = [exp(100, "2026-07-15")]; // day 15 → cutoff 1, but 1 is closed
    expect(unplannedForCutoff(expenses, "2026-07", 1, lines)).toBe(0);
    expect(unplannedForCutoff(expenses, "2026-07", 2, lines)).toBe(100);
  });

  it("reduces nothing when both cutoffs are closed (tracking-only)", () => {
    const lines = [closedLine(1, "PAID"), closedLine(2, "SENT")];
    const expenses = [exp(100, "2026-07-15")];
    expect(unplannedForCutoff(expenses, "2026-07", 1, lines)).toBe(0);
    expect(unplannedForCutoff(expenses, "2026-07", 2, lines)).toBe(0);
  });

  it("ignores other months", () => {
    expect(unplannedForCutoff([exp(100, "2026-06-15")], "2026-07", 1, openLines)).toBe(0);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/lib/selectors.test.ts`
Expected: FAIL — `envelopeSpent` missing; `unplannedForCutoff` rejects 4th arg.

- [ ] **Step 4: Implement in `selectors.ts`**

Replace the existing `unplannedForCutoff` and add `envelopeSpent`:

```ts
/** Sum of this month's Quick Add expenses drawn from envelope line `lineId`. */
export function envelopeSpent(
  expenses: readonly { amount: number; date: string; envelopeLineId?: string }[],
  monthKey: string,
  lineId: string,
): number {
  return expenses
    .filter((e) => e.envelopeLineId === lineId && e.date.slice(0, 7) === monthKey)
    .reduce((s, e) => s + e.amount, 0);
}

/**
 * Unplanned spending charged to `cutoff`:
 *  - envelope-less expenses, attributed by the date's day (13–24 → 1, else 2),
 *    rolled to the other cutoff when the attributed one is closed, and to
 *    nowhere (tracking-only) when both are closed;
 *  - each envelope line's overspend excess (spent − amount, min 0) in its own
 *    cutoff. Expenses whose envelopeLineId no longer matches an envelope line
 *    count as envelope-less.
 */
export function unplannedForCutoff(
  expenses: readonly { amount: number; date: string; envelopeLineId?: string }[],
  monthKey: string,
  cutoff: 1 | 2,
  lines: readonly MonthLine[],
): number {
  const closed = { 1: isCutoffClosed(lines, 1), 2: isCutoffClosed(lines, 2) };
  const lineById = new Map(lines.map((l) => [l.id, l]));
  const attribute = (day: number): 1 | 2 | null => {
    const first = cutoffForDueDay(day);
    if (!closed[first]) return first;
    const other = first === 1 ? 2 : 1;
    return closed[other] ? null : other;
  };

  let total = 0;
  for (const e of expenses) {
    if (e.date.slice(0, 7) !== monthKey) continue;
    const envLine = e.envelopeLineId ? lineById.get(e.envelopeLineId) : undefined;
    if (envLine?.isEnvelope) continue; // drawn from the envelope, counted below as excess only
    if (attribute(Number(e.date.slice(8, 10))) === cutoff) total += e.amount;
  }
  for (const l of lines) {
    if (!l.isEnvelope || l.cutoff !== cutoff) continue;
    total += Math.max(0, envelopeSpent(expenses, monthKey, l.id) - l.amount);
  }
  return total;
}
```

- [ ] **Step 5: Fix the ThisMonth call site**

In `src/components/ThisMonth.tsx`:
- Change the expenses subscription to include the new field:

```tsx
const expenses = useCollection<{ id: string; amount: number; date: string; envelopeLineId?: string }>(expensesCol());
```

- Change the unplanned computation inside the cutoff map:

```tsx
const unplanned = editable ? unplannedForCutoff(expenses, viewedKey, cutoff, lines) : 0;
```

- [ ] **Step 6: Carry `isEnvelope` through template sync**

In `src/lib/reconcile.ts`, add one spread to the upsert object (after the `debtId` spread):

```ts
      ...(t.isEnvelope ? { isEnvelope: true } : {}),
```

Append a test to `src/lib/reconcile.test.ts`:

```ts
it("carries isEnvelope onto the month line", () => {
  const t = { ...tpl("allow", 1), isEnvelope: true };
  const { upserts } = reconcileLines([t], []);
  expect(upserts[0].isEnvelope).toBe(true);
});
```

- [ ] **Step 7: Run all tests + typecheck**

Run: `npx vitest run && npm run typecheck`
Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add src/lib/types.ts src/lib/selectors.ts src/lib/selectors.test.ts src/lib/reconcile.ts src/lib/reconcile.test.ts src/components/ThisMonth.tsx
git commit -m "feat: envelope math — envelopeSpent + unplannedForCutoff v2 (envelopes, closed-cutoff skip)"
```

---

### Task 5: Quick Add "Paid from" picker

**Files:**
- Modify: `src/lib/repo.ts:80-86` (`ExpenseInput`)
- Modify: `src/components/QuickAdd.tsx`

**Interfaces:**
- Consumes: `MonthLine.isEnvelope` (Task 4), `currentMonthKey` from `src/lib/clock.ts`, `monthLines` from `src/lib/paths.ts`.
- Produces: expense docs may carry `envelopeLineId: string` (key omitted entirely for unplanned).

- [ ] **Step 1: Extend `ExpenseInput`**

In `src/lib/repo.ts`:

```ts
export interface ExpenseInput {
  amount: number; category: string; channel: string; note: string; date: string;
  envelopeLineId?: string;
}
```

(`addExpense` needs no change — callers omit the key when unplanned.)

- [ ] **Step 2: Add the picker to QuickAdd**

In `src/components/QuickAdd.tsx`:

1. Add imports:

```tsx
import { currentMonthKey } from "../lib/clock";
import { monthLines } from "../lib/paths";
import type { MonthLine } from "../lib/types";
```

2. Inside the component, after the `expenses` subscription:

```tsx
const monthKey = currentMonthKey();
const lines = useCollection<MonthLine>(monthLines(monthKey));
const envelopes = lines
  .filter((l) => l.isEnvelope)
  .sort((a, b) => a.cutoff - b.cutoff || a.order - b.order);
const [envelope, setEnvelope] = useState<string>(() => localStorage.getItem("quickadd-envelope") ?? "");
// A remembered envelope that no longer exists (new month, deleted line) falls back to Unplanned.
const activeEnvelope = envelopes.some((l) => l.id === envelope) ? envelope : "";
const pickEnvelope = (id: string) => {
  setEnvelope(id);
  localStorage.setItem("quickadd-envelope", id);
};
```

3. In `save()`, include the envelope only when set:

```tsx
await addExpense({
  amount: value, category, channel, note, date: new Date().toISOString(),
  ...(activeEnvelope ? { envelopeLineId: activeEnvelope } : {}),
});
```

4. Add the picker row between the Account block and the Note block:

```tsx
<div>
  <Label>Paid from</Label>
  <div className="flex flex-wrap gap-2">
    <button
      onClick={() => pickEnvelope("")}
      className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
        activeEnvelope === "" ? "bg-stone-700 text-white" : "bg-stone-100 text-stone-600"
      }`}
    >Unplanned</button>
    {envelopes.map((l) => (
      <button
        key={l.id} onClick={() => pickEnvelope(l.id)}
        className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
          activeEnvelope === l.id ? "bg-emerald-600 text-white" : "bg-stone-100 text-stone-600"
        }`}
      >{l.name}</button>
    ))}
  </div>
</div>
```

5. In the Recent list, show the envelope name. Replace the category/note span with:

```tsx
<span className="text-sm truncate">
  {e.category}
  {e.envelopeLineId && (
    <span className="text-emerald-700"> · {lines.find((l) => l.id === e.envelopeLineId)?.name ?? "envelope"}</span>
  )}
  {e.note ? ` · ${e.note}` : ""}
</span>
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/lib/repo.ts src/components/QuickAdd.tsx
git commit -m "feat: Quick Add 'Paid from' picker — expenses can draw from envelope lines"
```

---

### Task 6: Envelope drawdown display on This Month

**Files:**
- Modify: `src/components/LineRow.tsx`
- Modify: `src/components/ThisMonth.tsx`

**Interfaces:**
- Consumes: `envelopeSpent` (Task 4).
- Produces: `LineRow` gains optional prop `spent?: number` (rendered only when `line.isEnvelope`).

- [ ] **Step 1: LineRow drawdown UI**

In `src/components/LineRow.tsx`, add `spent` to the props:

```tsx
export default function LineRow(
  { monthKey, line, readOnly = false, onDelete, onEdit, spent }:
  { monthKey: string; line: MonthLine; readOnly?: boolean; onDelete?: () => void; onEdit?: () => void; spent?: number },
) {
```

Replace the name `<span className="text-sm">…</span>` block with:

```tsx
<span className="text-sm min-w-0">
  {line.name}
  {line.oneOff && <span className="ml-1 text-[10px] text-amber-600">•one-off</span>}
  {line.isEnvelope && spent != null && (
    <>
      <span className="block text-[10px] text-stone-400 tabular-nums">
        {peso(Math.max(0, line.amount - spent))} left of {peso(line.amount)}
      </span>
      <span className="mt-0.5 block h-1 w-24 rounded-full bg-stone-100 overflow-hidden">
        <span
          className={`block h-full ${spent > line.amount ? "bg-red-500" : "bg-emerald-500"}`}
          style={{ width: `${line.amount > 0 ? Math.min(100, Math.round((spent / line.amount) * 100)) : 100}%` }}
        />
      </span>
    </>
  )}
</span>
```

- [ ] **Step 2: Pass `spent` from ThisMonth**

In `src/components/ThisMonth.tsx`, add `envelopeSpent` to the import from `../lib/selectors`, then in the `cutLines.map((l) => (` render:

```tsx
<LineRow
  key={l.id}
  monthKey={viewedKey}
  line={l}
  readOnly={!editable}
  spent={l.isEnvelope ? envelopeSpent(expenses, viewedKey, l.id) : undefined}
  onDelete={editable && l.oneOff ? () => void deleteMonthLine(viewedKey, l.id) : undefined}
  onEdit={editable ? () => setEditingLine(l) : undefined}
/>
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/LineRow.tsx src/components/ThisMonth.tsx
git commit -m "feat: envelope lines show ₱-left drawdown bar on This Month"
```

---

### Task 7: `isEnvelope` toggles in editors

**Files:**
- Modify: `src/components/settings/TemplateEditor.tsx` (Form)
- Modify: `src/components/EditLineDialog.tsx`
- Modify: `src/lib/repo.ts:222-226` (`updateMonthLine` patch type)

**Interfaces:**
- Consumes: `TemplateLine.isEnvelope` (Task 4).
- Produces: `updateMonthLine` accepts `isEnvelope` in its patch.

- [ ] **Step 1: Template form toggle**

In `TemplateEditor.tsx`'s `Form`, after the "Pays debt" block (and its helper paragraph), add:

```tsx
<label className="flex items-center justify-between text-sm">Envelope
  <input type="checkbox" checked={!!f.isEnvelope} onChange={(e) => set("isEnvelope", e.target.checked)} />
</label>
<p className="text-[11px] text-stone-400 -mt-1">Quick Add can draw spending from this line instead of free cash.</p>
```

(`e.target.checked` is always a real boolean — never `undefined` — so it is Firestore-safe.)

- [ ] **Step 2: Month-line dialog toggle**

In `src/lib/repo.ts` widen the patch type:

```ts
export async function updateMonthLine(
  monthKey: string, id: string, patch: Partial<Pick<MonthLine, "name" | "amount" | "channel" | "debtId" | "isEnvelope">>,
): Promise<void> {
  await updateDoc(doc(db, monthLines(monthKey), id), { ...patch, overridden: true });
}
```

In `src/components/EditLineDialog.tsx`, add state and checkbox:

```tsx
const [isEnvelope, setIsEnvelope] = useState(!!line.isEnvelope);
```

In `save()`:

```tsx
await updateMonthLine(monthKey, line.id, { name: name.trim(), amount: amt, channel, isEnvelope });
```

Add after the Channel label:

```tsx
<label className="flex items-center justify-between text-sm">Envelope
  <input type="checkbox" checked={isEnvelope} onChange={(e) => setIsEnvelope(e.target.checked)} />
</label>
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/settings/TemplateEditor.tsx src/components/EditLineDialog.tsx src/lib/repo.ts
git commit -m "feat: isEnvelope toggle in template editor and month-line dialog"
```

---

### Task 8: `cycles.ts` pure module

**Files:**
- Modify: `src/lib/types.ts` (Debt.statementDay, DebtCycle)
- Create: `src/lib/cycles.ts`
- Test: `src/lib/cycles.test.ts`

**Interfaces:**
- Consumes: `addMonths(monthKey: string, n: number): string` from `src/lib/format.ts`.
- Produces (all pure; used by Tasks 9–12):
  - `Debt.statementDay?: number`
  - `DebtCycle { id: string; debtId?: string; statementDate: string; dueDate: string; statementBalance: number; minimumDue: number }`
  - `currentCycleKey(statementDay: number, today: Date): string`
  - `cycleDates(statementDay: number, dueDay: number, cycleKey: string): { statementDate: string; dueDate: string }`
  - `paidInCycle(payments: readonly { debtId: string; date: string; amount: number }[], debtId: string, statementDay: number, cycleKey: string): number`
  - `daysUntil(dateIso: string, today: Date): number`
  - `cycleMinimums(debts: readonly { id: string; statementDay?: number }[], cycles: readonly { id: string; debtId?: string; minimumDue: number }[], payments: readonly { debtId: string; date: string; amount: number }[], today: Date): Map<string, number>`

- [ ] **Step 1: Add types**

In `src/lib/types.ts`, add `statementDay?: number;` to `Debt` (after `dueDay`), and after the `Debt` interface add:

```ts
/** One credit-card statement cycle, stored at debts/{id}/cycles/{YYYY-MM}
 *  (key = the statement's month). */
export interface DebtCycle {
  id: string;              // "YYYY-MM" cycle key
  debtId?: string;         // injected by useCollectionGroup
  statementDate: string;   // "YYYY-MM-DD"
  dueDate: string;         // "YYYY-MM-DD"
  statementBalance: number;
  minimumDue: number;
}
```

- [ ] **Step 2: Write the failing tests**

Create `src/lib/cycles.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { currentCycleKey, cycleDates, cycleMinimums, daysUntil, paidInCycle } from "./cycles";

const pay = (debtId: string, date: string, amount: number) => ({ debtId, date, amount });

describe("currentCycleKey", () => {
  it("uses this month once the statement day has arrived", () => {
    expect(currentCycleKey(15, new Date(2026, 6, 15))).toBe("2026-07");
    expect(currentCycleKey(15, new Date(2026, 6, 20))).toBe("2026-07");
  });
  it("uses last month before the statement day", () => {
    expect(currentCycleKey(15, new Date(2026, 6, 14))).toBe("2026-06");
  });
  it("crosses the year boundary", () => {
    expect(currentCycleKey(15, new Date(2026, 0, 5))).toBe("2025-12");
  });
  it("clamps the statement day in short months", () => {
    // statementDay 31 in June (30 days) → statement on Jun 30
    expect(currentCycleKey(31, new Date(2026, 5, 30))).toBe("2026-06");
  });
});

describe("cycleDates", () => {
  it("puts the due date in the same month when it falls after the statement", () => {
    expect(cycleDates(5, 20, "2026-07")).toEqual({ statementDate: "2026-07-05", dueDate: "2026-07-20" });
  });
  it("rolls the due date to the next month when on/before the statement day", () => {
    // EastWest: statement 15th, due 10th → due the following month
    expect(cycleDates(15, 10, "2026-07")).toEqual({ statementDate: "2026-07-15", dueDate: "2026-08-10" });
  });
  it("clamps both days in short months", () => {
    expect(cycleDates(31, 31, "2026-02")).toEqual({ statementDate: "2026-02-28", dueDate: "2026-03-31" });
  });
});

describe("paidInCycle", () => {
  const payments = [
    pay("d1", "2026-07-14T10:00:00.000Z", 111), // day before window
    pay("d1", "2026-07-15T10:00:00.000Z", 500), // window start (inclusive)
    pay("d1", "2026-08-14T10:00:00.000Z", 200), // last day of window
    pay("d1", "2026-08-15T10:00:00.000Z", 333), // next window (exclusive)
    pay("d2", "2026-07-20T10:00:00.000Z", 999), // other debt
  ];
  it("sums payments in [statement, next statement)", () => {
    expect(paidInCycle(payments, "d1", 15, "2026-07")).toBe(700);
  });
});

describe("daysUntil", () => {
  it("counts whole days ignoring time of day", () => {
    expect(daysUntil("2026-07-20", new Date(2026, 6, 18, 23, 59))).toBe(2);
    expect(daysUntil("2026-07-18", new Date(2026, 6, 18))).toBe(0);
    expect(daysUntil("2026-07-16", new Date(2026, 6, 18))).toBe(-2);
  });
});

describe("cycleMinimums", () => {
  const debts = [{ id: "d1", statementDay: 15 }, { id: "d2", statementDay: 15 }, { id: "d3" }];
  const cycles = [
    { id: "2026-07", debtId: "d1", minimumDue: 1700 },
    { id: "2026-07", debtId: "d2", minimumDue: 1000 },
  ];
  const today = new Date(2026, 6, 18); // cycle key 2026-07

  it("nets the cycle minimum against payments already in the cycle", () => {
    const m = cycleMinimums(debts, cycles, [pay("d1", "2026-07-16T00:00:00.000Z", 500)], today);
    expect(m.get("d1")).toBe(1200);
    expect(m.get("d2")).toBe(1000);
  });
  it("floors at zero when the minimum is already covered", () => {
    const m = cycleMinimums(debts, cycles, [pay("d1", "2026-07-16T00:00:00.000Z", 9999)], today);
    expect(m.get("d1")).toBe(0);
  });
  it("has no entry without a statementDay or without a cycle doc", () => {
    const m = cycleMinimums(debts, [cycles[0]], [], today);
    expect(m.has("d2")).toBe(false); // no cycle doc entered yet → static fallback applies downstream
    expect(m.has("d3")).toBe(false); // no statementDay
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/lib/cycles.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 4: Implement `src/lib/cycles.ts`**

```ts
import { addMonths } from "./format";

/** "YYYY-MM-DD" for a nominal day-of-month in `monthKey`, clamped to the month's length. */
function dateInMonth(monthKey: string, day: number): string {
  const [y, m] = monthKey.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return `${monthKey}-${String(Math.min(day, last)).padStart(2, "0")}`;
}

function monthKeyOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Cycle key ("YYYY-MM" of the statement) current on `today`: the most recent statement ≤ today. */
export function currentCycleKey(statementDay: number, today: Date): string {
  const monthKey = monthKeyOf(today);
  const todayIso = `${monthKey}-${String(today.getDate()).padStart(2, "0")}`;
  return todayIso >= dateInMonth(monthKey, statementDay) ? monthKey : addMonths(monthKey, -1);
}

/** Statement + due dates for a cycle. Due = next dueDay occurrence strictly after the statement. */
export function cycleDates(
  statementDay: number, dueDay: number, cycleKey: string,
): { statementDate: string; dueDate: string } {
  const statementDate = dateInMonth(cycleKey, statementDay);
  const sameMonthDue = dateInMonth(cycleKey, dueDay);
  const dueDate = sameMonthDue > statementDate ? sameMonthDue : dateInMonth(addMonths(cycleKey, 1), dueDay);
  return { statementDate, dueDate };
}

/** Payments for one debt dated within [statement, next statement). Pure. */
export function paidInCycle(
  payments: readonly { debtId: string; date: string; amount: number }[],
  debtId: string,
  statementDay: number,
  cycleKey: string,
): number {
  const start = dateInMonth(cycleKey, statementDay);
  const end = dateInMonth(addMonths(cycleKey, 1), statementDay);
  return payments
    .filter((p) => p.debtId === debtId && p.date.slice(0, 10) >= start && p.date.slice(0, 10) < end)
    .reduce((s, p) => s + p.amount, 0);
}

/** Whole days from `today` to `dateIso` (negative when past), ignoring time of day. */
export function daysUntil(dateIso: string, today: Date): number {
  const [y, m, d] = dateIso.split("-").map(Number);
  const a = new Date(y, m - 1, d).getTime();
  const b = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return Math.round((a - b) / 86400000);
}

/**
 * Per-debt reserve for the allocation's minimums pass: the current cycle's
 * minimum net of payments already inside the cycle window. Debts without a
 * statementDay or without an entered cycle doc get no entry — callers fall
 * back to the static `minimum`. Pass `payments: []` for the gross (un-netted)
 * variant used by full-cutoff views.
 */
export function cycleMinimums(
  debts: readonly { id: string; statementDay?: number }[],
  cycles: readonly { id: string; debtId?: string; minimumDue: number }[],
  payments: readonly { debtId: string; date: string; amount: number }[],
  today: Date,
): Map<string, number> {
  const m = new Map<string, number>();
  for (const d of debts) {
    if (!d.statementDay) continue;
    const key = currentCycleKey(d.statementDay, today);
    const cyc = cycles.find((c) => c.debtId === d.id && c.id === key);
    if (!cyc) continue;
    m.set(d.id, Math.max(0, cyc.minimumDue - paidInCycle(payments, d.id, d.statementDay, key)));
  }
  return m;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/lib/cycles.test.ts && npm run typecheck`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/lib/types.ts src/lib/cycles.ts src/lib/cycles.test.ts
git commit -m "feat: cycles.ts — statement-cycle keys, dates, windows, and net minimums (pure)"
```

---

### Task 9: Cycle minimums in the allocation

**Files:**
- Modify: `src/lib/allocate.ts`
- Modify: `src/lib/funding.ts` (`cutoffAllocation` passthrough)
- Test: `src/lib/allocate.test.ts`

**Interfaces:**
- Produces:
  - `allocateCutoff(freeCash: number, debts: Debt[], cutoff: 1 | 2, cycleMins?: ReadonlyMap<string, number>): Allocation`
  - `cutoffAllocation(freeCash: number, debts: Debt[], paid: Map<string, number>, cutoff: 1 | 2, cycleMins?: ReadonlyMap<string, number>): Allocation`
  - Both params optional — existing call sites stay valid until Task 12 wires them.

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/allocate.test.ts` (reuse its existing debt factory; otherwise):

```ts
const cardDebt = (id: string, over: Partial<Debt> = {}): Debt => ({
  id, name: id, startingBalance: 10000, currentBalance: 10000, payoffOrder: 9,
  channel: "RCBC", isBNPL: false, active: true, dueDay: 16, minimum: 500, ...over,
});

describe("allocateCutoff with cycle minimums", () => {
  const target = cardDebt("t", { payoffOrder: 1 });
  const other = cardDebt("o", { payoffOrder: 2, dueDay: 16 }); // due day 16 → cutoff 1

  it("reserves the cycle minimum instead of the static minimum", () => {
    const alloc = allocateCutoff(1000, [target, other], 1, new Map([["o", 800]]));
    const line = alloc.lines.find((l) => l.debtId === "o");
    expect(line?.amount).toBe(800);
  });
  it("reserves nothing when the cycle minimum is already covered (0), despite a static minimum", () => {
    const alloc = allocateCutoff(1000, [target, other], 1, new Map([["o", 0]]));
    expect(alloc.lines.find((l) => l.debtId === "o")).toBeUndefined();
    expect(alloc.lines.find((l) => l.debtId === "t")?.amount).toBe(1000);
  });
  it("falls back to the static minimum when the debt has no map entry", () => {
    const alloc = allocateCutoff(1000, [target, other], 1, new Map());
    expect(alloc.lines.find((l) => l.debtId === "o")?.amount).toBe(500);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/allocate.test.ts`
Expected: FAIL — 4th argument not accepted.

- [ ] **Step 3: Implement**

In `src/lib/allocate.ts`, change the signature and the one `min` line:

```ts
export function allocateCutoff(
  freeCash: number, debts: Debt[], cutoff: 1 | 2,
  cycleMins?: ReadonlyMap<string, number>,
): Allocation {
```

and in the minimums pass replace `const min = d.minimum ?? 0;` with:

```ts
    // Entered statement cycle → its (net) minimum wins; otherwise the static minimum.
    const min = cycleMins?.get(d.id) ?? d.minimum ?? 0;
```

In `src/lib/funding.ts`, pass it through `cutoffAllocation`:

```ts
export function cutoffAllocation(
  freeCash: number,
  debts: Debt[],
  paid: Map<string, number>,
  cutoff: 1 | 2,
  cycleMins?: ReadonlyMap<string, number>,
): Allocation {
  const planDebts = debts.map((d) =>
    paid.has(d.id) ? { ...d, currentBalance: d.currentBalance + (paid.get(d.id) ?? 0) } : d,
  );
  return allocateCutoff(freeCash, planDebts, cutoff, cycleMins);
}
```

- [ ] **Step 4: Run all tests + typecheck**

Run: `npx vitest run && npm run typecheck`
Expected: clean (existing allocate/funding tests must still pass — the fallback path is unchanged).

- [ ] **Step 5: Commit**

```bash
git add src/lib/allocate.ts src/lib/allocate.test.ts src/lib/funding.ts
git commit -m "feat: allocation reserves per-cycle statement minimums when entered"
```

---

### Task 10: Firestore plumbing + statement day in Settings

**Files:**
- Modify: `src/lib/paths.ts`
- Modify: `src/lib/repo.ts`
- Modify: `src/components/settings/DebtsEditor.tsx`
- Test: `src/lib/paths.test.ts`

**Interfaces:**
- Produces:
  - `debtCycles(debtId: string): string` path helper
  - `setDebtCycle(debtId: string, cycleKey: string, cycle: { statementDate: string; dueDate: string; statementBalance: number; minimumDue: number }): Promise<void>`
  - Debts editor exposes "Statement day (1–31)".

- [ ] **Step 1: Failing path test**

Append to `src/lib/paths.test.ts` (match the file's existing assertion style):

```ts
it("debtCycles nests under the debt", () => {
  expect(debtCycles("d1")).toBe("households/main/debts/d1/cycles");
});
```

Run: `npx vitest run src/lib/paths.test.ts` — expect FAIL.

- [ ] **Step 2: Implement path + repo function**

`src/lib/paths.ts`, after `debtPayments`:

```ts
export const debtCycles = (debtId: string): string => `${debtsCol()}/${debtId}/cycles`;
```

`src/lib/repo.ts` — add `debtCycles` to the paths import, then near the other debt functions:

```ts
/** Upsert a card's statement cycle (doc id = statement-month "YYYY-MM"). Idempotent. */
export async function setDebtCycle(
  debtId: string, cycleKey: string,
  cycle: { statementDate: string; dueDate: string; statementBalance: number; minimumDue: number },
): Promise<void> {
  await setDoc(doc(db, debtCycles(debtId), cycleKey), cycle);
}
```

Run: `npx vitest run src/lib/paths.test.ts` — expect PASS.

- [ ] **Step 3: Statement day field in DebtsEditor**

In `src/components/settings/DebtsEditor.tsx`, extend the `numberField` key union and add the field after "Due day":

```tsx
const numberField = (label: string, k: "startingBalance" | "currentBalance" | "payoffOrder" | "dueDay" | "statementDay" | "minimum" | "creditLimit") => (
```

```tsx
{numberField("Due day (1–31)", "dueDay")}
{numberField("Statement day (1–31)", "statementDay")}
```

NOTE: `numberField` writes `undefined` when the input is cleared, and `updateDebt(id, f)` passes the whole object to Firestore's `updateDoc`, which throws on `undefined`. This is a pre-existing latent bug for `dueDay`/`minimum`/`creditLimit`; fix it now for all of them by stripping undefineds in `save()`:

```tsx
async function save() {
  if (!f.name.trim()) return;
  const clean = Object.fromEntries(Object.entries(f).filter(([, v]) => v !== undefined)) as typeof f;
  if (id) await updateDebt(id, clean);
  else await addDebt(clean);
  onDone();
}
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/paths.ts src/lib/paths.test.ts src/lib/repo.ts src/components/settings/DebtsEditor.tsx
git commit -m "feat: debt cycles path/repo + statement-day field (and undefined-safe debt saves)"
```

---

### Task 11: Debts screen — statement entry + cycle display

**Files:**
- Create: `src/components/StatementDialog.tsx`
- Modify: `src/components/Debts.tsx`
- Modify: `src/components/DebtPlan.tsx` (PaymentRec gains `date`)

**Interfaces:**
- Consumes: `currentCycleKey`, `cycleDates`, `paidInCycle`, `daysUntil` (Task 8); `setDebtCycle` (Task 10); `DebtCycle` type.
- Produces: `PaymentRec` gains `date: string` (every payment doc already stores it); `StatementDialog` component.

- [ ] **Step 1: Extend PaymentRec**

In `src/components/DebtPlan.tsx`:

```ts
export interface PaymentRec {
  id: string; debtId: string; amount: number; monthKey: string; cutoff: 1 | 2; date: string;
}
```

(Both `logDebtPayment` and `toggleLinePaid` already write `date` on every payment doc — no data migration needed.)

- [ ] **Step 2: Create `src/components/StatementDialog.tsx`**

```tsx
import { useState } from "react";

/** Enter/edit one statement cycle for a card: statement balance + minimum due. */
export default function StatementDialog({
  debtName, cycleKey, defaultBalance, defaultMin, onConfirm, onCancel,
}: {
  debtName: string; cycleKey: string; defaultBalance: number; defaultMin: number;
  onConfirm: (statementBalance: number, minimumDue: number) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [balance, setBalance] = useState(defaultBalance ? String(defaultBalance) : "");
  const [min, setMin] = useState(defaultMin ? String(defaultMin) : "");
  const b = Number(balance), m = Number(min);
  const valid = balance !== "" && min !== "" && b >= 0 && m >= 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4" onClick={onCancel}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xs p-5 flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-bold">{debtName} · {cycleKey} statement</h3>
        <label className="flex items-center justify-between text-sm">Statement balance
          <input
            type="number" inputMode="decimal" autoFocus value={balance}
            onChange={(e) => setBalance(e.target.value)}
            className="w-28 text-right border-b border-stone-300 outline-none tabular-nums"
          />
        </label>
        <label className="flex items-center justify-between text-sm">Minimum due
          <input
            type="number" inputMode="decimal" value={min}
            onChange={(e) => setMin(e.target.value)}
            className="w-28 text-right border-b border-stone-300 outline-none tabular-nums"
          />
        </label>
        <div className="flex gap-2 mt-1">
          <button onClick={onCancel} className="flex-1 py-2 rounded-lg text-sm text-stone-500 bg-stone-100">Cancel</button>
          <button
            onClick={() => void onConfirm(b, m)} disabled={!valid}
            className="flex-1 py-2 rounded-lg text-sm font-semibold text-white bg-emerald-600 disabled:opacity-40"
          >Save</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Wire cycles into Debts.tsx**

In `src/components/Debts.tsx`:

1. Add imports:

```tsx
import { currentCycleKey, cycleDates, daysUntil, paidInCycle } from "../lib/cycles";
import { setDebtCycle } from "../lib/repo"; // add to the existing repo import
import type { DebtCycle } from "../lib/types"; // add to the existing types import
import StatementDialog from "./StatementDialog";
```

2. Component state/subscriptions, next to the existing ones:

```tsx
const cycles = useCollectionGroup<DebtCycle>("cycles");
const [stmtDebt, setStmtDebt] = useState<Debt | null>(null);
const today = new Date();
```

3. Inside `active.map((d) => {`, before `return`, add:

```tsx
const cycleKey = d.statementDay ? currentCycleKey(d.statementDay, today) : null;
const cycle = cycleKey ? cycles.find((c) => c.debtId === d.id && c.id === cycleKey) : undefined;
const cycleDue = cycleKey && d.dueDay ? cycleDates(d.statementDay!, d.dueDay, cycleKey) : null;
const cyclePaid = cycleKey ? paidInCycle(payments, d.id, d.statementDay!, cycleKey) : 0;
```

4. After the credit-limit paragraph (`{d.creditLimit != null && ...}` block), add the cycle block:

```tsx
{d.statementDay && (
  <div className="mb-2">
    <p className="text-[11px] text-stone-500">
      stmt day {d.statementDay}{d.dueDay ? ` · due day ${d.dueDay}` : ""}
      {cycleDue && (
        <span className={daysUntil(cycleDue.dueDate, today) <= 3 ? "font-semibold text-red-600" : ""}>
          {" "}· due {daysUntil(cycleDue.dueDate, today) === 0 ? "today" : `in ${daysUntil(cycleDue.dueDate, today)}d`}
        </span>
      )}
    </p>
    {cycle ? (
      <button onClick={() => setStmtDebt(d)} className="mt-1 w-full text-left">
        <span className="text-[11px] text-stone-500 tabular-nums">
          {peso(Math.min(cyclePaid, cycle.minimumDue))} of {peso(cycle.minimumDue)} min paid · stmt {peso(cycle.statementBalance)}
        </span>
        <span className="mt-0.5 block h-1 rounded-full bg-stone-100 overflow-hidden">
          <span
            className="block h-full bg-emerald-500"
            style={{ width: `${cycle.minimumDue > 0 ? Math.min(100, Math.round((cyclePaid / cycle.minimumDue) * 100)) : 100}%` }}
          />
        </span>
      </button>
    ) : (
      <button
        onClick={() => setStmtDebt(d)}
        className="mt-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-3 py-1"
      >Enter statement</button>
    )}
  </div>
)}
```

5. Mount the dialog next to the existing `ConfirmPayDialog` mount:

```tsx
{stmtDebt?.statementDay && (
  <StatementDialog
    debtName={stmtDebt.name}
    cycleKey={currentCycleKey(stmtDebt.statementDay, today)}
    defaultBalance={
      cycles.find((c) => c.debtId === stmtDebt.id && c.id === currentCycleKey(stmtDebt.statementDay!, today))?.statementBalance
      ?? stmtDebt.currentBalance
    }
    defaultMin={
      cycles.find((c) => c.debtId === stmtDebt.id && c.id === currentCycleKey(stmtDebt.statementDay!, today))?.minimumDue
      ?? stmtDebt.minimum ?? 0
    }
    onConfirm={async (bal, min) => {
      const key = currentCycleKey(stmtDebt.statementDay!, today);
      const dates = cycleDates(stmtDebt.statementDay!, stmtDebt.dueDay ?? stmtDebt.statementDay!, key);
      await setDebtCycle(stmtDebt.id, key, { ...dates, statementBalance: bal, minimumDue: min });
      setStmtDebt(null);
    }}
    onCancel={() => setStmtDebt(null)}
  />
)}
```

- [ ] **Step 4: Typecheck + full tests**

Run: `npm run typecheck && npx vitest run`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/components/StatementDialog.tsx src/components/Debts.tsx src/components/DebtPlan.tsx
git commit -m "feat: per-cycle statement entry + cycle status on the Debts screen"
```

---

### Task 12: Due-soon strip

**Files:**
- Create: `src/components/DueSoonStrip.tsx`
- Modify: `src/components/ThisMonth.tsx`
- Modify: `src/components/Debts.tsx`

**Interfaces:**
- Consumes: `currentCycleKey`, `cycleDates`, `daysUntil`, `paidInCycle` (Task 8); `PaymentRec` with `date` (Task 11).
- Produces: `<DueSoonStrip />` (self-contained; subscribes to its own collections).

- [ ] **Step 1: Create `src/components/DueSoonStrip.tsx`**

```tsx
import { useCollection } from "../hooks/useCollection";
import { useCollectionGroup } from "../hooks/useCollectionGroup";
import { debtsCol } from "../lib/paths";
import { currentCycleKey, cycleDates, daysUntil, paidInCycle } from "../lib/cycles";
import { peso } from "../lib/format";
import type { Debt, DebtCycle } from "../lib/types";
import type { PaymentRec } from "./DebtPlan";

/** Cards due within 7 days whose current-cycle minimum isn't fully paid. */
export default function DueSoonStrip() {
  const debts = useCollection<Debt>(debtsCol());
  const cycles = useCollectionGroup<DebtCycle>("cycles");
  const payments = useCollectionGroup<PaymentRec>("payments");
  const today = new Date();

  const due = debts
    .filter((d) => d.active && d.statementDay && d.dueDay)
    .map((d) => {
      const key = currentCycleKey(d.statementDay!, today);
      const cycle = cycles.find((c) => c.debtId === d.id && c.id === key);
      const { dueDate } = cycleDates(d.statementDay!, d.dueDay!, key);
      const minDue = cycle?.minimumDue ?? d.minimum ?? 0;
      const paid = paidInCycle(payments, d.id, d.statementDay!, key);
      return { d, days: daysUntil(dueDate, today), minDue, paid };
    })
    .filter((x) => x.days >= 0 && x.days <= 7 && x.paid < x.minDue)
    .sort((a, b) => a.days - b.days);

  if (due.length === 0) return null;

  return (
    <div className="mb-4 rounded-xl bg-red-50 border border-red-200 p-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-red-700 mb-1">Due soon</p>
      <ul className="flex flex-col gap-1 text-xs text-red-800">
        {due.map(({ d, days, minDue, paid }) => (
          <li key={d.id} className="flex justify-between gap-2">
            <span>{d.name} · due {days === 0 ? "today" : `in ${days}d`}</span>
            <span className="tabular-nums shrink-0">{peso(paid)} of {peso(minDue)} min paid</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Mount it**

`src/components/Debts.tsx` — import `DueSoonStrip` and render it directly under the headline `<p>` (before the debts `<ul>`):

```tsx
<DueSoonStrip />
```

`src/components/ThisMonth.tsx` — import `DueSoonStrip` and render it after `{header}`, only for the live month:

```tsx
{mode === "current" && <DueSoonStrip />}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/DueSoonStrip.tsx src/components/ThisMonth.tsx src/components/Debts.tsx
git commit -m "feat: due-soon strip — cards due within 7 days with unpaid cycle minimums"
```

---

### Task 13: Wire cycle minimums into the debt plan and send calculator

**Files:**
- Modify: `src/components/ThisMonth.tsx`
- Modify: `src/components/DebtPlan.tsx`
- Modify: `src/components/SendPlan.tsx`

**Interfaces:**
- Consumes: `cycleMinimums` (Task 8), extended `allocateCutoff`/`cutoffAllocation` (Task 9).
- Produces: `DebtPlan` and `SendPlan` gain optional props `cycleMins?: ReadonlyMap<string, number>` (net) and, for SendPlan only, `cycleMinsGross?: ReadonlyMap<string, number>`.

- [ ] **Step 1: Compute the maps in ThisMonth**

In `src/components/ThisMonth.tsx`:

```tsx
import { cycleMinimums } from "../lib/cycles";
import type { DebtCycle } from "../lib/types"; // add to existing types import
```

After the `payments` subscription:

```tsx
const cycles = useCollectionGroup<DebtCycle>("cycles");
// Net = what's still owed on each entered statement minimum; gross = the full minimum
// (start-of-cutoff view for SendPlan's "full" mode).
const cycleMins = cycleMinimums(debts, cycles, payments, new Date());
const cycleMinsGross = cycleMinimums(debts, cycles, [], new Date());
```

Pass them where DebtPlan/SendPlan are mounted:

```tsx
<DebtPlan freeCash={freeCash} debts={debts} payments={payments} monthKey={viewedKey} cutoff={cutoff} unplanned={unplanned} cycleMins={cycleMins} />
<SendPlan freeCash={freeCash} debts={debts} payments={payments} lines={cutLines} monthKey={viewedKey} cutoff={cutoff} cycleMins={cycleMins} cycleMinsGross={cycleMinsGross} />
```

- [ ] **Step 2: DebtPlan uses the net map**

In `src/components/DebtPlan.tsx`, add the prop and pass it to the allocation:

```tsx
export default function DebtPlan({
  freeCash, debts, payments, monthKey, cutoff, unplanned = 0, readOnly = false, cycleMins,
}: {
  freeCash: number; debts: Debt[]; payments: PaymentRec[]; monthKey: string; cutoff: 1 | 2;
  unplanned?: number; readOnly?: boolean; cycleMins?: ReadonlyMap<string, number>;
}) {
```

```tsx
const alloc = allocateCutoff(remaining, debts, cutoff, cycleMins);
```

- [ ] **Step 3: SendPlan uses net for "remaining", gross for "full"**

In `src/components/SendPlan.tsx`:

```tsx
export default function SendPlan({
  freeCash, debts, payments, lines, monthKey, cutoff, cycleMins, cycleMinsGross,
}: {
  freeCash: number; debts: Debt[]; payments: PaymentRec[]; lines: MonthLine[];
  monthKey: string; cutoff: 1 | 2;
  cycleMins?: ReadonlyMap<string, number>; cycleMinsGross?: ReadonlyMap<string, number>;
}) {
```

```tsx
const alloc = mode === "remaining"
  ? allocateCutoff(Math.max(0, freeCash - paidTotal), debts, cutoff, cycleMins)
  : cutoffAllocation(freeCash, debts, paid, cutoff, cycleMinsGross);
```

- [ ] **Step 4: Typecheck + full tests**

Run: `npm run typecheck && npx vitest run`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/components/ThisMonth.tsx src/components/DebtPlan.tsx src/components/SendPlan.tsx
git commit -m "feat: debt plan + send calculator reserve entered statement-cycle minimums"
```

---

### Task 14: Final verification

**Files:** none new.

- [ ] **Step 1: Full suite**

Run: `npx vitest run && npm run typecheck && npm run build`
Expected: all tests pass, no type errors, production build succeeds.

- [ ] **Step 2: Manual walkthrough (dev server)**

Run `npm run dev` and verify in the browser:

1. Tick every line in a cutoff → ✓ CLOSED badge appears; untick one → badge gone.
2. Settings → Template → add a line for the closed cutoff → notice "closed … starts next month" appears and the line does NOT appear in the current month; add one for the open cutoff → it appears.
3. Settings → Template → mark Allowance as Envelope → Quick Add shows a "Paid from" row; log an expense against Allowance → its LineRow shows "₱X left of ₱Y" and free cash is unchanged; log an Unplanned expense → free cash drops.
4. Settings → Debts → set a card's statement day → Debts screen shows "Enter statement"; enter balance + min → cycle line with paid-vs-min bar; the cutoff's DEBT PLAN reserves that minimum.
5. Set a due day within 7 days of today → Due-soon strip appears on This Month and Debts; log the minimum payment → strip entry disappears.
6. Add one-off dialog shows "(closed)" next to a closed cutoff.

Report any failures instead of claiming success.

- [ ] **Step 3: Deploy**

Push to `main` (GitHub Actions auto-deploys):

```bash
git push
```
