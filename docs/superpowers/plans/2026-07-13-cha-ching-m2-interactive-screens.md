# Cha-Ching M2 — Interactive Screens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the read-only template preview into the daily-use app — a bottom-tab shell with a tappable **This Month** checklist (status ticks write live), **Quick Add** for unplanned spending, and a **Debts** screen where logging a payment drains the balance — all backed by a centralized path/repo layer.

**Architecture:** A thin typed data layer (`paths.ts` owns every Firestore path; `repo.ts` owns typed reads/writes) sits under React subscription hooks (`useCollection`, `useDoc`) that stream live Firestore data. A `MonthProvider` ensures the current month document exists (generated from template + events via the existing `generateMonthLines` selector) and exposes it. Screens are pure presentation over that data; all money math reuses M1's tested `selectors.ts`. Navigation is local state (no router dependency — YAGNI for a 5-tab PWA).

**Tech Stack:** React 18, TypeScript strict, Firebase Firestore v11 (onSnapshot, setDoc, updateDoc, writeBatch, increment), Tailwind v4, Vitest 3.

## Global Constraints

- Repo root: `/Users/gamaliel/Library/CloudStorage/Dropbox/Personal Workspace/cha-ching` (path has a space — quote it)
- All Firestore data lives under `households/main` (`HH`). Collection names are **flat**: `template-lines`, `template-incomes`, `debts`, `events`, `sinkingFunds`, `categories`, and `months`. Month lines live in a subcollection: `months/{YYYY-MM}/lines/{id}`. **No new literal path strings in components** — every path comes from `paths.ts`.
- Money format: `peso()` from `src/lib/format.ts`. Never hand-format currency.
- All money math reuses `src/lib/selectors.ts` — do not reimplement surplus/debt/fund math in components.
- Status vocabulary is exactly `LineStatus` = `"" | "PAID" | "RECEIVED" | "TRANSFERRED" | "SENT"`. Income lines cycle `"" → "RECEIVED" → ""`; expense lines cycle `"" → "PAID" → ""`. (TRANSFERRED/SENT exist in the type for future long-press menu — not built in M2.)
- Channel chip colors (verbatim from M1 `MonthPreview`): CIMB `bg-red-900 text-red-50`, GCASH `bg-blue-800 text-blue-50`, MARIBANK `bg-orange-300 text-orange-950`, MAYA `bg-green-800 text-green-50`, RCBC `bg-blue-200 text-blue-950`, RCBC CREDIT `bg-yellow-200 text-yellow-950`, CASH `bg-gray-200 text-gray-800`, WISE/KLOOK `bg-emerald-200 text-emerald-950`, RCBC SAVINGS `bg-cyan-200 text-cyan-950`. This map moves to `src/lib/channels.ts` in Task 2 and is imported everywhere.
- TypeScript `strict: true`. Commit after every task. `git identity` already set (Gamaliel Eve <germinggong@gmail.com>). Do NOT push mid-task unless the task says so; the final task pushes once and watches CI.
- Current-month determination uses the browser clock via `currentMonthKey()` (Task 3). The pure `selectors.ts` never reads the clock (keeps it testable) — the seeded month is `2026-07`.
- Vitest tests live beside their module as `*.test.ts` and run in `node` env — do NOT put React-rendering tests in the suite (no jsdom configured; test pure logic only).

---

### Task 1: Centralize Firestore paths + add rules to CI

**Files:**
- Modify: `src/lib/paths.ts`
- Modify: `src/components/MonthPreview.tsx` (swap literal paths for helpers — keeps M1 preview working until Task 5 replaces it)
- Modify: `.github/workflows/deploy.yml`
- Modify: `docs/superpowers/specs/2026-07-13-cha-ching-design.md` (reconcile data-model block to flat naming)
- Test: `src/lib/paths.test.ts`

**Interfaces:**
- Produces: from `paths.ts` — `HH`, `col(name: string): string`, `templateLines(): string`, `templateIncomes(): string`, `debtsCol(): string`, `debtPayments(debtId: string): string`, `eventsCol(): string`, `fundsCol(): string`, `categoriesCol(): string`, `monthDoc(key: string): string`, `monthLines(key: string): string`, `expensesCol(): string`, `metaDoc(): string`.

- [ ] **Step 1: Write failing test for path builders**

`src/lib/paths.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import {
  categoriesCol, debtPayments, debtsCol, eventsCol, expensesCol, fundsCol,
  metaDoc, monthDoc, monthLines, templateIncomes, templateLines,
} from "./paths";

describe("paths", () => {
  it("builds household-scoped collection paths", () => {
    expect(templateLines()).toBe("households/main/template-lines");
    expect(templateIncomes()).toBe("households/main/template-incomes");
    expect(debtsCol()).toBe("households/main/debts");
    expect(eventsCol()).toBe("households/main/events");
    expect(fundsCol()).toBe("households/main/sinkingFunds");
    expect(categoriesCol()).toBe("households/main/categories");
    expect(expensesCol()).toBe("households/main/expenses");
  });
  it("builds month + nested paths", () => {
    expect(monthDoc("2026-07")).toBe("households/main/months/2026-07");
    expect(monthLines("2026-07")).toBe("households/main/months/2026-07/lines");
    expect(debtPayments("revi")).toBe("households/main/debts/revi/payments");
  });
  it("builds the meta doc path", () => {
    expect(metaDoc()).toBe("households/main");
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm test -- --run src/lib/paths.test.ts`
Expected: FAIL — builders not exported.

- [ ] **Step 3: Implement the path module**

Replace `src/lib/paths.ts` entirely:
```ts
/** Root document for all app data. Every Firestore path is built from here. */
export const HH = "households/main";

/** A collection directly under the household. */
export const col = (name: string): string => `${HH}/${name}`;

export const templateLines = (): string => col("template-lines");
export const templateIncomes = (): string => col("template-incomes");
export const debtsCol = (): string => col("debts");
export const debtPayments = (debtId: string): string => `${debtsCol()}/${debtId}/payments`;
export const eventsCol = (): string => col("events");
export const fundsCol = (): string => col("sinkingFunds");
export const categoriesCol = (): string => col("categories");
export const expensesCol = (): string => col("expenses");

export const monthDoc = (key: string): string => `${col("months")}/${key}`;
export const monthLines = (key: string): string => `${monthDoc(key)}/lines`;

/** The household root doc itself holds meta (savingsBalance, floor, currency). */
export const metaDoc = (): string => HH;
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npm test -- --run src/lib/paths.test.ts`
Expected: PASS.

- [ ] **Step 5: Point MonthPreview at the helpers**

In `src/components/MonthPreview.tsx`, replace the two literal template-collection strings. Change the import line `import { HH } from "../lib/paths";` to `import { templateIncomes, templateLines } from "../lib/paths";` and replace:
```tsx
    const un1 = onSnapshot(query(collection(db, `${HH}/template-lines`)), (snap) =>
```
with
```tsx
    const un1 = onSnapshot(query(collection(db, templateLines())), (snap) =>
```
and
```tsx
    const un2 = onSnapshot(query(collection(db, `${HH}/template-incomes`)), (snap) =>
```
with
```tsx
    const un2 = onSnapshot(query(collection(db, templateIncomes())), (snap) =>
```

- [ ] **Step 6: Add firestore:rules to the deploy pipeline**

In `.github/workflows/deploy.yml`, the deploy step uses `FirebaseExtended/action-hosting-deploy@v0` which deploys hosting only. Add a rules-deploy step immediately BEFORE it so `firestore.rules` changes ship with the app. Insert after the `- run: npm run build` line and before the `- uses: FirebaseExtended/action-hosting-deploy@v0` line:
```yaml
      - name: Deploy Firestore rules
        run: npx firebase-tools deploy --only firestore:rules --project cha-ching-c3470 --non-interactive
        env:
          GOOGLE_APPLICATION_CREDENTIALS: ${{ runner.temp }}/gcp-sa.json
      - name: Write service account for CLI
        run: echo '${{ secrets.FIREBASE_SERVICE_ACCOUNT_CHA_CHING_C3470 }}' > ${{ runner.temp }}/gcp-sa.json
```
NOTE: the "Write service account" step must run BEFORE the "Deploy Firestore rules" step — reorder so the write step is first. Final order of these two: (1) Write service account for CLI, (2) Deploy Firestore rules, then (3) the existing hosting-deploy action.

- [ ] **Step 7: Reconcile the spec data-model block**

In `docs/superpowers/specs/2026-07-13-cha-ching-design.md`, the Data model section shows nested `template/lines/{id}` and `template/incomes/{id}`. Update those two lines to the flat scheme actually implemented:
```
  template-lines/{id}   { name, amount, channel, cutoff: 1|2, incomeSource, order, debtId? }
  template-incomes/{id} { name, amount, day, cutoff }
```
Add a one-line note under the code block: `> Implementation note (M1): template collections are flat (template-lines, template-incomes) rather than nested under a template doc, to avoid a phantom parent document. All paths are centralized in src/lib/paths.ts.`

- [ ] **Step 8: Verify everything, commit**

Run: `npm test -- --run && npm run typecheck && npm run build`
Expected: all tests pass (paths + selectors), clean, build succeeds.
```bash
git add -A && git commit -m "refactor: centralize Firestore paths; deploy rules in CI; reconcile spec data model"
```

---

### Task 2: Channel chips + typed repo layer

**Files:**
- Create: `src/lib/channels.ts`
- Create: `src/lib/repo.ts`
- Test: `src/lib/channels.test.ts`

**Interfaces:**
- Consumes: `paths.ts` helpers (Task 1); `db` from `firebase.ts`; types from `types.ts`.
- Produces:
  - `channels.ts`: `CHANNELS: readonly Channel[]`, `channelChip(c: Channel): string` (Tailwind classes), `channelChipSafe(c: string): string`.
  - `repo.ts`: `setLineStatus(monthKey, lineId, status): Promise<void>`, `writeMonth(monthKey, lines, incomes): Promise<void>`, `addExpense(e): Promise<void>`, `deleteExpense(id): Promise<void>`, `logDebtPayment(debtId, amount, monthKey): Promise<void>`. All are thin async wrappers; no tests (they hit Firestore) except channels.

- [ ] **Step 1: Write failing test for channel chips**

`src/lib/channels.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { CHANNELS, channelChip, channelChipSafe } from "./channels";

describe("channels", () => {
  it("lists all nine channels", () => {
    expect(CHANNELS).toHaveLength(9);
    expect(CHANNELS).toContain("CIMB");
    expect(CHANNELS).toContain("RCBC SAVINGS");
  });
  it("returns the exact chip classes per channel", () => {
    expect(channelChip("CIMB")).toBe("bg-red-900 text-red-50");
    expect(channelChip("MAYA")).toBe("bg-green-800 text-green-50");
  });
  it("safe variant falls back to neutral for unknown strings", () => {
    expect(channelChipSafe("CIMB")).toBe("bg-red-900 text-red-50");
    expect(channelChipSafe("NONSENSE")).toBe("bg-gray-200 text-gray-800");
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm test -- --run src/lib/channels.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement channels**

`src/lib/channels.ts`:
```ts
import type { Channel } from "./types";

export const CHANNELS: readonly Channel[] = [
  "CIMB", "GCASH", "MARIBANK", "MAYA", "RCBC",
  "RCBC CREDIT", "CASH", "WISE/KLOOK", "RCBC SAVINGS",
];

const CHIP: Record<Channel, string> = {
  CIMB: "bg-red-900 text-red-50",
  GCASH: "bg-blue-800 text-blue-50",
  MARIBANK: "bg-orange-300 text-orange-950",
  MAYA: "bg-green-800 text-green-50",
  RCBC: "bg-blue-200 text-blue-950",
  "RCBC CREDIT": "bg-yellow-200 text-yellow-950",
  CASH: "bg-gray-200 text-gray-800",
  "WISE/KLOOK": "bg-emerald-200 text-emerald-950",
  "RCBC SAVINGS": "bg-cyan-200 text-cyan-950",
};

export const channelChip = (c: Channel): string => CHIP[c];

/** For values whose type isn't statically known (e.g. Firestore reads). */
export const channelChipSafe = (c: string): string =>
  (CHIP as Record<string, string>)[c] ?? "bg-gray-200 text-gray-800";
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npm test -- --run src/lib/channels.test.ts`
Expected: PASS.

- [ ] **Step 5: Implement the repo layer**

`src/lib/repo.ts`:
```ts
import {
  collection, deleteDoc, doc, increment, setDoc, updateDoc, writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import { debtPayments, debtsCol, expensesCol, monthDoc, monthLines } from "./paths";
import type { Income, LineStatus, MonthLine } from "./types";

/** Toggle/set one month line's status. */
export async function setLineStatus(
  monthKey: string, lineId: string, status: LineStatus,
): Promise<void> {
  const ref = doc(db, monthLines(monthKey), lineId);
  await updateDoc(ref, { status, paidDate: status === "" ? "" : new Date().toISOString() });
}

/** Create a month: its meta doc + all line docs, in one batch. */
export async function writeMonth(
  monthKey: string, lines: MonthLine[], incomes: Income[],
): Promise<void> {
  const batch = writeBatch(db);
  const monthMetaRef = doc(db, monthDoc(monthKey));
  batch.set(monthMetaRef, {
    startedAt: new Date().toISOString(),
    incomes: incomes.map((i) => ({ name: i.name, amount: i.amount, received: false })),
  });
  for (const l of lines) batch.set(doc(db, monthLines(monthKey), l.id), l);
  await batch.commit();
}

export interface ExpenseInput {
  amount: number; category: string; channel: string; note: string; date: string;
}

export async function addExpense(e: ExpenseInput): Promise<void> {
  await setDoc(doc(collection(db, expensesCol())), e);
}

export async function deleteExpense(id: string): Promise<void> {
  await deleteDoc(doc(db, expensesCol(), id));
}

/** Record a debt payment: append to history + decrement the balance atomically. */
export async function logDebtPayment(
  debtId: string, amount: number, monthKey: string,
): Promise<void> {
  const batch = writeBatch(db);
  batch.set(doc(collection(db, debtPayments(debtId))), {
    amount, date: new Date().toISOString(), monthKey,
  });
  batch.update(doc(db, debtsCol(), debtId), { currentBalance: increment(-amount) });
  await batch.commit();
}
```

- [ ] **Step 6: Typecheck, commit**

Run: `npm test -- --run && npm run typecheck`
Expected: pass + clean.
```bash
git add -A && git commit -m "feat: channel chip helpers + typed Firestore repo layer"
```

---

### Task 3: Live subscription hooks + current-month helper

**Files:**
- Create: `src/hooks/useCollection.ts`
- Create: `src/hooks/useDoc.ts`
- Create: `src/lib/clock.ts`
- Test: `src/lib/clock.test.ts`

**Interfaces:**
- Consumes: `db` from `firebase.ts`.
- Produces:
  - `useCollection<T>(path: string): T[]` — live array, re-renders on change, unsubscribes on unmount. Each item is `{ id, ...data }`.
  - `useDoc<T>(path: string): T | null | undefined` — `undefined` while loading, `null` if missing, `T` if present.
  - `clock.ts`: `currentMonthKey(now?: Date): string` (→ "YYYY-MM"), `monthIndex(key: string): number` (1-12), `monthLabel(key: string): string` (→ "July 2026").

- [ ] **Step 1: Write failing test for the clock helpers**

`src/lib/clock.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { currentMonthKey, monthIndex, monthLabel } from "./clock";

describe("clock", () => {
  it("formats a Date to YYYY-MM", () => {
    expect(currentMonthKey(new Date("2026-07-13T00:00:00Z"))).toBe("2026-07");
    expect(currentMonthKey(new Date("2026-12-01T00:00:00Z"))).toBe("2026-12");
  });
  it("extracts a 1-12 month index from a key", () => {
    expect(monthIndex("2026-07")).toBe(7);
    expect(monthIndex("2026-12")).toBe(12);
  });
  it("renders a human month label", () => {
    expect(monthLabel("2026-07")).toBe("July 2026");
    expect(monthLabel("2027-02")).toBe("February 2027");
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm test -- --run src/lib/clock.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement clock helpers**

`src/lib/clock.ts`:
```ts
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Current month as "YYYY-MM". `now` is injectable for tests. */
export function currentMonthKey(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function monthIndex(key: string): number {
  return Number(key.split("-")[1]);
}

export function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}
```
NOTE: `currentMonthKey()`'s default-arg `new Date()` is fine in app code; the test always passes an explicit Date, so the argless `new Date()` (unavailable in workflow scripts, but this is a normal Vitest/browser context) is never hit by the suite.

- [ ] **Step 4: Run test, verify it passes**

Run: `npm test -- --run src/lib/clock.test.ts`
Expected: PASS.

- [ ] **Step 5: Implement the collection hook**

`src/hooks/useCollection.ts`:
```ts
import { collection, onSnapshot, query } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "../lib/firebase";

/** Live-subscribe to a Firestore collection; returns [{id, ...data}] array. */
export function useCollection<T>(path: string): T[] {
  const [items, setItems] = useState<T[]>([]);
  useEffect(() => {
    const un = onSnapshot(query(collection(db, path)), (snap) =>
      setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T)),
    );
    return un;
  }, [path]);
  return items;
}
```

- [ ] **Step 6: Implement the doc hook**

`src/hooks/useDoc.ts`:
```ts
import { doc, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "../lib/firebase";

/** Live-subscribe to one doc. undefined = loading, null = missing, T = present. */
export function useDoc<T>(path: string): T | null | undefined {
  const [value, setValue] = useState<T | null | undefined>(undefined);
  useEffect(() => {
    const un = onSnapshot(doc(db, path), (snap) =>
      setValue(snap.exists() ? ({ id: snap.id, ...snap.data() } as T) : null),
    );
    return un;
  }, [path]);
  return value;
}
```

- [ ] **Step 7: Typecheck, commit**

Run: `npm test -- --run && npm run typecheck`
Expected: pass + clean.
```bash
git add -A && git commit -m "feat: live Firestore subscription hooks + clock helpers"
```

---

### Task 4: App shell with bottom-tab navigation

**Files:**
- Create: `src/components/TabBar.tsx`
- Create: `src/components/AppShell.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: nothing from Firestore yet (screens are placeholders until their tasks).
- Produces: `AppShell` renders the active tab's screen + a fixed bottom `TabBar`. `TabId = "month" | "add" | "debts" | "dashboard" | "settings"`. Placeholder screens are inline until Tasks 5-7 replace `month`, `add`, `debts`.

- [ ] **Step 1: Implement the tab bar**

`src/components/TabBar.tsx`:
```tsx
export type TabId = "month" | "add" | "debts" | "dashboard" | "settings";

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: "month", label: "This Month", icon: "📅" },
  { id: "debts", label: "Debts", icon: "💳" },
  { id: "add", label: "Add", icon: "➕" },
  { id: "dashboard", label: "Stats", icon: "📊" },
  { id: "settings", label: "Settings", icon: "⚙️" },
];

export default function TabBar({
  active, onChange,
}: { active: TabId; onChange: (t: TabId) => void }) {
  return (
    <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-stone-200 flex justify-around pb-[env(safe-area-inset-bottom)]">
      {TABS.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[11px] ${
            active === t.id ? "text-emerald-700 font-semibold" : "text-stone-500"
          }`}
          aria-current={active === t.id ? "page" : undefined}
        >
          <span className="text-xl">{t.icon}</span>
          {t.label}
        </button>
      ))}
    </nav>
  );
}
```

- [ ] **Step 2: Implement the shell with placeholder screens**

`src/components/AppShell.tsx`:
```tsx
import { useState } from "react";
import TabBar, { type TabId } from "./TabBar";

function Placeholder({ title }: { title: string }) {
  return (
    <div className="p-6 text-center text-stone-500">
      <h1 className="text-lg font-bold text-stone-800 mb-2">{title}</h1>
      <p className="text-sm">Coming in a later step.</p>
    </div>
  );
}

export default function AppShell() {
  const [tab, setTab] = useState<TabId>("month");
  return (
    <div className="min-h-screen bg-stone-100 text-stone-900 pb-16 max-w-md mx-auto">
      {tab === "month" && <Placeholder title="This Month" />}
      {tab === "debts" && <Placeholder title="Debts" />}
      {tab === "add" && <Placeholder title="Quick Add" />}
      {tab === "dashboard" && <Placeholder title="Stats" />}
      {tab === "settings" && <Placeholder title="Settings" />}
      <TabBar active={tab} onChange={setTab} />
    </div>
  );
}
```

- [ ] **Step 3: Render the shell when signed in**

Replace `src/App.tsx`:
```tsx
import { useEffect, useState } from "react";
import AppShell from "./components/AppShell";
import PinPad from "./components/PinPad";
import { watchAuth } from "./lib/pinAuth";

export default function App() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  useEffect(() => watchAuth(setSignedIn), []);
  if (signedIn === null) return null;
  if (!signedIn) return <PinPad />;
  return <AppShell />;
}
```

- [ ] **Step 4: Verify build + manual smoke**

Run: `npm run typecheck && npm test -- --run && npm run build`
Expected: clean, tests pass, build ok.
Manual: `npm run dev`, unlock, confirm 5 tabs render and switch. (`MonthPreview.tsx` is now unreferenced but kept until Task 5 — that's fine.)

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: app shell with bottom-tab navigation"
```

---

### Task 5: This Month screen — live checklist with status ticks + month generation

**Files:**
- Create: `src/components/MonthProvider.tsx`
- Create: `src/components/ThisMonth.tsx`
- Create: `src/components/LineRow.tsx`
- Modify: `src/components/AppShell.tsx`
- Delete: `src/components/MonthPreview.tsx` (superseded)

**Interfaces:**
- Consumes: `useCollection`/`useDoc` (Task 3), `repo.setLineStatus`/`repo.writeMonth` (Task 2), `channelChipSafe` (Task 2), `cutoffSummary` (selectors), `generateMonthLines` (selectors), `currentMonthKey`/`monthLabel` (clock), `peso` (format), paths.
- Produces: `ThisMonth` screen. `MonthProvider` ensures the current month doc exists (generates from template + events if missing) and provides `{ monthKey, lines, incomes }` via `useMonth()`.

- [ ] **Step 1: Implement MonthProvider (auto-generate current month)**

`src/components/MonthProvider.tsx`:
```tsx
import { createContext, useContext, useEffect, useState } from "react";
import { currentMonthKey } from "../lib/clock";
import { eventsCol, monthDoc, monthLines, templateIncomes, templateLines } from "../lib/paths";
import { writeMonth } from "../lib/repo";
import { generateMonthLines } from "../lib/selectors";
import type { EventItem, Income, MonthLine, TemplateLine } from "../lib/types";
import { useCollection } from "../hooks/useCollection";
import { useDoc } from "../hooks/useDoc";

interface MonthCtx {
  monthKey: string;
  lines: MonthLine[];
  incomes: Income[];
  ready: boolean;
}
const Ctx = createContext<MonthCtx | null>(null);
export const useMonth = (): MonthCtx => {
  const v = useContext(Ctx);
  if (!v) throw new Error("useMonth outside MonthProvider");
  return v;
};

export default function MonthProvider({ children }: { children: React.ReactNode }) {
  const monthKey = currentMonthKey();
  const monthMeta = useDoc<{ id: string }>(monthDoc(monthKey));
  const lines = useCollection<MonthLine>(monthLines(monthKey));
  const incomes = useCollection<Income>(templateIncomes());
  const template = useCollection<TemplateLine>(templateLines());
  const events = useCollection<EventItem>(eventsCol());
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    // monthMeta === null means the doc doesn't exist yet → generate it once.
    if (monthMeta === null && !generating && template.length > 0 && incomes.length > 0) {
      setGenerating(true);
      const generated = generateMonthLines(template, events, monthKey);
      void writeMonth(monthKey, generated, incomes).finally(() => setGenerating(false));
    }
  }, [monthMeta, generating, template, events, incomes, monthKey]);

  const ready = monthMeta !== undefined && !(monthMeta === null) && lines.length > 0;
  return (
    <Ctx.Provider value={{ monthKey, lines, incomes, ready }}>{children}</Ctx.Provider>
  );
}
```

- [ ] **Step 2: Implement LineRow (one tappable line)**

`src/components/LineRow.tsx`:
```tsx
import { channelChipSafe } from "../lib/channels";
import { peso } from "../lib/format";
import { setLineStatus } from "../lib/repo";
import type { MonthLine } from "../lib/types";

export default function LineRow({ monthKey, line }: { monthKey: string; line: MonthLine }) {
  const ticked = line.status !== "";
  const nextStatus = ticked ? "" : "PAID";

  return (
    <li className="py-2 flex items-center justify-between gap-2">
      <button
        onClick={() => void setLineStatus(monthKey, line.id, nextStatus)}
        className={`flex-1 flex items-center gap-2 text-left ${ticked ? "opacity-50" : ""}`}
        aria-pressed={ticked}
      >
        <span
          className={`h-5 w-5 rounded-full border-2 flex items-center justify-center text-[11px] ${
            ticked ? "bg-emerald-600 border-emerald-600 text-white" : "border-stone-300"
          }`}
        >
          {ticked ? "✓" : ""}
        </span>
        <span className="text-sm">
          {line.name}
          {line.oneOff && <span className="ml-1 text-[10px] text-amber-600">•one-off</span>}
        </span>
      </button>
      <span className="flex items-center gap-2 shrink-0">
        <span className="text-sm font-semibold tabular-nums">{peso(line.amount)}</span>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${channelChipSafe(line.channel)}`}>
          {line.channel}
        </span>
      </span>
    </li>
  );
}
```

- [ ] **Step 3: Implement ThisMonth screen**

`src/components/ThisMonth.tsx`:
```tsx
import { monthLabel } from "../lib/clock";
import { peso } from "../lib/format";
import { cutoffSummary } from "../lib/selectors";
import { useMonth } from "./MonthProvider";
import LineRow from "./LineRow";

export default function ThisMonth() {
  const { monthKey, lines, incomes, ready } = useMonth();

  if (!ready) {
    return <div className="p-6 text-center text-stone-500">Setting up {monthLabel(monthKey)}…</div>;
  }

  return (
    <main className="p-4">
      <h1 className="text-xl font-bold mb-4">{monthLabel(monthKey)}</h1>
      {([1, 2] as const).map((cutoff) => {
        const s = cutoffSummary(lines, incomes, cutoff);
        const pct = s.planned > 0 ? Math.round((s.ticked / s.planned) * 100) : 0;
        const cutLines = lines
          .filter((l) => l.cutoff === cutoff)
          .sort((a, b) => a.order - b.order);
        return (
          <section key={cutoff} className="mb-6 bg-white rounded-xl shadow p-4">
            <h2 className="font-semibold mb-1">{cutoff === 1 ? "1ST CUTOFF" : "2ND CUT-OFF"}</h2>
            <div className="h-2 rounded-full bg-stone-100 mb-3 overflow-hidden">
              <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
            </div>
            <ul className="divide-y divide-stone-100">
              {cutLines.map((l) => (
                <LineRow key={l.id} monthKey={monthKey} line={l} />
              ))}
            </ul>
            <p className="mt-3 text-sm flex justify-between font-semibold">
              <span>Income {peso(s.income)}</span>
              <span className="text-emerald-700">Surplus {peso(s.surplus)}</span>
            </p>
            <p className="text-xs text-stone-400 text-right mt-1">{pct}% ticked</p>
          </section>
        );
      })}
    </main>
  );
}
```

- [ ] **Step 4: Wire provider + screen into the shell**

In `src/components/AppShell.tsx`: add imports `import MonthProvider from "./MonthProvider";` and `import ThisMonth from "./ThisMonth";`, wrap the whole returned tree in `<MonthProvider>…</MonthProvider>`, and replace the `{tab === "month" && <Placeholder title="This Month" />}` line with `{tab === "month" && <ThisMonth />}`.

- [ ] **Step 5: Delete the superseded preview**

Run: `rm "src/components/MonthPreview.tsx"`

- [ ] **Step 6: Verify + manual test the tick loop**

Run: `npm run typecheck && npm test -- --run && npm run build`
Expected: clean, 12 tests pass (paths+channels+clock+selectors), build ok.
Manual: `npm run dev`, unlock. First load generates the month (brief "Setting up…"), then both cutoffs show with checkboxes. Tap a line → it fills green + dims, surplus unchanged (surplus is income−planned), progress bar advances. Reload → tick persists (it's in Firestore).

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: This Month screen with live status ticks + auto month generation"
```

---

### Task 6: Quick Add screen

**Files:**
- Create: `src/components/QuickAdd.tsx`
- Modify: `src/components/AppShell.tsx`

**Interfaces:**
- Consumes: `useCollection` (categories), `addExpense`/`deleteExpense` (repo), `CHANNELS`/`channelChipSafe` (channels), `peso` (format), `currentMonthKey` (clock), `expensesCol` (paths).
- Produces: `QuickAdd` screen writing to `expenses`.

- [ ] **Step 1: Implement QuickAdd**

`src/components/QuickAdd.tsx`:
```tsx
import { useState } from "react";
import { useCollection } from "../hooks/useCollection";
import { channelChipSafe, CHANNELS } from "../lib/channels";
import { peso } from "../lib/format";
import { categoriesCol, expensesCol } from "../lib/paths";
import { addExpense, deleteExpense, type ExpenseInput } from "../lib/repo";
import type { Channel } from "../lib/types";

interface Category { id: string; name: string; order: number }
interface Expense extends ExpenseInput { id: string }

export default function QuickAdd() {
  const categories = useCollection<Category>(categoriesCol());
  const expenses = useCollection<Expense>(expensesCol());
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Food");
  const [channel, setChannel] = useState<Channel>("CASH");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const cats = [...categories].sort((a, b) => a.order - b.order);
  const recent = [...expenses].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
  const value = Number(amount);
  const canSave = value > 0 && !busy;

  async function save() {
    if (!canSave) return;
    setBusy(true);
    try {
      await addExpense({ amount: value, category, channel, note, date: new Date().toISOString() });
      setAmount("");
      setNote("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="p-4">
      <h1 className="text-xl font-bold mb-4">Quick Add</h1>
      <div className="bg-white rounded-xl shadow p-4 flex flex-col gap-3">
        <input
          type="number" inputMode="decimal" placeholder="Amount"
          value={amount} onChange={(e) => setAmount(e.target.value)}
          className="text-2xl font-bold tabular-nums border-b border-stone-200 pb-2 outline-none"
        />
        <div className="flex flex-wrap gap-2">
          {cats.map((c) => (
            <button
              key={c.id} onClick={() => setCategory(c.name)}
              className={`text-xs px-3 py-1.5 rounded-full ${
                category === c.name ? "bg-emerald-600 text-white" : "bg-stone-100 text-stone-600"
              }`}
            >{c.name}</button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {CHANNELS.map((c) => (
            <button
              key={c} onClick={() => setChannel(c)}
              className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                channel === c ? channelChipSafe(c) : "bg-stone-100 text-stone-400"
              }`}
            >{c}</button>
          ))}
        </div>
        <input
          placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)}
          className="text-sm border-b border-stone-200 pb-1 outline-none"
        />
        <button
          onClick={() => void save()} disabled={!canSave}
          className="mt-2 bg-emerald-600 disabled:bg-stone-300 text-white font-semibold rounded-lg py-3"
        >Save {value > 0 ? peso(value) : ""}</button>
      </div>

      <h2 className="font-semibold mt-6 mb-2 text-sm text-stone-600">Recent</h2>
      <ul className="flex flex-col gap-1">
        {recent.map((e) => (
          <li key={e.id} className="bg-white rounded-lg px-3 py-2 flex items-center justify-between gap-2">
            <span className="text-sm">{e.category}{e.note ? ` · ${e.note}` : ""}</span>
            <span className="flex items-center gap-2">
              <span className="text-sm font-semibold tabular-nums">{peso(e.amount)}</span>
              <button onClick={() => void deleteExpense(e.id)} className="text-stone-400 text-xs">✕</button>
            </span>
          </li>
        ))}
        {recent.length === 0 && <li className="text-sm text-stone-400 px-3">No expenses logged yet.</li>}
      </ul>
    </main>
  );
}
```

- [ ] **Step 2: Wire into shell**

In `src/components/AppShell.tsx`: `import QuickAdd from "./QuickAdd";` and replace `{tab === "add" && <Placeholder title="Quick Add" />}` with `{tab === "add" && <QuickAdd />}`.

- [ ] **Step 3: Verify + manual**

Run: `npm run typecheck && npm test -- --run && npm run build`
Expected: clean, tests pass, build ok.
Manual: Add tab → type 150, pick Food + CASH, Save → appears in Recent; ✕ deletes it. Reload persists.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: Quick Add expense logging screen"
```

---

### Task 7: Debts screen with live payment logging

**Files:**
- Create: `src/components/Debts.tsx`
- Modify: `src/components/AppShell.tsx`

**Interfaces:**
- Consumes: `useCollection<Debt>` (debts), `logDebtPayment` (repo), `debtTotals`/`projectDebtFreeMonth` (selectors), `channelChipSafe`, `peso`, `currentMonthKey`, `addMonths` (format), `monthLabel` (clock).
- Produces: `Debts` screen.

- [ ] **Step 1: Implement Debts**

`src/components/Debts.tsx`:
```tsx
import { useState } from "react";
import { useCollection } from "../hooks/useCollection";
import { channelChipSafe } from "../lib/channels";
import { currentMonthKey, monthLabel } from "../lib/clock";
import { peso } from "../lib/format";
import { debtsCol } from "../lib/paths";
import { logDebtPayment } from "../lib/repo";
import { debtTotals, projectDebtFreeMonth } from "../lib/selectors";
import type { Debt } from "../lib/types";

const MONTHLY_PAYDOWN = 90164; // plan's free cash/month; projection basis until history exists

export default function Debts() {
  const debts = useCollection<Debt>(debtsCol());
  const [payingId, setPayingId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");

  const active = [...debts].filter((d) => d.active).sort((a, b) => a.payoffOrder - b.payoffOrder);
  const totals = debtTotals(debts);
  const freeMonth = projectDebtFreeMonth(debts, MONTHLY_PAYDOWN, currentMonthKey());

  async function pay(id: string) {
    const v = Number(amount);
    if (v > 0) await logDebtPayment(id, v, currentMonthKey());
    setPayingId(null);
    setAmount("");
  }

  return (
    <main className="p-4">
      <h1 className="text-xl font-bold mb-1">Debts</h1>
      <p className="text-sm text-stone-500 mb-4">
        {peso(totals.total)} left · interest-bearing clear by{" "}
        <span className="font-semibold text-stone-700">{monthLabel(freeMonth)}</span>
      </p>
      <ul className="flex flex-col gap-3">
        {active.map((d) => {
          const paid = d.startingBalance - d.currentBalance;
          const pct = d.startingBalance > 0 ? Math.round((paid / d.startingBalance) * 100) : 0;
          return (
            <li key={d.id} className="bg-white rounded-xl shadow p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-sm flex items-center gap-2">
                  {d.name}
                  {d.isBNPL && <span className="text-[10px] text-emerald-600">0% BNPL</span>}
                </span>
                <span className="text-sm font-bold tabular-nums">{peso(d.currentBalance)}</span>
              </div>
              <div className="h-2 rounded-full bg-stone-100 my-2 overflow-hidden">
                <div className={`h-full ${d.isBNPL ? "bg-emerald-400" : "bg-red-500"}`} style={{ width: `${pct}%` }} />
              </div>
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${channelChipSafe(d.channel)}`}>
                  {d.channel}
                </span>
                {payingId === d.id ? (
                  <span className="flex items-center gap-1">
                    <input
                      type="number" inputMode="decimal" placeholder="Amount" autoFocus
                      value={amount} onChange={(e) => setAmount(e.target.value)}
                      className="w-24 text-sm border-b border-stone-300 outline-none tabular-nums"
                    />
                    <button onClick={() => void pay(d.id)} className="text-xs font-semibold text-emerald-700 px-2">Log</button>
                    <button onClick={() => { setPayingId(null); setAmount(""); }} className="text-xs text-stone-400">✕</button>
                  </span>
                ) : (
                  <button onClick={() => setPayingId(d.id)} className="text-xs font-semibold text-emerald-700">
                    Log payment
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
```

- [ ] **Step 2: Wire into shell**

In `src/components/AppShell.tsx`: `import Debts from "./Debts";` and replace `{tab === "debts" && <Placeholder title="Debts" />}` with `{tab === "debts" && <Debts />}`.

- [ ] **Step 3: Verify + manual**

Run: `npm run typecheck && npm test -- --run && npm run build`
Expected: clean, tests pass, build ok.
Manual: Debts tab → 6 debts by payoff order, total + debt-free month header. "Log payment" on REVI → enter 5000 → Log → balance drops ₱5,000, bar advances, header total drops. Reload persists.

- [ ] **Step 4: Commit, push, watch CI**

```bash
git add -A && git commit -m "feat: Debts screen with live payment logging"
git push
```
Then poll CI to green:
`curl -s "https://api.github.com/repos/sites-9400/_cha-ching/actions/runs?per_page=1" | python3 -c "import json,sys; r=json.load(sys.stdin)['workflow_runs'][0]; print(r['status'], r['conclusion'])"`
Expected: `completed success`. Verify live site: unlock → tabs → tick a line, add an expense, log a payment. **M2 core loop complete.**

---

## Self-review notes

- **Spec coverage:** This Month (§Screens 1) = Task 5; Quick Add (§2) = Task 6; Debts (§3) = Task 7; tab shell = Task 4; data layer/hooks = Tasks 2-3; path centralization + rules-CI (M1 review carry-forward) = Task 1. **Deferred to M3 (documented):** Dashboard (§4), Settings (§5), rollover accept/skip events UI (auto-generation ships in M2; the interactive accept/skip is M3), CSV export, Firebase App Check, the TRANSFERRED/SENT long-press menu, and the lock()/idle-timeout. These are called out here so they aren't mistaken for M2 gaps.
- **Carry-forward from M1 review:** paths centralized (Task 1) ✅; rules in CI (Task 1) ✅; App Check → M3 (noted). Minor ledger items (unused import already removed by deleting MonthPreview in Task 5; CHIP retyped to `Record<Channel,string>` in Task 2) ✅.
- **Type consistency:** `MonthLine`, `Income`, `Debt`, `Channel`, `LineStatus` used verbatim from `types.ts`. `cutoffSummary(lines, incomes, cutoff)`, `debtTotals(debts)`, `projectDebtFreeMonth(debts, paydown, fromMonth)`, `generateMonthLines(template, events, monthKey)` match M1 signatures exactly. `setLineStatus`/`writeMonth`/`addExpense`/`logDebtPayment` defined in Task 2, consumed in 5-7.
- **Known simplification:** debt-free projection uses the static `MONTHLY_PAYDOWN = 90164` until real payment history accrues; spec's history-based projection is an M3 refinement. Flagged in-code.
- **No jsdom:** all tests are pure-logic (paths, channels, clock) reusing the existing node test env; component behavior is verified by the manual steps, consistent with M1.
