# Cha-Ching — Design Spec

**Date:** 2026-07-13
**Owner:** Eve (gamaliel)
**Status:** Approved pending user review

## What it is

Cha-Ching is a private, mobile-first personal-finance web app that replaces a
manually regenerated Google Sheet ("Money Map"). Eve plans each month in two
salary cutoffs, ticks planned lines as PAID/RECEIVED/TRANSFERRED/SENT, logs
unplanned spending, tracks credit-card debt payoff, and watches a live
dashboard update in real time. Data lives in Firestore; the app deploys to
Firebase Hosting; code lives in a private GitHub repo with auto-deploy.

- **Repo:** https://github.com/sites-9400/_cha-ching
- **Firebase project:** `cha-ching-c3470`
- **Hosting URL:** default `cha-ching-c3470.web.app` (rename later if desired)
- **Plan:** Firebase Spark (free tier) — usage is far below limits.

## Goals

1. Stop regenerating static sheets — one living app, updated in place.
2. Every peso has a job: each cutoff allocates to zero, live.
3. Capture *all* spending: planned lines + quick-add for unplanned.
4. Debt payoff is visible and motivating (balances drain, debt-free date).
5. Protect the ₱100k savings floor visibly.
6. Zero-friction daily use from an iPhone home-screen shortcut.

## Non-goals

- Multi-user accounts (Jude may be added later; not in v1).
- Bank API integrations — all entry is manual by design.
- Native iOS app — PWA-style web app only.
- Server-side code/functions — client + Firestore only.

## Stack

- **UI:** React 18 + Vite + TypeScript
- **Styling:** Tailwind CSS (mobile-first; matches sheet's visual language —
  channel chips, green/pink/dark-red section colors)
- **Data:** Cloud Firestore with offline persistence enabled
- **Auth:** Firebase Auth (email/password under the hood, PIN-fronted; see
  Security)
- **Hosting:** Firebase Hosting
- **CI:** GitHub Actions — push to `main` → build → deploy
- **Tests:** Vitest for money math (selectors/derivations)

## Screens (5 bottom tabs)

### 1. This Month (home)
- Two cutoff blocks (1ST CUTOFF, 2ND CUT-OFF) mirroring the sheet: income
  lines then expense lines.
- Each line: name · amount · channel chip · status button cycling
  blank → PAID (expenses) / blank → RECEIVED (income). Also
  TRANSFERRED / SENT selectable via long-press or secondary tap menu —
  same vocabulary as the sheet's ACTION STEPS.
- Per-cutoff progress bar (₱ ticked vs total) and live TOTAL SURPLUS.
- One-off lines flagged visually (dot/badge).
- Add/edit/delete a line inline for the current month only.

### 2. Quick Add (center + button)
- Amount → category (Food, Shopping, Transport, Gifts, Bills, Cats, Other —
  editable list) → channel → optional note. Three taps to save.
- Writes to `expenses`. Recent entries list with edit/delete.

### 3. Debts
- Cards ordered by payoff order: name, current balance, progress bar
  (startingBalance → 0), due day, channel chip, BNPL badge for the laptop.
- "Log payment" → amount (defaults to remaining or statement amount) →
  decreases balance, appends to payment history.
- Headline: total debt remaining + projected debt-free date (computed from
  average monthly paydown of last 2 months, min 1 month of data; before
  that, uses the plan's ₱90,164/mo free cash).

### 4. Dashboard
- Month spending by category (planned vs unplanned stacked).
- Debt curve over time from payment history.
- Savings vs ₱100k floor (manual balance entry; red line at 100k).
- Sinking fund balance + next release date.

### 5. Settings
- Edit recurring template (lines + income sources).
- Edit debts, sinking fund rules, events calendar, categories.
- Change PIN. Export all data to CSV. Sign out.

### Monthly rollover
- On first open in a new month: banner "Start {Month}? Generates both
  cutoffs from your template." One tap.
- Pulls that month's `events` in as suggested one-off lines (accept/skip
  each).
- Never overwrites an existing month; if it exists, just opens it.

## Data model (Firestore)

All documents under a single root collection `households/main` (future-proofs
adding Jude without a migration).

```
households/main
  meta            { savingsBalance, savingsFloor: 100000, currency: "PHP" }
  template/
    lines/{id}    { name, amount, channel, cutoff: 1|2, incomeSource, order }
    incomes/{id}  { name, amount, day: 13|25|29, cutoff }
  months/{YYYY-MM}
    lines/{id}    { name, amount, channel, cutoff, status: ""|"PAID"|"RECEIVED"
                    |"TRANSFERRED"|"SENT", paidDate, oneOff: bool,
                    debtId?: string, order }
    meta          { startedAt, incomes: [{name, amount, received: bool}] }
  expenses/{id}   { amount, category, channel, note, date }
  debts/{id}      { name, startingBalance, currentBalance, dueDay,
                    payoffOrder, channel, isBNPL, active }
  debts/{id}/payments/{id}  { amount, date, monthKey }
  sinkingFunds/{id} { name, monthlyDeposit, releaseMonths: [3,6,9,12],
                      balance }
  sinkingFunds/{id}/entries/{id} { type: "deposit"|"release", amount, date }
  events/{id}     { name, amount, month: "YYYY-MM", channel?, note }
  categories/{id} { name, order }
```

**Derived, never stored:** cutoff totals, surplus, free cash, debt totals,
debt-free date, category breakdowns. Computed in a `selectors.ts` module —
the unit-tested heart of the app.

**Line ↔ debt link:** a planned line with `debtId` set, when marked PAID,
prompts "Log ₱X as payment to {debt}?" — one tap keeps both in sync.

## Security

- **PIN-fronted hidden auth:** app ships with a fixed service email
  (`app@cha-ching.local` style); the user's 6-digit PIN is combined with a
  build-time pepper to form the Firebase Auth password. Correct PIN →
  `signInWithEmailAndPassword` succeeds → Firestore opens. Wrong PIN →
  server-side auth failure. Firebase rate-limits attempts.
- **Firestore rules:** `allow read, write: if request.auth != null &&
  request.auth.uid == <that account's uid>;` — nothing is publicly readable.
- **Session persistence:** stays signed in on the device (like GCash
  "remember this device"); PIN pad reappears only after sign-out or on new
  devices.
- **First-run:** PIN setup screen creates the auth account (one-time,
  guided).
- The web `apiKey` is a public identifier, safe in the repo; protection is
  rules + auth, not key secrecy.
- Upgrade path: swap PIN-auth for Google sign-in later without data changes.

## Error handling

- **Offline:** Firestore persistence on; writes queue and sync. Subtle
  "syncing…" indicator when there are pending writes.
- **Confirmations, not corruption:** overpaying a debt beyond balance,
  re-marking a PAID line, deleting anything → confirm dialogs.
- **Reversibility:** every status cycles back; every record editable and
  deletable.
- **Rollover:** idempotent — existing month is opened, never regenerated.
- **Export:** Settings → CSV export of months, expenses, debts, funds.

## Testing & verification

- **Vitest unit tests** for `selectors.ts`: surplus math, allocation totals,
  debt-free projection, fund schedule (deposit/release/rollover), rollover
  generation (template + events merge).
- Manual pre-deploy walkthrough: tick line, quick-add, log debt payment,
  rollover, offline queue, PIN flow.
- **Shakedown week:** Google Sheet stays alive in parallel until Eve retires
  it.

## Seed data (from the 2026-07 session)

Template lines (1st cutoff, from Crunchy 13th ≈ ₱60,600): Allowance 10,000
CIMB · Tithes 5,000 CIMB · Subscriptions (Netflix, iCloud, YT) 2,277 RCBC
CREDIT · Gemini 167 RCBC · Shopping Sinking Fund 2,000 CIMB.

Template lines (2nd cutoff, from PHP 25th ₱51,000 + Crunchy 29th ≈ ₱60,600):
Converge 1,500 CIMB · Cat Fund 2,450 CIMB · Tithes 5,000 CIMB · Grocery
Nuangan 5,000 GCASH · Joela Salary 15,000 GCASH · Allowance 1 28th 5,750
GCASH · Subscriptions (Dropbox, GooglePapa, Scribd) 1,039 GCASH · Freedom
Life 470 GCASH · Bills Nuangan 1,800 GCASH · Allowance 2 5th 5,750 MARIBANK ·
Joint Account 2,000 MAYA · Jude Paddle 2,500 RCBC · Rent 10,000 RCBC ·
EastWest Laptop (BNPL 12mo) 4,333 MARIBANK.

Debts (payoff order): REVI 17,265 (due 16th, CIMB) → RCBC Classic 6,337
(due ~4th, RCBC) → RCBC Visa Gold 44,871 (due ~28th, RCBC) → Landers/Maya
49,923 (MAYA) → EastWest revolving 98,824 (stmt 15th, due 10th, MARIBANK) →
EastWest laptop 51,995 BNPL 0% (₱4,333 × 12, MARIBANK, excluded from blitz).

Events: Dentures #1 Jul 15,000 · Dentures #2 Aug 15,000 · Iloilo Aug 20,000 ·
Anniversary Aug 10,000 · Tuition DP Aug 5,000 · Tuition Sep/Nov/Dec 8,000
each · Mama bday Sep 5,000 · Christell bday Sep 4,000 · 5SOS flights+hotel
Sep 12,000 · Marianne bday Oct 4,000 · Erika bday Oct 4,000 · Christmas gifts
Dec 15,000 · HK trip Jul (bookings 25,223 + on-ground).

Sinking fund: Shopping — ₱2,000/month deposit, releases at end of Sep and Dec
(quarterly), balance starts 0.

Meta: savingsBalance 111,362 · savingsFloor 100,000.

Channels: CIMB, GCASH, MARIBANK, MAYA, RCBC, RCBC CREDIT, CASH, WISE/KLOOK,
RCBC SAVINGS — each with its chip color from the sheet.

## Build order (for the implementation plan)

1. Scaffold (Vite/React/TS/Tailwind), Firebase wiring, deploy pipeline —
   "hello world" live on Firebase Hosting via GitHub Actions.
2. PIN auth + Firestore rules.
3. Data layer + selectors with unit tests + seed script.
4. This Month screen (the core loop).
5. Quick Add.
6. Debts.
7. Dashboard.
8. Settings + rollover + events.
9. CSV export, offline indicator, polish, shakedown.
