# Budget-App-Style Restyle Plan

> Visual restyle ONLY — zero logic/props/data changes. Executed by a Sonnet subagent; Fable reviews, verifies, ships. Autopilot approved by user.

**Design tokens**
- Deep Teal `#0E5A54` (identity; already the theme-color meta) · Teal Deep-2 `#0A413D` (band gradient end)
- Emerald `emerald-600` (actions, unchanged) · page/card/stone text scale UNCHANGED (dark-mode layer depends on it)
- Band text: white + `text-emerald-100/70` for labels.

**1. Header bands (signature).** Each top-level screen opens with a deep-teal band: `bg-[#0E5A54]` rounded-b-3xl (full-bleed to top, covers safe-area; content max-w-md), containing the screen title (small, uppercase, emerald-100/70) and the screen's key number in `text-4xl font-bold tabular-nums text-white`:
- ThisMonth: "TOTAL SURPLUS" = sum of both cutoffs' surplus (already computed via cutoffSummary; sum c1+c2). Month nav arrows move INTO the band (white/20 circles). Projected/history subtitle stays, restyled white/60.
- QuickAdd (Expenses): "SPENT THIS MONTH" = sum of current-month expenses.
- Debts: "TOTAL DEBT" = existing `totals.total`; keep the debt-free line inside the band as the small second line.
- Dashboard (read Dashboard.tsx first): "SAVINGS" = meta.savingsBalance if trivially available in that component; otherwise use the month's unplanned total already computed there — pick what the component already has, do NOT add new subscriptions.
- Settings: band with just the title "Settings" (no number).
Implementation: one shared `HeaderBand` component (src/components/HeaderBand.tsx) taking { title, value?, sub?, left?, right? } so screens stay tidy. Screens keep their existing `<main className="p-4">` for the content below the band; band sits above it full-width.
- Dark mode: add `.dark` rules in index.css for the band ONLY if needed — `#0E5A54` stays as-is in dark (it reads well); do not remap.

**2. Raised center Add button (TabBar.tsx).** Center "add" tab becomes a circular raised button: h-14 w-14 rounded-full bg-emerald-600 text-white shadow-lg, floating ~half above the bar (-translate-y-3), plus icon larger; label removed for the center item only. Other tabs unchanged. Keep safe-area padding.

**3. Icon circles on rows.**
- QuickAdd Recent list + SpendingCalendar day list + CategoryBars expanded items: leading `h-9 w-9 rounded-full` circle using the CATEGORY's initial letter, tinted via the existing account-chip palette classes (reuse `chip(e.channel)` for color so no new colors are introduced); channel pill then becomes secondary small text next to category instead of the leading chip.
- Debts cards: leading circle with debt-name initial using `chip(d.channel)`.

**4. Card polish.** In the five main screens + dialogs: `rounded-xl → rounded-2xl` on cards, list `gap-2 → gap-2.5`, card padding p-3 → p-3.5 where cramped. Do NOT touch chip pills, progress bars, or any conditional class logic.

**5. Keep dark mode working.** Only use utilities already covered by the `.dark` layer in index.css (bg-white, stone scale, tinted banners) or the fixed teal/emerald/white listed above. If any new stone/tinted utility is introduced, add the matching `.dark` override to index.css.

**Out of scope:** logic, props/data flow, new subscriptions, fonts, animations beyond existing, PinPad, tests.

**Verify:** `npm run typecheck` && `npx vitest run` && `npm run build` all clean. Report files changed + tails + any deviation.
