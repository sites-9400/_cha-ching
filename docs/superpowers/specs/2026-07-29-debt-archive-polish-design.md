# Debt archive polish — Design + implementation notes

**Date:** 2026-07-29
**Status:** Approved (Eve, in chat)

Cleared debts (e.g. Revi, Classic) should be hideable without deleting. The
`active` flag already hides a debt from the Debts list, totals, due-soon
strip, allocation, and Quick Add card chips — this milestone closes the two
gaps: archived debts still reserve cycle minimums in the plan math, and
archiving requires digging into Settings.

Context answered, no build needed: statement re-prompting already works —
`currentCycleKey` rolls forward when the statement day passes and the Debts
card falls back to the amber "Enter statement" button each new cycle.

## A. Math fix — `cycleMinimums` skips archived debts

`src/lib/cycles.ts` (`cycleMinimums`, line 62): the debts param type gains
`active?: boolean`, and the loop starts with:

```ts
    if (d.active === false) continue; // archived debts reserve nothing
```

Optional so the existing tests' bare `{ id, statementDay }` fixtures stay
valid; only an explicit `active: false` is skipped. Call sites (ThisMonth
:31-32) pass full `Debt` objects and need no changes.

Test (append inside the existing `describe("cycleMinimums")` in
`src/lib/cycles.test.ts`):

```ts
  it("skips archived (inactive) debts entirely", () => {
    const m = cycleMinimums(
      [{ id: "d1", statementDay: 15, active: false, minimum: 500 }],
      cycles, [], today,
    );
    expect(m.has("d1")).toBe(false);
  });
```

## B. Debts screen — one-tap Archive + collapsed Cleared section

All in `src/components/Debts.tsx`:

1. Add `updateDebt` to the existing repo import (line 7).
2. State: `const [showCleared, setShowCleared] = useState(false);` beside the
   other useState hooks; and beside `const active = ...` (line 41):

```ts
  const cleared = [...debts].filter((d) => !d.active).sort((a, b) => a.payoffOrder - b.payoffOrder);
```

3. **Archive action** — in each debt card's bottom row (lines 168-175), the
   right side becomes a group; Archive shows only for zero-balance debts:

```tsx
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${chip(d.channel)}`}>
                  {label(d.channel)}
                </span>
                <span className="flex items-center gap-3">
                  {d.currentBalance <= 0 && (
                    <button onClick={() => void updateDebt(d.id, { active: false })} className="text-xs font-semibold text-stone-500">
                      Archive
                    </button>
                  )}
                  <button onClick={() => setPayDebt(d)} className="text-xs font-semibold text-emerald-700">
                    Log payment
                  </button>
                </span>
              </div>
```

4. **Cleared section** — directly after the closing `</ul>` of the active
   list (line 179), before the dialogs:

```tsx
      {cleared.length > 0 && (
        <div className="mt-4">
          <button
            onClick={() => setShowCleared((v) => !v)}
            className="w-full bg-white rounded-2xl shadow px-4 py-3 flex items-center justify-between text-sm"
          >
            <span className="font-semibold text-stone-500">Cleared · {cleared.length}</span>
            <span className="text-stone-400">{showCleared ? "▾" : "▸"}</span>
          </button>
          {showCleared && (
            <ul className="mt-2 flex flex-col gap-2">
              {cleared.map((d) => (
                <li key={d.id} className="bg-white rounded-2xl shadow px-4 py-3 flex items-center justify-between gap-2">
                  <span className="text-sm text-stone-500 flex items-center gap-2.5 min-w-0">
                    <ChannelIcon channel={String(d.channel)} initial={d.name.charAt(0).toUpperCase()} chipClass={chip(d.channel)} />
                    <span className="truncate">{d.name}</span>
                  </span>
                  <span className="flex items-center gap-3 shrink-0">
                    <span className="text-sm tabular-nums text-stone-400">{peso(d.currentBalance)}</span>
                    <button onClick={() => void updateDebt(d.id, { active: true })} className="text-xs font-semibold text-emerald-700">
                      Unarchive
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
```

## Out of scope

- Auto-archiving on reaching zero (stays manual, one tap).
- Hiding archived debts from Settings → Debts (that's where full editing
  lives; they show "· archived" there).
- Any change to statement/cycle prompting (already correct).
