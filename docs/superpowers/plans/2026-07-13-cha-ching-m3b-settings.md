# M3b — Settings Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the full Settings screen — a menu that drills into editors for debts, template lines, incomes, categories, sinking funds, and events, plus Change PIN, Export CSV, and Sign out — so every seed-script collection is editable in-app.

**Architecture:** `Settings.tsx` owns a local `section` state and swaps between a menu and full-screen section editors (no router; mirrors `AppShell` tab state). Each editor lives under `src/components/settings/`, subscribes live via `useCollection`, and writes through new uniform CRUD helpers in `repo.ts`. UI always re-renders from Firestore. `deleteDebt` cascades its payment subcollection so deleted debts leave no ghost paid-state on the M3a plan.

**Tech Stack:** React 18 + TypeScript + Vite, Tailwind, Cloud Firestore (`firebase/firestore` v9 modular), Firebase Auth, Vitest.

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-07-13-settings-screen-design.md`.
- **Paths only via `src/lib/paths.ts`; currency via `peso()`; channels from `CHANNELS`** (`src/lib/channels.ts`).
- **Pure logic is unit-tested** (`export.ts`, reorder helper); CRUD/PIN/download verified by manual walkthrough (M1/M2 convention).
- **Template edits affect future months only** — never rewrite an existing month (`MonthProvider` already generates only when a month doc is missing; do not change that).
- **Every delete goes through the shared `ConfirmDialog`** — no unconfirmed deletion.
- **No Firestore schema change.** Only two TS types added (`Category`, `Meta`).
- **Commit per task; footer** `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Do **not** push until Task 9 (push auto-deploys).
- **Verify each task:** `npm run typecheck && npm run build` must pass before commit; `npx vitest run` for tasks with tests.

## File Structure

- `src/lib/types.ts` — **modify:** add `Category`, `Meta`.
- `src/lib/reorder.ts` + `.test.ts` — **create:** pure adjacent-swap helper.
- `src/lib/export.ts` + `.test.ts` — **create:** pure `toCsv`; `downloadCsv` util.
- `src/lib/repo.ts` — **modify:** CRUD helpers for all collections + `updateMeta` + cascade `deleteDebt`.
- `src/lib/pinAuth.ts` — **modify:** add `changePin`.
- `src/components/QuickAdd.tsx` — **modify:** import `Category` from `types.ts` (remove local copy).
- `src/components/AppShell.tsx` — **modify:** render `<Settings/>` instead of the placeholder.
- `src/components/ConfirmDialog.tsx` — **create:** shared confirm modal.
- `src/components/Settings.tsx` — **create:** menu ↔ section shell + Sign out.
- `src/components/settings/*` — **create:** DebtsEditor, TemplateEditor, IncomesEditor, CategoriesEditor, FundsEditor, EventsEditor, ChangePin, ExportData.

---

### Task 1: Shared `ConfirmDialog`, `Category`/`Meta` types, Settings shell + Sign out

**Files:**
- Modify: `src/lib/types.ts`, `src/components/QuickAdd.tsx`, `src/components/AppShell.tsx`
- Create: `src/components/ConfirmDialog.tsx`, `src/components/Settings.tsx`

**Interfaces:**
- Produces: `Category`, `Meta` types; `ConfirmDialog` component; `Settings` screen with a working menu, back navigation, and Sign out.

- [ ] **Step 1: Add types.** In `src/lib/types.ts`, append:

```ts
export interface Category { id: string; name: string; order: number }
export interface Meta { savingsBalance: number; savingsFloor: number; currency: string }
```

- [ ] **Step 2: De-dup `Category` in QuickAdd.** In `src/components/QuickAdd.tsx`, remove the local `interface Category {...}` line and add `Category` to the type import:

```ts
import type { Category, Channel } from "../lib/types";
```

- [ ] **Step 3: Create `ConfirmDialog`.** Create `src/components/ConfirmDialog.tsx`:

```tsx
interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export default function ConfirmDialog({
  title, message, confirmLabel = "Delete", onConfirm, onCancel,
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
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create the Settings shell.** Create `src/components/Settings.tsx`. Editors are added in later tasks; for now every non-null section renders a small stub so navigation is testable:

```tsx
import { useState } from "react";
import { lock } from "../lib/pinAuth";

type Section =
  | "debts" | "template" | "incomes" | "categories" | "funds" | "events" | "pin" | "export";

const ROWS: { id: Section; label: string }[] = [
  { id: "debts", label: "Debts" },
  { id: "template", label: "Template lines" },
  { id: "incomes", label: "Income sources" },
  { id: "categories", label: "Categories" },
  { id: "funds", label: "Sinking funds" },
  { id: "events", label: "Events" },
  { id: "pin", label: "Change PIN" },
  { id: "export", label: "Export CSV" },
];

export default function Settings() {
  const [section, setSection] = useState<Section | null>(null);

  if (section) {
    return (
      <main className="p-4">
        <button onClick={() => setSection(null)} className="text-sm text-emerald-700 font-semibold mb-4">‹ Settings</button>
        <Editor section={section} />
      </main>
    );
  }

  return (
    <main className="p-4">
      <h1 className="text-xl font-bold mb-4">Settings</h1>
      <ul className="bg-white rounded-xl shadow divide-y divide-stone-100 mb-6">
        {ROWS.map((r) => (
          <li key={r.id}>
            <button onClick={() => setSection(r.id)} className="w-full flex items-center justify-between px-4 py-3 text-sm">
              {r.label}
              <span className="text-stone-300">›</span>
            </button>
          </li>
        ))}
      </ul>
      <button
        onClick={() => void lock()}
        className="w-full py-3 rounded-xl bg-white shadow text-sm font-semibold text-red-600"
      >
        Sign out
      </button>
    </main>
  );
}

function Editor({ section }: { section: Section }) {
  return <div className="text-stone-500 text-sm">{section} editor — coming in a later step.</div>;
}
```

- [ ] **Step 5: Mount it.** In `src/components/AppShell.tsx`: add `import Settings from "./Settings";`, remove the `settings` `Placeholder`, and render:

```tsx
        {tab === "settings" && <Settings />}
```

- [ ] **Step 6: Typecheck + build.** Run: `npm run typecheck && npm run build`
Expected: PASS.

- [ ] **Step 7: Commit.**

```bash
git add src/lib/types.ts src/components/QuickAdd.tsx src/components/ConfirmDialog.tsx src/components/Settings.tsx src/components/AppShell.tsx
git commit -m "feat(m3b): Settings shell + menu nav + Sign out; shared ConfirmDialog; Category/Meta types"
```

---

### Task 2: Debts editor — CRUD, cascade delete, reorder

**Files:**
- Create: `src/lib/reorder.ts`, `src/lib/reorder.test.ts`, `src/components/settings/DebtsEditor.tsx`
- Modify: `src/lib/repo.ts`, `src/components/Settings.tsx`

**Interfaces:**
- Produces: `adjacentSwap(...)`; `addDebt`, `updateDebt`, `deleteDebt`; `DebtsEditor`.

- [ ] **Step 1: Write the reorder test.** Create `src/lib/reorder.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { adjacentSwap } from "./reorder";

const items = [
  { id: "a", order: 1 }, { id: "b", order: 2 }, { id: "c", order: 3 },
];

describe("adjacentSwap", () => {
  it("swaps order values with the next item moving down", () => {
    expect(adjacentSwap(items, 0, 1, "order")).toEqual([
      { id: "a", order: 2 }, { id: "b", order: 1 },
    ]);
  });
  it("swaps with the previous item moving up", () => {
    expect(adjacentSwap(items, 2, -1, "order")).toEqual([
      { id: "c", order: 2 }, { id: "b", order: 3 },
    ]);
  });
  it("returns null at the top edge moving up", () => {
    expect(adjacentSwap(items, 0, -1, "order")).toBeNull();
  });
  it("returns null at the bottom edge moving down", () => {
    expect(adjacentSwap(items, 2, 1, "order")).toBeNull();
  });
  it("works with a custom key like payoffOrder", () => {
    const d = [{ id: "x", payoffOrder: 5 }, { id: "y", payoffOrder: 9 }];
    expect(adjacentSwap(d, 0, 1, "payoffOrder")).toEqual([
      { id: "x", payoffOrder: 9 }, { id: "y", payoffOrder: 5 },
    ]);
  });
});
```

- [ ] **Step 2: Run it — fails.** Run: `npx vitest run src/lib/reorder.test.ts`
Expected: FAIL — cannot find module `./reorder`.

- [ ] **Step 3: Implement `reorder.ts`.** Create `src/lib/reorder.ts`:

```ts
/**
 * Given a sorted list and an index, return the two id→newValue patches that swap
 * item[index] with its neighbor in direction dir (-1 up, +1 down) on numeric `key`.
 * Returns null when the move runs off either end. Pure.
 */
export function adjacentSwap<K extends string>(
  items: readonly (Record<K, number> & { id: string })[],
  index: number,
  dir: -1 | 1,
  key: K,
): [Record<K, number> & { id: string }, Record<K, number> & { id: string }] | null {
  const j = index + dir;
  if (j < 0 || j >= items.length) return null;
  const a = items[index], b = items[j];
  return [
    { id: a.id, [key]: b[key] } as Record<K, number> & { id: string },
    { id: b.id, [key]: a[key] } as Record<K, number> & { id: string },
  ];
}
```

- [ ] **Step 4: Run it — passes.** Run: `npx vitest run src/lib/reorder.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Add debt repo helpers.** In `src/lib/repo.ts`, add `getDocs` to the firestore import and `Debt` to the type import, then append:

```ts
/** Create a debt with a generated id. */
export async function addDebt(d: Omit<Debt, "id">): Promise<void> {
  await setDoc(doc(collection(db, debtsCol())), d);
}

/** Patch a debt's fields. */
export async function updateDebt(id: string, patch: Partial<Debt>): Promise<void> {
  await updateDoc(doc(db, debtsCol(), id), patch);
}

/** Hard-delete a debt AND its payments subcollection in one batch (no orphaned ghosts). */
export async function deleteDebt(id: string): Promise<void> {
  const batch = writeBatch(db);
  const pays = await getDocs(collection(db, debtPayments(id)));
  pays.forEach((p) => batch.delete(p.ref));
  batch.delete(doc(db, debtsCol(), id));
  await batch.commit();
}
```

(Import line becomes:
`import { collection, deleteDoc, doc, getDocs, increment, setDoc, updateDoc, writeBatch } from "firebase/firestore";`
and add `Debt` to the `import type { ... } from "./types";` line.)

- [ ] **Step 6: Create `DebtsEditor`.** Create `src/components/settings/DebtsEditor.tsx`:

```tsx
import { useState } from "react";
import { useCollection } from "../../hooks/useCollection";
import { CHANNELS } from "../../lib/channels";
import { peso } from "../../lib/format";
import { debtsCol } from "../../lib/paths";
import { addDebt, updateDebt, deleteDebt } from "../../lib/repo";
import { adjacentSwap } from "../../lib/reorder";
import type { Channel, Debt } from "../../lib/types";
import ConfirmDialog from "../ConfirmDialog";

const BLANK: Omit<Debt, "id"> = {
  name: "", startingBalance: 0, currentBalance: 0, payoffOrder: 99,
  channel: "RCBC", isBNPL: false, active: true,
};

export default function DebtsEditor() {
  const debts = useCollection<Debt>(debtsCol());
  const sorted = [...debts].sort((a, b) => a.payoffOrder - b.payoffOrder);
  const [editing, setEditing] = useState<Debt | Omit<Debt, "id"> | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  async function move(index: number, dir: -1 | 1) {
    const pair = adjacentSwap(sorted, index, dir, "payoffOrder");
    if (!pair) return;
    await Promise.all(pair.map((p) => updateDebt(p.id, { payoffOrder: p.payoffOrder })));
  }

  if (editing) return <DebtForm debt={editing} onDone={() => setEditing(null)} />;

  return (
    <div>
      <h2 className="font-bold text-lg mb-3">Debts</h2>
      <ul className="flex flex-col gap-2">
        {sorted.map((d, i) => (
          <li key={d.id} className="bg-white rounded-xl shadow p-3 flex items-center gap-2">
            <span className="flex flex-col">
              <button onClick={() => void move(i, -1)} disabled={i === 0} className="text-stone-400 disabled:opacity-20 leading-none">▲</button>
              <button onClick={() => void move(i, 1)} disabled={i === sorted.length - 1} className="text-stone-400 disabled:opacity-20 leading-none">▼</button>
            </span>
            <button onClick={() => setEditing(d)} className="flex-1 flex items-center justify-between min-w-0">
              <span className="truncate text-sm font-medium">{d.name}{d.isBNPL ? " · BNPL" : ""}{d.active ? "" : " · archived"}</span>
              <span className="text-sm tabular-nums">{peso(d.currentBalance)}</span>
            </button>
            <button onClick={() => setConfirmId(d.id)} className="text-red-500 text-xs px-1">✕</button>
          </li>
        ))}
      </ul>
      <button onClick={() => setEditing({ ...BLANK })} className="mt-3 text-sm font-semibold text-emerald-700">+ Add debt</button>
      {confirmId && (
        <ConfirmDialog
          title="Delete debt?"
          message="This permanently removes the debt and its payment history."
          onConfirm={async () => { await deleteDebt(confirmId); setConfirmId(null); }}
          onCancel={() => setConfirmId(null)}
        />
      )}
    </div>
  );
}

function DebtForm({ debt, onDone }: { debt: Debt | Omit<Debt, "id">; onDone: () => void }) {
  const [f, setF] = useState(debt);
  const id = "id" in debt ? debt.id : null;
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF({ ...f, [k]: v });
  const num = (s: string) => (s === "" ? 0 : Number(s));

  async function save() {
    if (!f.name.trim()) return;
    if (id) await updateDebt(id, f);
    else await addDebt(f);
    onDone();
  }

  // Plain helper that RETURNS JSX (not a nested component) — a nested component
  // would get a new identity each render and remount the input, losing focus.
  const numberField = (label: string, k: "startingBalance" | "currentBalance" | "payoffOrder" | "dueDay" | "minimum") => (
    <label className="flex items-center justify-between text-sm">
      {label}
      <input
        type="number" inputMode="decimal"
        value={(f[k] as number | undefined) ?? ""}
        onChange={(e) => set(k, (e.target.value === "" ? undefined : num(e.target.value)) as never)}
        className="w-28 text-right border-b border-stone-300 outline-none tabular-nums"
      />
    </label>
  );

  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-bold text-lg">{id ? "Edit debt" : "Add debt"}</h2>
      <input placeholder="Name" value={f.name} onChange={(e) => set("name", e.target.value)}
        className="text-sm border-b border-stone-300 outline-none pb-1" />
      {numberField("Starting balance", "startingBalance")}
      {numberField("Current balance", "currentBalance")}
      {numberField("Payoff order", "payoffOrder")}
      {numberField("Due day (1–31)", "dueDay")}
      {numberField("Minimum", "minimum")}
      <label className="flex items-center justify-between text-sm">
        Channel
        <select value={f.channel} onChange={(e) => set("channel", e.target.value as Channel)} className="text-sm border-b border-stone-300 outline-none">
          {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>
      <label className="flex items-center justify-between text-sm">0% BNPL
        <input type="checkbox" checked={f.isBNPL} onChange={(e) => set("isBNPL", e.target.checked)} />
      </label>
      <label className="flex items-center justify-between text-sm">Active
        <input type="checkbox" checked={f.active} onChange={(e) => set("active", e.target.checked)} />
      </label>
      <div className="flex gap-2 mt-2">
        <button onClick={onDone} className="flex-1 py-2 rounded-lg text-sm text-stone-500 bg-stone-100">Cancel</button>
        <button onClick={() => void save()} disabled={!f.name.trim()}
          className="flex-1 py-2 rounded-lg text-sm font-semibold text-white bg-emerald-600 disabled:opacity-40">Save</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Wire into Settings.** In `src/components/Settings.tsx`, import `DebtsEditor` and render it from `Editor` when `section === "debts"`:

```tsx
import DebtsEditor from "./settings/DebtsEditor";
```
```tsx
function Editor({ section }: { section: Section }) {
  if (section === "debts") return <DebtsEditor />;
  return <div className="text-stone-500 text-sm">{section} editor — coming in a later step.</div>;
}
```

- [ ] **Step 8: Typecheck + build + tests.** Run: `npm run typecheck && npm run build && npx vitest run`
Expected: all PASS.

- [ ] **Step 9: Commit.**

```bash
git add src/lib/reorder.ts src/lib/reorder.test.ts src/lib/repo.ts src/components/settings/DebtsEditor.tsx src/components/Settings.tsx
git commit -m "feat(m3b): Debts editor — CRUD, reorder, cascade delete"
```

---

### Task 3: Template lines + Income sources editors

**Files:**
- Create: `src/components/settings/TemplateEditor.tsx`, `src/components/settings/IncomesEditor.tsx`
- Modify: `src/lib/repo.ts`, `src/components/Settings.tsx`

**Interfaces:**
- Produces: `addTemplateLine/updateTemplateLine/deleteTemplateLine`, `addTemplateIncome/updateTemplateIncome/deleteTemplateIncome`; two editors.

- [ ] **Step 1: Repo helpers.** In `src/lib/repo.ts`, add `TemplateLine`, `Income` to the type import and `templateLines`, `templateIncomes` to the paths import, then append:

```ts
export async function addTemplateLine(l: Omit<TemplateLine, "id">): Promise<void> {
  await setDoc(doc(collection(db, templateLines())), l);
}
export async function updateTemplateLine(id: string, patch: Partial<TemplateLine>): Promise<void> {
  await updateDoc(doc(db, templateLines(), id), patch);
}
export async function deleteTemplateLine(id: string): Promise<void> {
  await deleteDoc(doc(db, templateLines(), id));
}
export async function addTemplateIncome(i: Omit<Income, "id">): Promise<void> {
  await setDoc(doc(collection(db, templateIncomes())), i);
}
export async function updateTemplateIncome(id: string, patch: Partial<Income>): Promise<void> {
  await updateDoc(doc(db, templateIncomes(), id), patch);
}
export async function deleteTemplateIncome(id: string): Promise<void> {
  await deleteDoc(doc(db, templateIncomes(), id));
}
```

- [ ] **Step 2: Create `TemplateEditor`.** Create `src/components/settings/TemplateEditor.tsx`:

```tsx
import { useState } from "react";
import { useCollection } from "../../hooks/useCollection";
import { CHANNELS } from "../../lib/channels";
import { peso } from "../../lib/format";
import { templateLines } from "../../lib/paths";
import { addTemplateLine, updateTemplateLine, deleteTemplateLine } from "../../lib/repo";
import type { Channel, TemplateLine } from "../../lib/types";
import ConfirmDialog from "../ConfirmDialog";

const BLANK: Omit<TemplateLine, "id"> = { name: "", amount: 0, channel: "CIMB", cutoff: 1, order: 99 };

export default function TemplateEditor() {
  const lines = useCollection<TemplateLine>(templateLines());
  const sorted = [...lines].sort((a, b) => (a.cutoff - b.cutoff) || (a.order - b.order));
  const [editing, setEditing] = useState<TemplateLine | Omit<TemplateLine, "id"> | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  if (editing) return <Form line={editing} onDone={() => setEditing(null)} />;

  return (
    <div>
      <h2 className="font-bold text-lg mb-1">Template lines</h2>
      <p className="text-xs text-stone-400 mb-3">Changes apply to future months only.</p>
      <ul className="flex flex-col gap-2">
        {sorted.map((l) => (
          <li key={l.id} className="bg-white rounded-xl shadow p-3 flex items-center gap-2">
            <button onClick={() => setEditing(l)} className="flex-1 flex items-center justify-between min-w-0">
              <span className="truncate text-sm">C{l.cutoff} · {l.name}</span>
              <span className="text-sm tabular-nums">{peso(l.amount)}</span>
            </button>
            <button onClick={() => setConfirmId(l.id)} className="text-red-500 text-xs px-1">✕</button>
          </li>
        ))}
      </ul>
      <button onClick={() => setEditing({ ...BLANK })} className="mt-3 text-sm font-semibold text-emerald-700">+ Add line</button>
      {confirmId && (
        <ConfirmDialog title="Delete template line?" message="Removed from future months."
          onConfirm={async () => { await deleteTemplateLine(confirmId); setConfirmId(null); }}
          onCancel={() => setConfirmId(null)} />
      )}
    </div>
  );
}

function Form({ line, onDone }: { line: TemplateLine | Omit<TemplateLine, "id">; onDone: () => void }) {
  const [f, setF] = useState(line);
  const id = "id" in line ? line.id : null;
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF({ ...f, [k]: v });

  async function save() {
    if (!f.name.trim()) return;
    if (id) await updateTemplateLine(id, f); else await addTemplateLine(f);
    onDone();
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-bold text-lg">{id ? "Edit line" : "Add line"}</h2>
      <input placeholder="Name" value={f.name} onChange={(e) => set("name", e.target.value)} className="text-sm border-b border-stone-300 outline-none pb-1" />
      <label className="flex items-center justify-between text-sm">Amount
        <input type="number" inputMode="decimal" value={f.amount || ""} onChange={(e) => set("amount", Number(e.target.value))} className="w-28 text-right border-b border-stone-300 outline-none tabular-nums" />
      </label>
      <label className="flex items-center justify-between text-sm">Cutoff
        <select value={f.cutoff} onChange={(e) => set("cutoff", Number(e.target.value) as 1 | 2)} className="text-sm border-b border-stone-300 outline-none">
          <option value={1}>1</option><option value={2}>2</option>
        </select>
      </label>
      <label className="flex items-center justify-between text-sm">Channel
        <select value={f.channel} onChange={(e) => set("channel", e.target.value as Channel)} className="text-sm border-b border-stone-300 outline-none">
          {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>
      <label className="flex items-center justify-between text-sm">Order
        <input type="number" value={f.order} onChange={(e) => set("order", Number(e.target.value))} className="w-20 text-right border-b border-stone-300 outline-none tabular-nums" />
      </label>
      <div className="flex gap-2 mt-2">
        <button onClick={onDone} className="flex-1 py-2 rounded-lg text-sm text-stone-500 bg-stone-100">Cancel</button>
        <button onClick={() => void save()} disabled={!f.name.trim()} className="flex-1 py-2 rounded-lg text-sm font-semibold text-white bg-emerald-600 disabled:opacity-40">Save</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create `IncomesEditor`.** Create `src/components/settings/IncomesEditor.tsx`:

```tsx
import { useState } from "react";
import { useCollection } from "../../hooks/useCollection";
import { peso } from "../../lib/format";
import { templateIncomes } from "../../lib/paths";
import { addTemplateIncome, updateTemplateIncome, deleteTemplateIncome } from "../../lib/repo";
import type { Income } from "../../lib/types";
import ConfirmDialog from "../ConfirmDialog";

const BLANK: Omit<Income, "id"> = { name: "", amount: 0, day: 13, cutoff: 1 };

export default function IncomesEditor() {
  const incomes = useCollection<Income>(templateIncomes());
  const sorted = [...incomes].sort((a, b) => (a.cutoff - b.cutoff) || (a.day - b.day));
  const [editing, setEditing] = useState<Income | Omit<Income, "id"> | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  if (editing) return <Form income={editing} onDone={() => setEditing(null)} />;

  return (
    <div>
      <h2 className="font-bold text-lg mb-3">Income sources</h2>
      <ul className="flex flex-col gap-2">
        {sorted.map((i) => (
          <li key={i.id} className="bg-white rounded-xl shadow p-3 flex items-center gap-2">
            <button onClick={() => setEditing(i)} className="flex-1 flex items-center justify-between min-w-0">
              <span className="truncate text-sm">C{i.cutoff} · day {i.day} · {i.name}</span>
              <span className="text-sm tabular-nums">{peso(i.amount)}</span>
            </button>
            <button onClick={() => setConfirmId(i.id)} className="text-red-500 text-xs px-1">✕</button>
          </li>
        ))}
      </ul>
      <button onClick={() => setEditing({ ...BLANK })} className="mt-3 text-sm font-semibold text-emerald-700">+ Add income</button>
      {confirmId && (
        <ConfirmDialog title="Delete income source?" message="Removed from future months."
          onConfirm={async () => { await deleteTemplateIncome(confirmId); setConfirmId(null); }}
          onCancel={() => setConfirmId(null)} />
      )}
    </div>
  );
}

function Form({ income, onDone }: { income: Income | Omit<Income, "id">; onDone: () => void }) {
  const [f, setF] = useState(income);
  const id = "id" in income ? income.id : null;
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF({ ...f, [k]: v });

  async function save() {
    if (!f.name.trim()) return;
    if (id) await updateTemplateIncome(id, f); else await addTemplateIncome(f);
    onDone();
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-bold text-lg">{id ? "Edit income" : "Add income"}</h2>
      <input placeholder="Name" value={f.name} onChange={(e) => set("name", e.target.value)} className="text-sm border-b border-stone-300 outline-none pb-1" />
      <label className="flex items-center justify-between text-sm">Amount
        <input type="number" inputMode="decimal" value={f.amount || ""} onChange={(e) => set("amount", Number(e.target.value))} className="w-28 text-right border-b border-stone-300 outline-none tabular-nums" />
      </label>
      <label className="flex items-center justify-between text-sm">Day (1–31)
        <input type="number" value={f.day} onChange={(e) => set("day", Number(e.target.value))} className="w-20 text-right border-b border-stone-300 outline-none tabular-nums" />
      </label>
      <label className="flex items-center justify-between text-sm">Cutoff
        <select value={f.cutoff} onChange={(e) => set("cutoff", Number(e.target.value) as 1 | 2)} className="text-sm border-b border-stone-300 outline-none">
          <option value={1}>1</option><option value={2}>2</option>
        </select>
      </label>
      <div className="flex gap-2 mt-2">
        <button onClick={onDone} className="flex-1 py-2 rounded-lg text-sm text-stone-500 bg-stone-100">Cancel</button>
        <button onClick={() => void save()} disabled={!f.name.trim()} className="flex-1 py-2 rounded-lg text-sm font-semibold text-white bg-emerald-600 disabled:opacity-40">Save</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Wire into Settings.** In `src/components/Settings.tsx`, import both and extend `Editor`:

```tsx
import TemplateEditor from "./settings/TemplateEditor";
import IncomesEditor from "./settings/IncomesEditor";
```
```tsx
  if (section === "template") return <TemplateEditor />;
  if (section === "incomes") return <IncomesEditor />;
```

- [ ] **Step 5: Typecheck + build.** Run: `npm run typecheck && npm run build`
Expected: PASS.

- [ ] **Step 6: Commit.**

```bash
git add src/lib/repo.ts src/components/settings/TemplateEditor.tsx src/components/settings/IncomesEditor.tsx src/components/Settings.tsx
git commit -m "feat(m3b): template lines + income sources editors"
```

---

### Task 4: Categories editor (CRUD + reorder)

**Files:**
- Create: `src/components/settings/CategoriesEditor.tsx`
- Modify: `src/lib/repo.ts`, `src/components/Settings.tsx`

**Interfaces:**
- Produces: `addCategory/updateCategory/deleteCategory`; `CategoriesEditor` (reuses `adjacentSwap` on `order`).

- [ ] **Step 1: Repo helpers.** In `src/lib/repo.ts`, add `Category` to the type import and `categoriesCol` to the paths import, then append:

```ts
export async function addCategory(c: Omit<Category, "id">): Promise<void> {
  await setDoc(doc(collection(db, categoriesCol())), c);
}
export async function updateCategory(id: string, patch: Partial<Category>): Promise<void> {
  await updateDoc(doc(db, categoriesCol(), id), patch);
}
export async function deleteCategory(id: string): Promise<void> {
  await deleteDoc(doc(db, categoriesCol(), id));
}
```

- [ ] **Step 2: Create `CategoriesEditor`.** Create `src/components/settings/CategoriesEditor.tsx`:

```tsx
import { useState } from "react";
import { useCollection } from "../../hooks/useCollection";
import { categoriesCol } from "../../lib/paths";
import { addCategory, updateCategory, deleteCategory } from "../../lib/repo";
import { adjacentSwap } from "../../lib/reorder";
import type { Category } from "../../lib/types";
import ConfirmDialog from "../ConfirmDialog";

export default function CategoriesEditor() {
  const cats = useCollection<Category>(categoriesCol());
  const sorted = [...cats].sort((a, b) => a.order - b.order);
  const [newName, setNewName] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);

  async function add() {
    if (!newName.trim()) return;
    const maxOrder = sorted.reduce((m, c) => Math.max(m, c.order), 0);
    await addCategory({ name: newName.trim(), order: maxOrder + 1 });
    setNewName("");
  }
  async function move(index: number, dir: -1 | 1) {
    const pair = adjacentSwap(sorted, index, dir, "order");
    if (!pair) return;
    await Promise.all(pair.map((p) => updateCategory(p.id, { order: p.order })));
  }

  return (
    <div>
      <h2 className="font-bold text-lg mb-3">Categories</h2>
      <ul className="flex flex-col gap-2">
        {sorted.map((c, i) => (
          <li key={c.id} className="bg-white rounded-xl shadow p-3 flex items-center gap-2">
            <span className="flex flex-col">
              <button onClick={() => void move(i, -1)} disabled={i === 0} className="text-stone-400 disabled:opacity-20 leading-none">▲</button>
              <button onClick={() => void move(i, 1)} disabled={i === sorted.length - 1} className="text-stone-400 disabled:opacity-20 leading-none">▼</button>
            </span>
            <input defaultValue={c.name} onBlur={(e) => { if (e.target.value.trim() && e.target.value !== c.name) void updateCategory(c.id, { name: e.target.value.trim() }); }}
              className="flex-1 text-sm outline-none border-b border-transparent focus:border-stone-300" />
            <button onClick={() => setConfirmId(c.id)} className="text-red-500 text-xs px-1">✕</button>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex gap-2">
        <input placeholder="New category" value={newName} onChange={(e) => setNewName(e.target.value)} className="flex-1 text-sm border-b border-stone-300 outline-none" />
        <button onClick={() => void add()} disabled={!newName.trim()} className="text-sm font-semibold text-emerald-700 disabled:opacity-40">Add</button>
      </div>
      {confirmId && (
        <ConfirmDialog title="Delete category?" message="Quick Add will no longer suggest it."
          onConfirm={async () => { await deleteCategory(confirmId); setConfirmId(null); }}
          onCancel={() => setConfirmId(null)} />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Wire into Settings.** In `src/components/Settings.tsx`:

```tsx
import CategoriesEditor from "./settings/CategoriesEditor";
```
```tsx
  if (section === "categories") return <CategoriesEditor />;
```

- [ ] **Step 4: Typecheck + build.** Run: `npm run typecheck && npm run build`
Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add src/lib/repo.ts src/components/settings/CategoriesEditor.tsx src/components/Settings.tsx
git commit -m "feat(m3b): categories editor with reorder"
```

---

### Task 5: Sinking funds editor

**Files:**
- Create: `src/components/settings/FundsEditor.tsx`
- Modify: `src/lib/repo.ts`, `src/components/Settings.tsx`

**Interfaces:**
- Produces: `addFund/updateFund/deleteFund`; `FundsEditor` with a 1–12 month multi-select for `releaseMonths`.

- [ ] **Step 1: Repo helpers.** In `src/lib/repo.ts`, add `SinkingFund` to the type import and `fundsCol` to the paths import, then append:

```ts
export async function addFund(fund: Omit<SinkingFund, "id">): Promise<void> {
  await setDoc(doc(collection(db, fundsCol())), fund);
}
export async function updateFund(id: string, patch: Partial<SinkingFund>): Promise<void> {
  await updateDoc(doc(db, fundsCol(), id), patch);
}
export async function deleteFund(id: string): Promise<void> {
  await deleteDoc(doc(db, fundsCol(), id));
}
```

- [ ] **Step 2: Create `FundsEditor`.** Create `src/components/settings/FundsEditor.tsx`:

```tsx
import { useState } from "react";
import { useCollection } from "../../hooks/useCollection";
import { peso } from "../../lib/format";
import { fundsCol } from "../../lib/paths";
import { addFund, updateFund, deleteFund } from "../../lib/repo";
import type { SinkingFund } from "../../lib/types";
import ConfirmDialog from "../ConfirmDialog";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const BLANK: Omit<SinkingFund, "id"> = { name: "", monthlyDeposit: 0, releaseMonths: [], balance: 0 };

export default function FundsEditor() {
  const funds = useCollection<SinkingFund>(fundsCol());
  const [editing, setEditing] = useState<SinkingFund | Omit<SinkingFund, "id"> | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  if (editing) return <Form fund={editing} onDone={() => setEditing(null)} />;

  return (
    <div>
      <h2 className="font-bold text-lg mb-3">Sinking funds</h2>
      <ul className="flex flex-col gap-2">
        {funds.map((fund) => (
          <li key={fund.id} className="bg-white rounded-xl shadow p-3 flex items-center gap-2">
            <button onClick={() => setEditing(fund)} className="flex-1 flex items-center justify-between min-w-0">
              <span className="truncate text-sm">{fund.name}</span>
              <span className="text-sm tabular-nums">{peso(fund.monthlyDeposit)}/mo</span>
            </button>
            <button onClick={() => setConfirmId(fund.id)} className="text-red-500 text-xs px-1">✕</button>
          </li>
        ))}
      </ul>
      <button onClick={() => setEditing({ ...BLANK })} className="mt-3 text-sm font-semibold text-emerald-700">+ Add fund</button>
      {confirmId && (
        <ConfirmDialog title="Delete sinking fund?" message="Its schedule and balance are removed."
          onConfirm={async () => { await deleteFund(confirmId); setConfirmId(null); }}
          onCancel={() => setConfirmId(null)} />
      )}
    </div>
  );
}

function Form({ fund, onDone }: { fund: SinkingFund | Omit<SinkingFund, "id">; onDone: () => void }) {
  const [f, setF] = useState(fund);
  const id = "id" in fund ? fund.id : null;
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF({ ...f, [k]: v });
  const toggleMonth = (m: number) =>
    set("releaseMonths", f.releaseMonths.includes(m) ? f.releaseMonths.filter((x) => x !== m) : [...f.releaseMonths, m].sort((a, b) => a - b));

  async function save() {
    if (!f.name.trim()) return;
    if (id) await updateFund(id, f); else await addFund(f);
    onDone();
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-bold text-lg">{id ? "Edit fund" : "Add fund"}</h2>
      <input placeholder="Name" value={f.name} onChange={(e) => set("name", e.target.value)} className="text-sm border-b border-stone-300 outline-none pb-1" />
      <label className="flex items-center justify-between text-sm">Monthly deposit
        <input type="number" inputMode="decimal" value={f.monthlyDeposit || ""} onChange={(e) => set("monthlyDeposit", Number(e.target.value))} className="w-28 text-right border-b border-stone-300 outline-none tabular-nums" />
      </label>
      <label className="flex items-center justify-between text-sm">Balance
        <input type="number" inputMode="decimal" value={f.balance || ""} onChange={(e) => set("balance", Number(e.target.value))} className="w-28 text-right border-b border-stone-300 outline-none tabular-nums" />
      </label>
      <div>
        <p className="text-sm mb-1">Release months</p>
        <div className="flex flex-wrap gap-1">
          {MONTHS.map((label, i) => {
            const m = i + 1;
            const on = f.releaseMonths.includes(m);
            return (
              <button key={m} onClick={() => toggleMonth(m)}
                className={`text-xs px-2 py-1 rounded-full ${on ? "bg-emerald-600 text-white" : "bg-stone-100 text-stone-500"}`}>
                {label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex gap-2 mt-2">
        <button onClick={onDone} className="flex-1 py-2 rounded-lg text-sm text-stone-500 bg-stone-100">Cancel</button>
        <button onClick={() => void save()} disabled={!f.name.trim()} className="flex-1 py-2 rounded-lg text-sm font-semibold text-white bg-emerald-600 disabled:opacity-40">Save</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Wire into Settings.** In `src/components/Settings.tsx`:

```tsx
import FundsEditor from "./settings/FundsEditor";
```
```tsx
  if (section === "funds") return <FundsEditor />;
```

- [ ] **Step 4: Typecheck + build.** Run: `npm run typecheck && npm run build`
Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add src/lib/repo.ts src/components/settings/FundsEditor.tsx src/components/Settings.tsx
git commit -m "feat(m3b): sinking funds editor"
```

---

### Task 6: Events editor

**Files:**
- Create: `src/components/settings/EventsEditor.tsx`
- Modify: `src/lib/repo.ts`, `src/components/Settings.tsx`

**Interfaces:**
- Produces: `addEvent/updateEvent/deleteEvent`; `EventsEditor`.

- [ ] **Step 1: Repo helpers.** In `src/lib/repo.ts`, add `EventItem` to the type import and `eventsCol` to the paths import, then append:

```ts
export async function addEvent(e: Omit<EventItem, "id">): Promise<void> {
  await setDoc(doc(collection(db, eventsCol())), e);
}
export async function updateEvent(id: string, patch: Partial<EventItem>): Promise<void> {
  await updateDoc(doc(db, eventsCol(), id), patch);
}
export async function deleteEvent(id: string): Promise<void> {
  await deleteDoc(doc(db, eventsCol(), id));
}
```

- [ ] **Step 2: Create `EventsEditor`.** Create `src/components/settings/EventsEditor.tsx`:

```tsx
import { useState } from "react";
import { useCollection } from "../../hooks/useCollection";
import { CHANNELS } from "../../lib/channels";
import { peso } from "../../lib/format";
import { eventsCol } from "../../lib/paths";
import { addEvent, updateEvent, deleteEvent } from "../../lib/repo";
import type { Channel, EventItem } from "../../lib/types";
import ConfirmDialog from "../ConfirmDialog";

const BLANK: Omit<EventItem, "id"> = { name: "", amount: 0, month: "" };

export default function EventsEditor() {
  const events = useCollection<EventItem>(eventsCol());
  const sorted = [...events].sort((a, b) => a.month.localeCompare(b.month));
  const [editing, setEditing] = useState<EventItem | Omit<EventItem, "id"> | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  if (editing) return <Form ev={editing} onDone={() => setEditing(null)} />;

  return (
    <div>
      <h2 className="font-bold text-lg mb-1">Events</h2>
      <p className="text-xs text-stone-400 mb-3">Suggested one-off lines when a month is generated.</p>
      <ul className="flex flex-col gap-2">
        {sorted.map((e) => (
          <li key={e.id} className="bg-white rounded-xl shadow p-3 flex items-center gap-2">
            <button onClick={() => setEditing(e)} className="flex-1 flex items-center justify-between min-w-0">
              <span className="truncate text-sm">{e.month} · {e.name}</span>
              <span className="text-sm tabular-nums">{peso(e.amount)}</span>
            </button>
            <button onClick={() => setConfirmId(e.id)} className="text-red-500 text-xs px-1">✕</button>
          </li>
        ))}
      </ul>
      <button onClick={() => setEditing({ ...BLANK })} className="mt-3 text-sm font-semibold text-emerald-700">+ Add event</button>
      {confirmId && (
        <ConfirmDialog title="Delete event?" message="It will no longer be suggested."
          onConfirm={async () => { await deleteEvent(confirmId); setConfirmId(null); }}
          onCancel={() => setConfirmId(null)} />
      )}
    </div>
  );
}

function Form({ ev, onDone }: { ev: EventItem | Omit<EventItem, "id">; onDone: () => void }) {
  const [f, setF] = useState(ev);
  const id = "id" in ev ? ev.id : null;
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF({ ...f, [k]: v });
  const validMonth = /^\d{4}-\d{2}$/.test(f.month);

  async function save() {
    if (!f.name.trim() || !validMonth) return;
    if (id) await updateEvent(id, f); else await addEvent(f);
    onDone();
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-bold text-lg">{id ? "Edit event" : "Add event"}</h2>
      <input placeholder="Name" value={f.name} onChange={(e) => set("name", e.target.value)} className="text-sm border-b border-stone-300 outline-none pb-1" />
      <label className="flex items-center justify-between text-sm">Amount
        <input type="number" inputMode="decimal" value={f.amount || ""} onChange={(e) => set("amount", Number(e.target.value))} className="w-28 text-right border-b border-stone-300 outline-none tabular-nums" />
      </label>
      <label className="flex items-center justify-between text-sm">Month (YYYY-MM)
        <input placeholder="2026-08" value={f.month} onChange={(e) => set("month", e.target.value)} className="w-28 text-right border-b border-stone-300 outline-none tabular-nums" />
      </label>
      <label className="flex items-center justify-between text-sm">Channel (optional)
        <select value={f.channel ?? ""} onChange={(e) => set("channel", (e.target.value || undefined) as Channel | undefined)} className="text-sm border-b border-stone-300 outline-none">
          <option value="">—</option>
          {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>
      <input placeholder="Note (optional)" value={f.note ?? ""} onChange={(e) => set("note", e.target.value || undefined)} className="text-sm border-b border-stone-300 outline-none pb-1" />
      <div className="flex gap-2 mt-2">
        <button onClick={onDone} className="flex-1 py-2 rounded-lg text-sm text-stone-500 bg-stone-100">Cancel</button>
        <button onClick={() => void save()} disabled={!f.name.trim() || !validMonth} className="flex-1 py-2 rounded-lg text-sm font-semibold text-white bg-emerald-600 disabled:opacity-40">Save</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Wire into Settings.** In `src/components/Settings.tsx`:

```tsx
import EventsEditor from "./settings/EventsEditor";
```
```tsx
  if (section === "events") return <EventsEditor />;
```

- [ ] **Step 4: Typecheck + build.** Run: `npm run typecheck && npm run build`
Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add src/lib/repo.ts src/components/settings/EventsEditor.tsx src/components/Settings.tsx
git commit -m "feat(m3b): events editor"
```

---

### Task 7: Change PIN

**Files:**
- Modify: `src/lib/pinAuth.ts`, `src/components/Settings.tsx`
- Create: `src/components/settings/ChangePin.tsx`

**Interfaces:**
- Produces: `changePin(currentPin: string, newPin: string): Promise<void>`; `ChangePin` component.

- [ ] **Step 1: Add `changePin`.** In `src/lib/pinAuth.ts`, extend the firebase/auth import and append the function:

```ts
import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
} from "firebase/auth";
```
```ts
/** Re-authenticate with the current PIN, then set a new one. Throws on wrong current PIN. */
export async function changePin(currentPin: string, newPin: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error("Not signed in");
  const cred = EmailAuthProvider.credential(EMAIL, toPassword(currentPin));
  await reauthenticateWithCredential(user, cred);
  await updatePassword(user, toPassword(newPin));
}
```

- [ ] **Step 2: Create `ChangePin`.** Create `src/components/settings/ChangePin.tsx`:

```tsx
import { useState } from "react";
import { changePin } from "../../lib/pinAuth";

export default function ChangePin() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const valid = /^\d{6}$/.test(current) && /^\d{6}$/.test(next) && next === confirm;

  async function save() {
    if (!valid || busy) return;
    setBusy(true);
    setMsg(null);
    try {
      await changePin(current, next);
      setMsg({ ok: true, text: "PIN changed." });
      setCurrent(""); setNext(""); setConfirm("");
    } catch {
      setMsg({ ok: false, text: "Couldn't change PIN — check your current PIN." });
    } finally {
      setBusy(false);
    }
  }

  const box = "w-full text-lg tracking-widest text-center tabular-nums border-b-2 border-stone-300 outline-none focus:border-emerald-500 py-1";

  return (
    <div className="flex flex-col gap-4 max-w-xs">
      <h2 className="font-bold text-lg">Change PIN</h2>
      <input type="password" inputMode="numeric" maxLength={6} placeholder="Current PIN" value={current} onChange={(e) => setCurrent(e.target.value.replace(/\D/g, ""))} className={box} />
      <input type="password" inputMode="numeric" maxLength={6} placeholder="New 6-digit PIN" value={next} onChange={(e) => setNext(e.target.value.replace(/\D/g, ""))} className={box} />
      <input type="password" inputMode="numeric" maxLength={6} placeholder="Confirm new PIN" value={confirm} onChange={(e) => setConfirm(e.target.value.replace(/\D/g, ""))} className={box} />
      {msg && <p className={`text-sm ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>{msg.text}</p>}
      <button onClick={() => void save()} disabled={!valid || busy} className="py-2 rounded-lg text-sm font-semibold text-white bg-emerald-600 disabled:opacity-40">Change PIN</button>
    </div>
  );
}
```

- [ ] **Step 3: Wire into Settings.** In `src/components/Settings.tsx`:

```tsx
import ChangePin from "./settings/ChangePin";
```
```tsx
  if (section === "pin") return <ChangePin />;
```

- [ ] **Step 4: Typecheck + build.** Run: `npm run typecheck && npm run build`
Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add src/lib/pinAuth.ts src/components/settings/ChangePin.tsx src/components/Settings.tsx
git commit -m "feat(m3b): change PIN via reauth + updatePassword"
```

---

### Task 8: Export CSV (pure + tested)

**Files:**
- Create: `src/lib/export.ts`, `src/lib/export.test.ts`, `src/components/settings/ExportData.tsx`
- Modify: `src/components/Settings.tsx`

**Interfaces:**
- Produces: `toCsv(rows, columns)`; `downloadCsv(filename, text)`; `ExportData` component.

- [ ] **Step 1: Write the CSV test.** Create `src/lib/export.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { toCsv } from "./export";

describe("toCsv", () => {
  it("writes a header then one line per row in column order", () => {
    const csv = toCsv(
      [{ a: 1, b: "x" }, { a: 2, b: "y" }],
      [{ key: "a", label: "A" }, { key: "b", label: "B" }],
    );
    expect(csv).toBe("A,B\r\n1,x\r\n2,y");
  });
  it("quotes and doubles quotes for fields with commas, quotes, or newlines", () => {
    const csv = toCsv(
      [{ n: 'a,b' }, { n: 'say "hi"' }, { n: "line\nbreak" }],
      [{ key: "n", label: "N" }],
    );
    expect(csv).toBe('N\r\n"a,b"\r\n"say ""hi"""\r\n"line\nbreak"');
  });
  it("renders empty rows as a header-only file", () => {
    expect(toCsv([], [{ key: "a", label: "A" }, { key: "b", label: "B" }])).toBe("A,B");
  });
  it("renders undefined/null cells as empty", () => {
    expect(toCsv([{ a: undefined, b: null }], [{ key: "a", label: "A" }, { key: "b", label: "B" }])).toBe("A,B\r\n,");
  });
});
```

- [ ] **Step 2: Run it — fails.** Run: `npx vitest run src/lib/export.test.ts`
Expected: FAIL — cannot find module `./export`.

- [ ] **Step 3: Implement `export.ts`.** Create `src/lib/export.ts`:

```ts
export interface Column<T> { key: keyof T & string; label: string }

const cell = (v: unknown): string => {
  if (v === undefined || v === null) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** RFC-4180-ish CSV: CRLF rows, header from labels, fields escaped. Pure. */
export function toCsv<T>(rows: readonly T[], columns: readonly Column<T>[]): string {
  const header = columns.map((c) => cell(c.label)).join(",");
  const body = rows.map((r) => columns.map((c) => cell(r[c.key])).join(","));
  return [header, ...body].join("\r\n");
}

/** Trigger a client-side download of `text` as `filename`. Best-effort; no data mutation. */
export function downloadCsv(filename: string, text: string): void {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 4: Run it — passes.** Run: `npx vitest run src/lib/export.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Create `ExportData`.** Create `src/components/settings/ExportData.tsx`. It subscribes to the collections and offers one download button per file. Debts+Payments flattens each debt's payments via a per-debt subscription is heavy; instead export debts and the flat `collectionGroup("payments")` we already have:

```tsx
import { useCollection } from "../../hooks/useCollection";
import { useCollectionGroup } from "../../hooks/useCollectionGroup";
import { debtsCol, expensesCol } from "../../lib/paths";
import { toCsv, downloadCsv, type Column } from "../../lib/export";
import type { Debt } from "../../lib/types";
import type { PaymentRec } from "../DebtPlan";
import type { ExpenseInput } from "../../lib/repo";

interface Expense extends ExpenseInput { id: string }

export default function ExportData() {
  const debts = useCollection<Debt>(debtsCol());
  const payments = useCollectionGroup<PaymentRec>("payments");
  const expenses = useCollection<Expense>(expensesCol());

  const exports: { label: string; file: string; run: () => void }[] = [
    {
      label: "Expenses", file: "expenses.csv",
      run: () => downloadCsv("expenses.csv", toCsv(expenses, [
        { key: "date", label: "Date" }, { key: "amount", label: "Amount" },
        { key: "category", label: "Category" }, { key: "channel", label: "Channel" },
        { key: "note", label: "Note" },
      ] as Column<Expense>[])),
    },
    {
      label: "Debts", file: "debts.csv",
      run: () => downloadCsv("debts.csv", toCsv(debts, [
        { key: "name", label: "Name" }, { key: "currentBalance", label: "Balance" },
        { key: "startingBalance", label: "Starting" }, { key: "payoffOrder", label: "Order" },
        { key: "dueDay", label: "Due" }, { key: "minimum", label: "Minimum" },
        { key: "channel", label: "Channel" }, { key: "isBNPL", label: "BNPL" },
        { key: "active", label: "Active" },
      ] as Column<Debt>[])),
    },
    {
      label: "Debt payments", file: "payments.csv",
      run: () => downloadCsv("payments.csv", toCsv(payments, [
        { key: "debtId", label: "DebtId" }, { key: "monthKey", label: "Month" },
        { key: "cutoff", label: "Cutoff" }, { key: "amount", label: "Amount" },
      ] as Column<PaymentRec>[])),
    },
  ];

  return (
    <div>
      <h2 className="font-bold text-lg mb-3">Export CSV</h2>
      <ul className="flex flex-col gap-2">
        {exports.map((e) => (
          <li key={e.file}>
            <button onClick={e.run} className="w-full bg-white rounded-xl shadow p-3 flex items-center justify-between text-sm">
              {e.label}
              <span className="text-emerald-700 font-semibold">Download</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 6: Wire into Settings.** In `src/components/Settings.tsx`:

```tsx
import ExportData from "./settings/ExportData";
```
```tsx
  if (section === "export") return <ExportData />;
```

- [ ] **Step 7: Typecheck + build + full tests.** Run: `npm run typecheck && npm run build && npx vitest run`
Expected: all PASS (allocate, reorder, export, plus existing selectors/channels/clock/paths).

- [ ] **Step 8: Commit.**

```bash
git add src/lib/export.ts src/lib/export.test.ts src/components/settings/ExportData.tsx src/components/Settings.tsx
git commit -m "feat(m3b): CSV export (pure toCsv + downloads for expenses/debts/payments)"
```

---

### Task 9: Live verification + deploy

**Files:** none (verification + release).

- [ ] **Step 1: Full build + tests green.** Run: `npm run build && npx vitest run`
Expected: both PASS.

- [ ] **Step 2: Boot smoke test.** Run `npm run dev`; load `http://localhost:5173`; confirm no new console errors (favicon 404 + apple-meta warning are pre-existing and OK).

- [ ] **Step 3: Signed-in walkthrough (needs the PIN; controller-driven or user-run).** Verify:
  1. Settings menu lists all 8 rows + Sign out.
  2. **Debts:** add a debt → appears on Debts tab and in the plan; reorder payoff order with ▲▼ → the plan's target line changes; delete a debt → confirm → gone from plan, and its old payments no longer show a ghost ✓ on This Month.
  3. **Template:** edit a line's amount → it does NOT change the current month; (optionally) confirm a freshly-generated future month reflects it.
  4. **Categories:** add / rename / reorder / delete → Quick Add's chips reflect it.
  5. **Funds / Events:** add and edit one of each; delete behind confirm.
  6. **Change PIN:** wrong current PIN → inline error, no change; correct current + matching new (6 digits) → "PIN changed"; Sign out → unlock with the NEW PIN.
  7. **Export:** each Download button saves a CSV that opens cleanly in a spreadsheet (commas/quotes intact).
  8. **Sign out** returns to the PIN pad.

- [ ] **Step 4: Confirm with the user before deploying** (push auto-deploys to Firebase Hosting — outward-facing). On approval:

```bash
git push origin main
```

- [ ] **Step 5: Verify deploy.** Watch GitHub Actions to green; load `https://cha-ching-c3470.web.app`, open Settings, confirm it renders.

---

## Self-Review

**Spec coverage** (spec section → task):
- Menu-drill navigation + Sign out → Task 1 ✓
- `Category`/`Meta` types + QuickAdd de-dup → Task 1 ✓
- Shared confirm dialog → Task 1 (`ConfirmDialog`), used in Tasks 2–6 ✓
- Debts CRUD + reorder + cascade delete → Task 2 (`adjacentSwap` tested, `deleteDebt` batch) ✓
- Template lines + incomes → Task 3 ✓
- Categories (CRUD + reorder) → Task 4 ✓
- Sinking funds (releaseMonths multi-select) → Task 5 ✓
- Events → Task 6 ✓
- Change PIN (reauth + updatePassword) → Task 7 ✓
- Export CSV (pure `toCsv` tested, several files) → Task 8 ✓
- Template edits never rewrite current month → not-changed `MonthProvider`; asserted in Task 9 step 3.3 ✓
- Testing: `toCsv` escaping + reorder swap unit tests → Tasks 8, 2 ✓; manual walkthrough → Task 9 ✓

**Type consistency:** all repo helpers take `Omit<T,"id">` for add and `Partial<T>` for update, `delete*` takes an id — uniform across Tasks 2–6. `adjacentSwap(items, index, dir, key)` used identically in Tasks 2 (`payoffOrder`) and 4 (`order`). `PaymentRec` reused from `DebtPlan.tsx` (Task 8) matches M3a. `toCsv(rows, columns)` / `Column<T>` consistent between `export.ts` and `ExportData`. `changePin(currentPin, newPin)` consistent between `pinAuth.ts` and `ChangePin`.

**Placeholder scan:** none — every code step shows complete code; every run step gives the exact command + expected result. The `Editor` "coming in a later step" stub in Task 1 is intentional scaffolding, replaced incrementally in Tasks 2–8.
