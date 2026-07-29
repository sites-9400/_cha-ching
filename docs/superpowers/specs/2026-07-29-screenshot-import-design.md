# Screenshot transaction import — Design

**Date:** 2026-07-29 · **Status:** Approved (Eve, in chat, with sample EastWest screenshot)

Upload a bank-app screenshot (e.g. EastWest "Recent Transactions") → OCR on
device → review parsed rows → add them as expenses (typically charged to
that card via `paidWithDebtId`, feeding the debt balance) so statements can
be audited against logged spending.

## Privacy/architecture decision

OCR runs **on device** with `tesseract.js` (dynamic import; English model
fetched from its default CDN on first use, then browser-cached). No bank
data leaves the phone. Trade-off accepted for v1: first import needs a
connection; accuracy is good-not-perfect — the review screen is the
correction point. (Upgrade path later: LLM vision via a proxy.)

`package.json`: dependency added by the ORCHESTRATOR via npm (not the
implementer). Code targets the modern API:
`const worker = await createWorker("eng"); const { data } = await worker.recognize(file); await worker.terminate();`

## 1. Pure parser — `src/lib/importParse.ts` (+ tests)

```ts
export interface ParsedTxn {
  date: string | null; // "YYYY-MM-DD" from the nearest date header above
  note: string;        // merchant text
  amount: number;      // absolute value
  credit: boolean;     // negative rows (refunds/rebates)
}

export function parseTransactions(text: string): ParsedTxn[]
```

Heuristics (state machine over trimmed non-empty lines):
- Date header line: `/^([A-Z][a-z]{2,8})\.? (\d{1,2}),? (\d{4})$/` — month
  name matched by 3-letter prefix against Jan..Dec → sets current date.
- Amount: `/(-)?\s*PHP\s*([\d,]+(?:\.\d{2})?)/i`. A line containing an
  amount yields a row: note = text before the match (trimmed of trailing
  punctuation); if empty, the previous non-header, non-amount line is the
  merchant (OCR sometimes splits them). `credit` = leading minus.
- Lines with no amount and no date become merchant candidates for the next
  amount line; anything else (headers like "Transactions after latest
  statement", "You've reached the end of the list.") is ignored naturally.

Tests (`src/lib/importParse.test.ts`) — use this sample verbatim (from
Eve's real screenshot) and assert all 7 rows, dates, credit flag:

```
Transactions after latest statement
Jul 25 2026
CHATBOT CASH REBATE -PHP 1,000.00
Jul 23 2026
fp*Food Panda https://... PHP 259.00
Buyandship Limited H... PHP 1,209.50
Jul 22 2026
fp*Food Panda https://... PHP 516.00
HONGKONG DISNEYLA... PHP 1,526.30
Jul 21 2026
ICHIRAN HONG KONG... PHP 2,888.10
Jul 20 2026
Iris Galerie Ngong Ping... PHP 4,351.46
```

Also test: merchant on its own line with amount on the next; no date header
before first row → date null; comma-less and decimal-less amounts.

## 2. Review UI — `src/components/ImportExpenses.tsx`

Full-screen overlay dialog (styled like the app's dialogs, scrollable),
`{ onClose }` prop; self-loads categories, current-month `activeLines`
(envelope list + groups), debts, expenses (for dup detection) — mirror how
SpendingCalendar self-loads.

Phases:
1. **Pick** — `<input type="file" accept="image/*">` (camera roll on iOS).
2. **OCR** — dynamic `import("tesseract.js")`, progress bar from the worker
   logger; failure → toast "Couldn't read the image — try a clearer
   screenshot" and back to Pick. (Worker creation:
   `createWorker("eng", 1, { logger: (m) => m.status === "recognizing text" && setProgress(m.progress) })`.)
3. **Review** — editable row list from `parseTransactions`:
   - Row: include-checkbox · date `<input type="date">` · note text input ·
     amount number input. Credits render a "credit" badge and start
     UNCHECKED. Rows whose (amount, date) match an existing expense get a
     "possible duplicate" badge and start UNCHECKED. Rows with `date: null`
     default to today.
   - Shared controls above the list: **Category** chip row (app's existing
     chip styling; default = first category by order) and **Paid from** via
     `PaidFromPicker` (from batch 5) with the last-used token persisted to
     `localStorage["import-paidfrom"]` — defaulting a card import to that
     card's 💳 chip.
   - Footer: "Add N expenses" button →
     for each included row `void addExpense({...}).catch(toast)` with
     `date: \`${row.date}T12:00:00\``, note, amount, the shared category,
     funding fields from `decodePaidFrom(token)` (batch 5 codec), and
     `channel`: the selected debt's channel when the token is `@debt:{id}`,
     else `"CASH"`. Then `showToast(\`Imported N expenses\`)` and onClose.

## 3. Entry point

Quick Add: a "📷 Import" text-button on the "Recent" heading row opens
`<ImportExpenses onClose={...}/>`.

## Out of scope (v1)

- Negative/credit import (rebates stay manual).
- Per-row category overrides; merchant→category memory.
- Self-hosting the OCR model for offline import.
- Auto-matching rows against the card's statementBalance.
