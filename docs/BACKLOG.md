# Cha-Ching — Open items

Canonical list of known-open work and owner actions. Update in place; a
fresh session should trust this file over conversation history. Specs for
everything shipped live in `docs/superpowers/specs/` (dated); git history is
the change log. Last updated: 2026-07-31 (TabBar bottom-reserve fix +
browsable month expenses, 15 green deploys, suite at 209 tests).

## Eve's offline actions (blocked on her)

- [ ] **First offsite backup:** `SEED_PIN=<pin> npm run backup` → writes a
  full JSON dump to `Dropbox/Personal Workspace/finances/cha-ching-backups/`.
  Repeat ~monthly (no scheduler wired up on purpose — PIN required).
- [ ] **Decide on `scripts/add-template-line.mjs`** (untracked, 2026-07-31):
  adds ONE template line without touching anything else, refuses to
  overwrite an existing id, computes `order` as last-in-its-cutoff. Written
  when the "+ Add line" button was unreachable; the line was added in-app
  instead once that was fixed. Keep it for future headless line adds, or
  delete it.
- [ ] **Firebase console (~5 min):** verify live Firestore rules match
  `firestore.rules` (CI deploys rules with `continue-on-error` — they can
  drift silently); disable new sign-ups in Authentication; enable email
  enumeration protection.

## Deliberately deferred (decision recorded)

- **PIN hardening — declined 2026-07-29** ("Not now"). The 6-digit PIN is
  the online credential (brute-forceable against the public auth REST
  endpoint). Agreed design if revisited: PIN stays the local unlock, a
  device-stored random password does real auth, recovery phrase for new
  devices. Console mitigations above reduce (not remove) the risk.
- **CI rules role:** granting the deploy service account Rules Admin and
  dropping `continue-on-error` in `.github/workflows/deploy.yml` needs a
  console grant.

## Designed but not built

- **Spec B (2026-07-18):** per-income-source `channel` + shortfall-aware
  send plan ("send only the shortfall"). `meta.incomeChannel` is one global
  account; `fundingByChannel` nets it but is not amount-aware.

## Known rough edges (audit findings accepted as-is)

- Past months re-derive incomes from the LIVE template — editing a template
  income rewrites historical months' income/surplus. Fix needs an
  income-snapshot design (and changes how edits propagate to the current
  month).
- Unplanned rollover asymmetry: envelope/group overspend excess still
  charges its own cutoff even when closed (date-attributed unplanned rolls
  to the open one). Documented behavior in `unplannedForCutoff`.
- Category rename splits expense history (expenses store the name string);
  Quick Add's default category is the literal "Food".
- "Log payment" defaults to full balance rather than the cycle minimum.
- No push notifications for due dates (DueSoonStrip on Quick Add + This
  Month is the current mitigation).
- Screenshot import v1: English OCR model loads from CDN on first use
  (online-only first import); credits/rebates are flagged but not
  importable; no per-row category override or merchant→category memory.
- `deleteDebt` batches every payment ever logged in one batch — chunk it if
  a debt ever accumulates ~500 payment docs (decades away at current rate).
- `ToastHost.tsx` uses `fixed bottom-20` (80px), which is shorter than the
  TabBar's real height (72px content + `env(safe-area-inset-bottom)`, ~106px
  on a device with a home indicator). Its `z-[60]` means toasts render *over*
  the nav rather than vanishing, so this is cosmetic — found 2026-07-31 while
  fixing the shell's bottom reserve, deliberately left alone. If fixed, use
  the same `calc(… + env(safe-area-inset-bottom))` form AppShell now uses
  rather than another hand-tuned magic number.
- Stats can get long on a heavy month: the spending calendar lists every
  expense in the viewed month uncapped (chosen deliberately 2026-07-31 over
  a ~15-item cap and over a fixed-height scroll box).

## Conventions worth knowing (see also project memory)

- Dates: ALWAYS `localIso()` (clock.ts) for stored money dates — never
  `toISOString()` (UTC shifts pre-8am PH writes a day back).
- All debt/savings balance changes ride in the same `writeBatch` as the doc
  that explains them; reversals are doc-driven (`monthKey`+`lineId` /
  `incomeId`), mirrored in restart AND restore.
- Verification: `npx tsc --noEmit && npx vitest run --no-file-parallelism
  && npx vite build` (parallel vitest hangs the Dropbox mount).
