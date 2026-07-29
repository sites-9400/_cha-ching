# Audit batch 4 — Security/ops hardening

**Date:** 2026-07-29 · **Status:** Approved (audit remediation, Eve: "go do by batch")

Three low-risk hardening items from the security audit. (PIN hardening —
decoupling the data credential from the 6-digit PIN — is deliberately NOT
here; it risks lockout and awaits Eve's explicit decision.)

## 1. Service worker: never cache error pages

`public/sw.js` line ~33: the navigation handler caches `fresh` without
checking status, so a 500/404 could become the permanent offline shell.
Guard it:

```js
          const fresh = await fetch(req);
          if (fresh.ok) {
            const cache = await caches.open(CACHE);
            cache.put("/index.html", fresh.clone());
          }
          return fresh;
```

(The asset path already checks `status === 200` — leave it.)

## 2. Hosting headers

`firebase.json` hosting block gains:

```json
    "headers": [
      {
        "source": "/assets/**",
        "headers": [
          { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
        ]
      },
      {
        "source": "**",
        "headers": [
          { "key": "X-Content-Type-Options", "value": "nosniff" },
          { "key": "X-Frame-Options", "value": "DENY" },
          { "key": "Referrer-Policy", "value": "no-referrer" },
          { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" }
        ]
      }
    ]
```

(Vite content-hashes everything under /assets, so immutable is safe.)

## 3. Off-Firebase backup dump — `scripts/backup.mjs` (new)

A read-only sibling of `scripts/seed.mjs`: signs in with the same
`SEED_PIN` env mechanism (`vault@cha-ching.app`, `${pin}:chaching-2026-x7-pepper`,
same firebase config — copy from seed.mjs), reads every collection the app
uses, and writes one timestamped JSON file into Dropbox (outside the
Firebase project), so a project loss no longer takes the backups with it.

- Output dir: `/Users/gamaliel/Library/CloudStorage/Dropbox/Personal Workspace/finances/cha-ching-backups/`
  (`fs.mkdirSync(dir, { recursive: true })`), file
  `cha-ching-backup-<YYYY-MM-DD-HHmmss>.json` (local time).
- The client SDK cannot list subcollections, so enumerate known paths
  (mirroring `src/lib/paths.ts`): the `households/main` doc; collections
  `households/main/{template-lines, template-incomes, categories, events,
  accounts, debts, expenses, savingsMoves, subscriptions, months}`; for each
  debt doc: `debts/{id}/{payments, cycles}`; for each month doc:
  `months/{key}/{lines, incomes, backups}`. FIRST read `src/lib/paths.ts`
  and use exactly the collection names found there (the list above may be
  imprecise — paths.ts is the source of truth; include every collection it
  defines).
- Shape: `{ exportedAt, projectId, data: { <path>: <doc|array of {id,...}> } }`.
  Log a per-collection doc count and the output path; `process.exit(0)` at
  the end (firestore keeps the event loop alive otherwise).
- `package.json`: add `"backup": "node scripts/backup.mjs"`.

Run instructions (for the final report, not executed by the implementer):
`SEED_PIN=<pin> npm run backup`.

## Deferred to Eve (console/decision items, not code)

- PIN → device-credential decoupling (lockout risk — needs decision).
- Granting the CI service account Rules Admin + dropping
  `continue-on-error` in deploy.yml (console action).
- Verifying live Firestore rules match the repo (console check).
- SHA-pinning GitHub Actions (skipped: wrong-SHA risk outweighs tag-rewrite
  risk for a solo private repo).
