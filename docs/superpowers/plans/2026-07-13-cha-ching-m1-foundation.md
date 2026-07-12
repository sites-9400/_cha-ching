# Cha-Ching M1 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A live, PIN-secured Cha-Ching app on Firebase Hosting with CI auto-deploy, locked Firestore rules, unit-tested money math, and Eve's real data seeded — proven end-to-end by a read-only month preview screen.

**Architecture:** Single-page React app (Vite + TypeScript + Tailwind v4) talking directly to Firestore with offline persistence. No servers. PIN unlocks a hidden Firebase Auth email/password account; Firestore rules admit only that account's UID. GitHub Actions deploys `main` to Firebase Hosting.

**Tech Stack:** React 18, Vite 6, TypeScript (strict), Tailwind CSS v4 (`@tailwindcss/vite`), Firebase JS SDK v11 (Auth + Firestore), Vitest 3, firebase-tools (CLI), GitHub Actions.

## Global Constraints

- Repo root **is** the app root: `/Users/gamaliel/Library/CloudStorage/Dropbox/Personal Workspace/cha-ching`
- Firebase project: `cha-ching-c3470` (Spark plan). Hosting site default: `cha-ching-c3470.web.app`
- Firebase web config (public, safe to commit) — exactly:
  `apiKey: "AIzaSyB5AbM8zHTAcp6PqGhC2PW0uxRfhFtMaEw", authDomain: "cha-ching-c3470.firebaseapp.com", projectId: "cha-ching-c3470", storageBucket: "cha-ching-c3470.firebasestorage.app", messagingSenderId: "791695908223", appId: "1:791695908223:web:a91f400cc8339e579c8e4a"`
- Hidden auth identity: email `vault@cha-ching.app`, password = `${PIN}:${PEPPER}` where `PEPPER = "chaching-2026-x7-pepper"`
- All money is PHP; format with `new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" })`
- Firestore data root: `households/main` (all app data lives beneath it)
- Node 20+, npm. TypeScript `strict: true`. No ESLint/Prettier in M1 (YAGNI).
- git identity already configured (Gamaliel Eve <germinggong@gmail.com>). Commit after every task.
- The repo lives inside Dropbox — Task 1 marks `node_modules` Dropbox-ignored to prevent sync churn.
- **User-action steps** (marked ⚠️ USER) need Eve at the keyboard/console; pause and ask, don't skip.

---

### Task 1: Scaffold the app (Vite + React + TS + Tailwind)

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/index.css`, `.gitignore`

**Interfaces:**
- Produces: running dev server + `npm run build` artifact in `dist/`; `App` default-exports the root component later tasks replace.

- [ ] **Step 1: Write config + entry files**

`package.json`:
```json
{
  "name": "cha-ching",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "test": "vitest",
    "seed": "node scripts/seed.mjs"
  },
  "dependencies": {
    "firebase": "^11.1.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.0.0",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.4",
    "tailwindcss": "^4.0.0",
    "typescript": "~5.6.3",
    "vite": "^6.0.3",
    "vitest": "^3.0.0"
  }
}
```

`vite.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
```

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "isolatedModules": true,
    "types": ["vitest/globals"]
  },
  "include": ["src"]
}
```

`index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#0E5A54" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <title>Cha-Ching</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`src/main.tsx`:
```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

`src/App.tsx`:
```tsx
export default function App() {
  return (
    <main className="min-h-screen bg-emerald-950 text-emerald-50 flex items-center justify-center">
      <h1 className="text-3xl font-bold">Cha-Ching 🤑</h1>
    </main>
  );
}
```

`src/index.css`:
```css
@import "tailwindcss";
```

`.gitignore`:
```
node_modules
dist
.firebase
*.local
users-export.json
```

- [ ] **Step 2: Install and keep Dropbox away from node_modules**

Run:
```bash
cd "/Users/gamaliel/Library/CloudStorage/Dropbox/Personal Workspace/cha-ching"
npm install
xattr -w com.dropbox.ignored 1 node_modules
```
Expected: install completes with no errors; `xattr -l node_modules` shows `com.dropbox.ignored: 1`.

- [ ] **Step 3: Verify dev build works**

Run: `npm run build && npm run typecheck`
Expected: `dist/index.html` produced, `vite build` reports built assets, typecheck exits 0.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: scaffold Vite + React + TS + Tailwind app shell"
```

---

### Task 2: Firebase Hosting — first manual deploy

**Files:**
- Create: `firebase.json`, `.firebaserc`

**Interfaces:**
- Produces: `https://cha-ching-c3470.web.app` serving the app; `firebase.json` later reused by CI and rules deploys.

- [ ] **Step 1: Write hosting config**

`firebase.json`:
```json
{
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [{ "source": "**", "destination": "/index.html" }]
  },
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  }
}
```

`.firebaserc`:
```json
{ "projects": { "default": "cha-ching-c3470" } }
```

Also create `firestore.indexes.json` (empty for now):
```json
{ "indexes": [], "fieldOverrides": [] }
```
And a placeholder `firestore.rules` (locked tight until Task 4):
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

- [ ] **Step 2: ⚠️ USER — Firebase CLI login**

Ask Eve to run in the Claude Code prompt: `! npx firebase-tools login`
(A browser opens; sign in with germinggong@gmail.com.)
Expected: "Success! Logged in as germinggong@gmail.com".

- [ ] **Step 3: Deploy hosting**

Run: `npm run build && npx firebase-tools deploy --only hosting`
Expected output ends with `Hosting URL: https://cha-ching-c3470.web.app`.
Verify: `curl -s https://cha-ching-c3470.web.app | grep -o "<title>Cha-Ching</title>"` → prints the title tag.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: Firebase Hosting config + first deploy"
```

---

### Task 3: CI — auto-deploy on push to main

**Files:**
- Create: `.github/workflows/deploy.yml`

**Interfaces:**
- Consumes: `npm run build`, `npm test`, `npm run typecheck` from Task 1.
- Produces: every push to `main` → tests → build → live deploy.

- [ ] **Step 1: ⚠️ USER — create the deploy secret**

Ask Eve to run: `! npx firebase-tools init hosting:github`
Answers: repo `sites-9400/_cha-ching`; set up workflow: **Yes**; overwrite files: accept defaults; PR previews: **No**.
This stores the GitHub secret `FIREBASE_SERVICE_ACCOUNT_CHA_CHING_C3470` automatically.

- [ ] **Step 2: Replace generated workflows with ours**

Delete whatever `.github/workflows/*.yml` the init created, then write `.github/workflows/deploy.yml`:
```yaml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run typecheck
      - run: npm test -- --run
      - run: npm run build
      - uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: ${{ secrets.GITHUB_TOKEN }}
          firebaseServiceAccount: ${{ secrets.FIREBASE_SERVICE_ACCOUNT_CHA_CHING_C3470 }}
          channelId: live
          projectId: cha-ching-c3470
```
Note: `npm test -- --run` currently passes with "no test files" — Vitest 3 exits 0 with `--passWithNoTests`; add that flag: `npm test -- --run --passWithNoTests`. Use the flag version in the yaml above (edit the line to `- run: npm test -- --run --passWithNoTests`).

- [ ] **Step 3: Push and verify the pipeline**

```bash
git add -A && git commit -m "ci: auto-deploy main to Firebase Hosting" && git push
```
Then: `gh run watch --repo sites-9400/_cha-ching --exit-status` (or poll `gh run list`)
Expected: workflow green; site still serves.

---

### Task 4: PIN auth + locked Firestore rules

**Files:**
- Create: `src/lib/firebase.ts`, `src/lib/pinAuth.ts`, `src/components/PinPad.tsx`
- Modify: `src/App.tsx`, `firestore.rules`

**Interfaces:**
- Produces: `auth`, `db` singletons from `src/lib/firebase.ts`; `unlock(pin): Promise<void>`, `setupPin(pin): Promise<void>`, `watchAuth(cb: (signedIn: boolean) => void): () => void` from `src/lib/pinAuth.ts`. `<PinPad />` renders full-screen and resolves via auth state change.

- [ ] **Step 1: ⚠️ USER — enable services in Firebase console**

Ask Eve (console.firebase.google.com → project `cha-ching-c3470`):
1. **Build → Authentication → Get started → Sign-in method → Email/Password → Enable → Save**
2. **Build → Firestore Database → Create database → Start in production mode → location `asia-southeast1` → Enable**

- [ ] **Step 2: Write the Firebase singletons**

`src/lib/firebase.ts`:
```ts
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyB5AbM8zHTAcp6PqGhC2PW0uxRfhFtMaEw",
  authDomain: "cha-ching-c3470.firebaseapp.com",
  projectId: "cha-ching-c3470",
  storageBucket: "cha-ching-c3470.firebasestorage.app",
  messagingSenderId: "791695908223",
  appId: "1:791695908223:web:a91f400cc8339e579c8e4a",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});
```

- [ ] **Step 3: Write PIN auth service**

`src/lib/pinAuth.ts`:
```ts
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { auth } from "./firebase";

const EMAIL = "vault@cha-ching.app";
const PEPPER = "chaching-2026-x7-pepper";

const toPassword = (pin: string) => `${pin}:${PEPPER}`;

/** Sign in with an existing PIN. Throws Firebase auth errors on failure. */
export async function unlock(pin: string): Promise<void> {
  await signInWithEmailAndPassword(auth, EMAIL, toPassword(pin));
}

/** First-run only: create the hidden account from a new PIN. */
export async function setupPin(pin: string): Promise<void> {
  await createUserWithEmailAndPassword(auth, EMAIL, toPassword(pin));
}

export async function lock(): Promise<void> {
  await signOut(auth);
}

/** Subscribe to signed-in state; returns unsubscribe. */
export function watchAuth(cb: (signedIn: boolean) => void): () => void {
  return onAuthStateChanged(auth, (user) => cb(user !== null));
}
```

- [ ] **Step 4: Write the PIN pad**

`src/components/PinPad.tsx`:
```tsx
import { useState } from "react";
import { setupPin, unlock } from "../lib/pinAuth";

type Mode = "enter" | "setup" | "confirm";

export default function PinPad() {
  const [mode, setMode] = useState<Mode>("enter");
  const [pin, setPin] = useState("");
  const [firstPin, setFirstPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(candidate: string) {
    setBusy(true);
    setError("");
    try {
      if (mode === "enter") {
        await unlock(candidate);
      } else if (mode === "setup") {
        setFirstPin(candidate);
        setMode("confirm");
      } else {
        if (candidate !== firstPin) {
          setError("PINs don't match — start over.");
          setMode("setup");
        } else {
          await setupPin(candidate);
        }
      }
    } catch (e: unknown) {
      const code = (e as { code?: string }).code ?? "";
      setError(
        code === "auth/email-already-in-use"
          ? "Already set up — enter your existing PIN."
          : "Wrong PIN. Try again.",
      );
      if (code === "auth/email-already-in-use") setMode("enter");
    } finally {
      setPin("");
      setBusy(false);
    }
  }

  function press(d: string) {
    if (busy) return;
    const next = pin + d;
    setPin(next);
    if (next.length === 6) void submit(next);
  }

  const title =
    mode === "enter" ? "Enter PIN" : mode === "setup" ? "Set a 6-digit PIN" : "Confirm PIN";

  return (
    <main className="min-h-screen bg-emerald-950 text-emerald-50 flex flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-2xl font-bold">Cha-Ching 🤑</h1>
      <p className="text-emerald-300">{title}</p>
      <div className="flex gap-3" aria-label="PIN progress">
        {Array.from({ length: 6 }, (_, i) => (
          <span
            key={i}
            className={`h-4 w-4 rounded-full ${i < pin.length ? "bg-emerald-300" : "bg-emerald-800"}`}
          />
        ))}
      </div>
      {error && <p className="text-red-300 text-sm">{error}</p>}
      <div className="grid grid-cols-3 gap-4">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map((k, i) =>
          k === "" ? (
            <span key={i} />
          ) : (
            <button
              key={i}
              className="h-16 w-16 rounded-full bg-emerald-900 text-2xl font-semibold active:bg-emerald-700"
              onClick={() => (k === "⌫" ? setPin(pin.slice(0, -1)) : press(k))}
            >
              {k}
            </button>
          ),
        )}
      </div>
      {mode === "enter" && (
        <button className="text-emerald-400 text-sm underline" onClick={() => setMode("setup")}>
          First time? Set up your PIN
        </button>
      )}
    </main>
  );
}
```

- [ ] **Step 5: Gate the app behind auth**

Replace `src/App.tsx`:
```tsx
import { useEffect, useState } from "react";
import PinPad from "./components/PinPad";
import { watchAuth } from "./lib/pinAuth";

export default function App() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => watchAuth(setSignedIn), []);

  if (signedIn === null) return null; // auth state loading
  if (!signedIn) return <PinPad />;

  return (
    <main className="min-h-screen bg-emerald-950 text-emerald-50 flex items-center justify-center">
      <h1 className="text-3xl font-bold">Unlocked ✅</h1>
    </main>
  );
}
```

- [ ] **Step 6: ⚠️ USER — set the real PIN**

Run `npm run dev`, ask Eve to open the local URL, tap "First time? Set up your PIN", choose her PIN (twice). Expected: screen shows "Unlocked ✅".

- [ ] **Step 7: Lock Firestore rules to her UID**

Get the UID: `npx firebase-tools auth:export users-export.json --project cha-ching-c3470 && cat users-export.json`
Copy the `localId` value, then rewrite `firestore.rules`:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == "PASTE_UID_HERE";
    }
  }
}
```
(with the real UID in place of `PASTE_UID_HERE`), then:
Run: `npx firebase-tools deploy --only firestore:rules`
Expected: "Deploy complete!". Delete `users-export.json` afterwards (it's gitignored, but clean up anyway): `rm users-export.json`.

- [ ] **Step 8: Verify, typecheck, commit, push**

Run: `npm run typecheck && npm run build`
Expected: clean.
```bash
git add -A && git commit -m "feat: PIN-fronted auth + UID-locked Firestore rules" && git push
```
Verify the deployed site now shows the PIN pad and unlocks with Eve's PIN.

---

### Task 5: Money-math core — types + selectors + tests

**Files:**
- Create: `src/lib/types.ts`, `src/lib/selectors.ts`, `src/lib/selectors.test.ts`, `src/lib/format.ts`

**Interfaces:**
- Produces (used by every later screen):
  - `types.ts`: `Channel`, `LineStatus`, `TemplateLine`, `MonthLine`, `Income`, `Debt`, `EventItem`, `SinkingFund` (shapes below)
  - `selectors.ts`: `cutoffSummary(lines, incomes, cutoff)`, `debtTotals(debts)`, `projectDebtFreeMonth(debts, monthlyPaydown, fromMonth)`, `generateMonthLines(template, events, monthKey)`, `fundStateFor(fund, monthIndex)`
  - `format.ts`: `peso(n: number): string`, `addMonths(monthKey: string, n: number): string`

- [ ] **Step 1: Write the domain types**

`src/lib/types.ts`:
```ts
export type Channel =
  | "CIMB" | "GCASH" | "MARIBANK" | "MAYA" | "RCBC"
  | "RCBC CREDIT" | "CASH" | "WISE/KLOOK" | "RCBC SAVINGS";

export type LineStatus = "" | "PAID" | "RECEIVED" | "TRANSFERRED" | "SENT";

export interface TemplateLine {
  id: string;
  name: string;
  amount: number;
  channel: Channel;
  cutoff: 1 | 2;
  order: number;
  debtId?: string;
}

export interface MonthLine extends TemplateLine {
  status: LineStatus;
  paidDate?: string; // ISO date
  oneOff: boolean;
}

export interface Income {
  id: string;
  name: string;
  amount: number;
  day: number; // 13 | 25 | 29
  cutoff: 1 | 2;
}

export interface Debt {
  id: string;
  name: string;
  startingBalance: number;
  currentBalance: number;
  dueDay?: number;
  payoffOrder: number;
  channel: Channel;
  isBNPL: boolean;
  active: boolean;
}

export interface EventItem {
  id: string;
  name: string;
  amount: number;
  month: string; // "YYYY-MM"
  channel?: Channel;
  note?: string;
}

export interface SinkingFund {
  id: string;
  name: string;
  monthlyDeposit: number;
  releaseMonths: number[]; // e.g. [3, 6, 9, 12]
  balance: number;
}
```

`src/lib/format.ts`:
```ts
const fmt = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });

export const peso = (n: number): string => fmt.format(n);

/** "2026-07" + 3 → "2026-10" */
export function addMonths(monthKey: string, n: number): string {
  const [y, m] = monthKey.split("-").map(Number);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${String(nm).padStart(2, "0")}`;
}
```

- [ ] **Step 2: Write failing tests (real July numbers)**

`src/lib/selectors.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { addMonths } from "./format";
import {
  cutoffSummary,
  debtTotals,
  fundStateFor,
  generateMonthLines,
  projectDebtFreeMonth,
} from "./selectors";
import type { Debt, EventItem, Income, MonthLine, SinkingFund, TemplateLine } from "./types";

const mk = (
  name: string,
  amount: number,
  cutoff: 1 | 2,
  status: MonthLine["status"] = "",
): MonthLine => ({
  id: name,
  name,
  amount,
  channel: "CIMB",
  cutoff,
  order: 0,
  status,
  oneOff: false,
});

const incomes: Income[] = [
  { id: "c13", name: "Crunchy 13th", amount: 60600, day: 13, cutoff: 1 },
  { id: "p25", name: "PHP 25th", amount: 51000, day: 25, cutoff: 2 },
  { id: "c29", name: "Crunchy 29th", amount: 60600, day: 29, cutoff: 2 },
];

// July 1st-cutoff template lines (spec seed data)
const cut1: MonthLine[] = [
  mk("Allowance", 10000, 1, "PAID"),
  mk("Tithes", 5000, 1),
  mk("Subscriptions", 2277, 1),
  mk("Gemini", 167, 1),
  mk("Shopping Fund", 2000, 1),
];

describe("cutoffSummary", () => {
  it("computes income, planned, ticked and surplus for cutoff 1", () => {
    const s = cutoffSummary(cut1, incomes, 1);
    expect(s.income).toBe(60600);
    expect(s.planned).toBe(19444);
    expect(s.ticked).toBe(10000); // only Allowance is PAID
    expect(s.surplus).toBe(60600 - 19444); // 41156
  });

  it("cutoff 2 income combines both paydays", () => {
    const s = cutoffSummary([], incomes, 2);
    expect(s.income).toBe(111600);
    expect(s.surplus).toBe(111600);
  });
});

const debts: Debt[] = [
  { id: "revi", name: "REVI", startingBalance: 17265, currentBalance: 17265, payoffOrder: 1, channel: "CIMB", isBNPL: false, active: true },
  { id: "classic", name: "RCBC Classic", startingBalance: 6337, currentBalance: 6337, payoffOrder: 2, channel: "RCBC", isBNPL: false, active: true },
  { id: "gold", name: "RCBC Gold", startingBalance: 44871, currentBalance: 44871, payoffOrder: 3, channel: "RCBC", isBNPL: false, active: true },
  { id: "landers", name: "Landers", startingBalance: 49923, currentBalance: 49923, payoffOrder: 4, channel: "MAYA", isBNPL: false, active: true },
  { id: "ew", name: "EastWest", startingBalance: 98824, currentBalance: 98824, payoffOrder: 5, channel: "MARIBANK", isBNPL: false, active: true },
  { id: "laptop", name: "EW Laptop", startingBalance: 51995, currentBalance: 51995, payoffOrder: 6, channel: "MARIBANK", isBNPL: true, active: true },
];

describe("debtTotals", () => {
  it("separates blitz debt (excl BNPL) from total", () => {
    const t = debtTotals(debts);
    expect(t.total).toBe(269215);
    expect(t.blitz).toBe(217220);
  });
});

describe("projectDebtFreeMonth", () => {
  it("divides blitz debt by monthly paydown, ceiling", () => {
    // 217220 / 90164 = 2.41 → 3 months from July → paydowns land Jul, Aug, Sep
    expect(projectDebtFreeMonth(debts, 90164, "2026-07")).toBe("2026-09");
  });
  it("returns fromMonth when no blitz debt remains", () => {
    const clear = debts.map((d) => (d.isBNPL ? d : { ...d, currentBalance: 0 }));
    expect(projectDebtFreeMonth(clear, 90164, "2026-07")).toBe("2026-07");
  });
});

describe("generateMonthLines", () => {
  const template: TemplateLine[] = [
    { id: "t1", name: "Rent", amount: 10000, channel: "RCBC", cutoff: 2, order: 1 },
  ];
  const events: EventItem[] = [
    { id: "e1", name: "Iloilo trip", amount: 20000, month: "2026-08" },
    { id: "e2", name: "Mama bday", amount: 5000, month: "2026-09" },
  ];
  it("copies template with blank status and appends the month's events as one-offs", () => {
    const lines = generateMonthLines(template, events, "2026-08");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({ name: "Rent", status: "", oneOff: false });
    expect(lines[1]).toMatchObject({ name: "Iloilo trip", amount: 20000, oneOff: true, cutoff: 2 });
  });
  it("excludes events from other months", () => {
    const lines = generateMonthLines(template, events, "2026-09");
    expect(lines.map((l) => l.name)).toEqual(["Rent", "Mama bday"]);
  });
});

describe("fundStateFor", () => {
  const fund: SinkingFund = {
    id: "shop",
    name: "Shopping",
    monthlyDeposit: 2000,
    releaseMonths: [3, 6, 9, 12],
    balance: 0,
  };
  it("deposits monthly and releases full balance on release months", () => {
    // Jul(7): +2000→2000 · Aug(8): +2000→4000 · Sep(9): release 6000→0
    expect(fundStateFor(fund, 7)).toMatchObject({ deposit: 2000, release: 0 });
    const sep = fundStateFor({ ...fund, balance: 4000 }, 9);
    expect(sep).toMatchObject({ deposit: 2000, release: 6000, balanceAfter: 0 });
  });
});

describe("addMonths", () => {
  it("crosses year boundaries", () => {
    expect(addMonths("2026-11", 3)).toBe("2027-02");
  });
});
```

- [ ] **Step 3: Run tests, verify they fail**

Run: `npm test -- --run`
Expected: FAIL — `selectors.ts` doesn't exist / functions not defined.

- [ ] **Step 4: Implement the selectors**

`src/lib/selectors.ts`:
```ts
import { addMonths } from "./format";
import type { Debt, EventItem, Income, MonthLine, SinkingFund, TemplateLine } from "./types";

export interface CutoffSummary {
  income: number;
  planned: number;
  ticked: number;
  surplus: number;
}

export function cutoffSummary(
  lines: MonthLine[],
  incomes: Income[],
  cutoff: 1 | 2,
): CutoffSummary {
  const inCut = (xs: { cutoff: 1 | 2 }[]) => xs.filter((x) => x.cutoff === cutoff);
  const income = inCut(incomes).reduce((s, i) => s + (i as Income).amount, 0);
  const cutLines = inCut(lines) as MonthLine[];
  const planned = cutLines.reduce((s, l) => s + l.amount, 0);
  const ticked = cutLines.filter((l) => l.status !== "").reduce((s, l) => s + l.amount, 0);
  return { income, planned, ticked, surplus: income - planned };
}

export interface DebtTotals {
  total: number;
  blitz: number; // interest-bearing (non-BNPL) debt only
}

export function debtTotals(debts: Debt[]): DebtTotals {
  const active = debts.filter((d) => d.active);
  const total = active.reduce((s, d) => s + d.currentBalance, 0);
  const blitz = active.filter((d) => !d.isBNPL).reduce((s, d) => s + d.currentBalance, 0);
  return { total, blitz };
}

/** Naive projection: blitz debt / monthly paydown, ceilinged, from given month. */
export function projectDebtFreeMonth(
  debts: Debt[],
  monthlyPaydown: number,
  fromMonth: string,
): string {
  const { blitz } = debtTotals(debts);
  if (blitz <= 0 || monthlyPaydown <= 0) return fromMonth;
  return addMonths(fromMonth, Math.ceil(blitz / monthlyPaydown) - 1);
}

/** Rollover: template copy (status blank) + this month's events as one-off lines (cutoff 2). */
export function generateMonthLines(
  template: TemplateLine[],
  events: EventItem[],
  monthKey: string,
): MonthLine[] {
  const base: MonthLine[] = template.map((t) => ({ ...t, status: "", oneOff: false }));
  const oneOffs: MonthLine[] = events
    .filter((e) => e.month === monthKey)
    .map((e, i) => ({
      id: `event-${e.id}`,
      name: e.name,
      amount: e.amount,
      channel: e.channel ?? "CASH",
      cutoff: 2,
      order: 1000 + i,
      status: "",
      oneOff: true,
    }));
  return [...base, ...oneOffs];
}

export interface FundState {
  deposit: number;
  release: number;
  balanceAfter: number;
}

/** What the fund does in calendar month `monthIndex` (1-12): deposit always, release all after deposit on release months. */
export function fundStateFor(fund: SinkingFund, monthIndex: number): FundState {
  const deposit = fund.monthlyDeposit;
  const afterDeposit = fund.balance + deposit;
  const isRelease = fund.releaseMonths.includes(monthIndex);
  const release = isRelease ? afterDeposit : 0;
  return { deposit, release, balanceAfter: afterDeposit - release };
}
```

- [ ] **Step 5: Run tests, verify pass**

Run: `npm test -- --run`
Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: money-math selectors with unit tests"
```

---

### Task 6: Seed script + live month preview (proof of life)

**Files:**
- Create: `scripts/seed.mjs`, `src/components/MonthPreview.tsx`, `src/lib/paths.ts`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `unlock` password scheme from Task 4; types/selectors from Task 5.
- Produces: Firestore populated under `households/main`; `src/lib/paths.ts` exports `HH = "households/main"` used by all future data code.

- [ ] **Step 1: Write shared path constant**

`src/lib/paths.ts`:
```ts
/** Root document for all app data. */
export const HH = "households/main";
```

- [ ] **Step 2: Write the seed script**

`scripts/seed.mjs` (run with `SEED_PIN=... npm run seed`; **never commit the PIN**):
```js
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { doc, getFirestore, setDoc } from "firebase/firestore";

const pin = process.env.SEED_PIN;
if (!pin) {
  console.error("Usage: SEED_PIN=<your 6-digit pin> npm run seed");
  process.exit(1);
}

const app = initializeApp({
  apiKey: "AIzaSyB5AbM8zHTAcp6PqGhC2PW0uxRfhFtMaEw",
  authDomain: "cha-ching-c3470.firebaseapp.com",
  projectId: "cha-ching-c3470",
});
const auth = getAuth(app);
const db = getFirestore(app);
await signInWithEmailAndPassword(auth, "vault@cha-ching.app", `${pin}:chaching-2026-x7-pepper`);

const HH = "households/main";
const put = (path, data) => setDoc(doc(db, path), data);

// meta
await put(HH, { savingsBalance: 111362, savingsFloor: 100000, currency: "PHP" });
await put(`${HH}/meta/summary`, { updatedAt: new Date().toISOString() });

// income sources
const incomes = [
  { id: "crunchy-13", name: "Crunchy (13th)", amount: 60600, day: 13, cutoff: 1 },
  { id: "php-25", name: "PHP (25th)", amount: 51000, day: 25, cutoff: 2 },
  { id: "crunchy-29", name: "Crunchy (29th)", amount: 60600, day: 29, cutoff: 2 },
];
for (const i of incomes) await put(`${HH}/template-incomes/${i.id}`, i);

// template lines
const L = (id, name, amount, channel, cutoff, order, extra = {}) => ({
  id, name, amount, channel, cutoff, order, ...extra,
});
const lines = [
  L("allowance", "Allowance", 10000, "CIMB", 1, 1),
  L("tithes-1", "Tithes", 5000, "CIMB", 1, 2),
  L("subs-1", "Subscriptions (Netflix, iCloud, YT)", 2277, "RCBC CREDIT", 1, 3),
  L("gemini", "Gemini", 167, "RCBC", 1, 4),
  L("shopping-fund", "Shopping Sinking Fund", 2000, "CIMB", 1, 5),
  L("converge", "Converge", 1500, "CIMB", 2, 1),
  L("cat-fund", "Cat Fund", 2450, "CIMB", 2, 2),
  L("tithes-2", "Tithes", 5000, "CIMB", 2, 3),
  L("grocery", "Grocery Nuangan", 5000, "GCASH", 2, 4),
  L("joela", "Joela Salary", 15000, "GCASH", 2, 5),
  L("allow-1-28", "Allowance 1 28th", 5750, "GCASH", 2, 6),
  L("subs-2", "Subscriptions (Dropbox, GooglePapa, Scribd)", 1039, "GCASH", 2, 7),
  L("freedom-life", "Freedom Life", 470, "GCASH", 2, 8),
  L("bills", "Bills Nuangan", 1800, "GCASH", 2, 9),
  L("allow-2-5", "Allowance 2 5th", 5750, "MARIBANK", 2, 10),
  L("joint", "Joint Account", 2000, "MAYA", 2, 11),
  L("jude-paddle", "Jude Paddle", 2500, "RCBC", 2, 12),
  L("rent", "Rent", 10000, "RCBC", 2, 13),
  L("ew-laptop", "EastWest Laptop (BNPL)", 4333, "MARIBANK", 2, 14, { debtId: "ew-laptop" }),
];
for (const l of lines) await put(`${HH}/template-lines/${l.id}`, l);

// debts
const debts = [
  { id: "revi", name: "REVI Credit", startingBalance: 17265, currentBalance: 17265, dueDay: 16, payoffOrder: 1, channel: "CIMB", isBNPL: false, active: true },
  { id: "rcbc-classic", name: "RCBC Classic", startingBalance: 6337, currentBalance: 6337, dueDay: 4, payoffOrder: 2, channel: "RCBC", isBNPL: false, active: true },
  { id: "rcbc-gold", name: "RCBC Visa Gold", startingBalance: 44871, currentBalance: 44871, dueDay: 28, payoffOrder: 3, channel: "RCBC", isBNPL: false, active: true },
  { id: "landers", name: "Landers / Maya", startingBalance: 49923, currentBalance: 49923, payoffOrder: 4, channel: "MAYA", isBNPL: false, active: true },
  { id: "eastwest", name: "EastWest revolving", startingBalance: 98824, currentBalance: 98824, dueDay: 10, payoffOrder: 5, channel: "MARIBANK", isBNPL: false, active: true },
  { id: "ew-laptop", name: "EastWest Laptop 0%", startingBalance: 51995, currentBalance: 51995, dueDay: 10, payoffOrder: 6, channel: "MARIBANK", isBNPL: true, active: true },
];
for (const d of debts) await put(`${HH}/debts/${d.id}`, d);

// events
const events = [
  { id: "dentures-1", name: "Sister's dentures 1 of 2", amount: 15000, month: "2026-07" },
  { id: "dentures-2", name: "Sister's dentures 2 of 2", amount: 15000, month: "2026-08" },
  { id: "iloilo", name: "Iloilo trip", amount: 20000, month: "2026-08" },
  { id: "anniversary", name: "Anniversary — Jude & Eve", amount: 10000, month: "2026-08" },
  { id: "tuition-dp", name: "Law school tuition DP", amount: 5000, month: "2026-08" },
  { id: "tuition-1", name: "Tuition 1 of 3", amount: 8000, month: "2026-09" },
  { id: "mama-bday", name: "Mama's birthday", amount: 5000, month: "2026-09" },
  { id: "christell-bday", name: "Christell's birthday", amount: 4000, month: "2026-09" },
  { id: "5sos-travel", name: "5SOS flights + hotel", amount: 12000, month: "2026-09" },
  { id: "marianne-bday", name: "Marianne's birthday", amount: 4000, month: "2026-10" },
  { id: "erika-bday", name: "Erika's birthday", amount: 4000, month: "2026-10" },
  { id: "tuition-2", name: "Tuition 2 of 3", amount: 8000, month: "2026-11" },
  { id: "tuition-3", name: "Tuition 3 of 3", amount: 8000, month: "2026-12" },
  { id: "christmas", name: "Christmas gifts", amount: 15000, month: "2026-12" },
];
for (const e of events) await put(`${HH}/events/${e.id}`, e);

// sinking fund
await put(`${HH}/sinkingFunds/shopping`, {
  id: "shopping",
  name: "Shopping",
  monthlyDeposit: 2000,
  releaseMonths: [3, 6, 9, 12],
  balance: 0,
});

// categories
const cats = ["Food", "Shopping", "Transport", "Gifts", "Bills", "Cats", "Other"];
for (let i = 0; i < cats.length; i++)
  await put(`${HH}/categories/${cats[i].toLowerCase()}`, { name: cats[i], order: i });

console.log("Seed complete ✅");
process.exit(0);
```

- [ ] **Step 3: Run the seed (needs Eve's PIN once)**

⚠️ USER — ask Eve to run: `! SEED_PIN=<her pin> npm run seed`
Expected: `Seed complete ✅`. (The PIN stays in her shell history only; suggest she runs `history -d $(history 1 | awk '{print $1}')` after, or prefix the command with a space.)

- [ ] **Step 4: Write the month preview screen**

`src/components/MonthPreview.tsx`:
```tsx
import { collection, onSnapshot, query } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "../lib/firebase";
import { peso } from "../lib/format";
import { HH } from "../lib/paths";
import { cutoffSummary } from "../lib/selectors";
import type { Income, MonthLine, TemplateLine } from "../lib/types";

const CHIP: Record<string, string> = {
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

export default function MonthPreview() {
  const [lines, setLines] = useState<TemplateLine[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);

  useEffect(() => {
    const un1 = onSnapshot(query(collection(db, `${HH}/template-lines`)), (snap) =>
      setLines(snap.docs.map((d) => d.data() as TemplateLine).sort((a, b) => a.order - b.order)),
    );
    const un2 = onSnapshot(query(collection(db, `${HH}/template-incomes`)), (snap) =>
      setIncomes(snap.docs.map((d) => d.data() as Income)),
    );
    return () => {
      un1();
      un2();
    };
  }, []);

  const asMonthLines = lines.map((l) => ({ ...l, status: "" as const, oneOff: false }));

  return (
    <main className="min-h-screen bg-stone-100 text-stone-900 p-4 max-w-md mx-auto">
      <h1 className="text-xl font-bold mb-4">Cha-Ching — Template Preview</h1>
      {[1, 2].map((c) => {
        const cutoff = c as 1 | 2;
        const s = cutoffSummary(asMonthLines, incomes, cutoff);
        return (
          <section key={c} className="mb-6 bg-white rounded-xl shadow p-4">
            <h2 className="font-semibold mb-2">
              {cutoff === 1 ? "1ST CUTOFF" : "2ND CUT-OFF"}
            </h2>
            <ul className="divide-y divide-stone-100">
              {asMonthLines
                .filter((l) => l.cutoff === cutoff)
                .map((l) => (
                  <li key={l.id} className="py-2 flex items-center justify-between gap-2">
                    <span className="text-sm">{l.name}</span>
                    <span className="flex items-center gap-2">
                      <span className="text-sm font-semibold tabular-nums">{peso(l.amount)}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${CHIP[l.channel]}`}>
                        {l.channel}
                      </span>
                    </span>
                  </li>
                ))}
            </ul>
            <p className="mt-3 text-sm flex justify-between font-semibold">
              <span>Income {peso(s.income)}</span>
              <span className="text-emerald-700">Surplus {peso(s.surplus)}</span>
            </p>
          </section>
        );
      })}
    </main>
  );
}
```

- [ ] **Step 5: Wire it into App**

In `src/App.tsx`, replace the "Unlocked ✅" block: add `import MonthPreview from "./components/MonthPreview";` and change the final return to `return <MonthPreview />;`.

- [ ] **Step 6: Verify end-to-end**

Run: `npm run typecheck && npm test -- --run && npm run build`
Expected: clean + tests pass.
Manual: `npm run dev` → PIN unlock → both cutoffs render with lines, chips, and the surpluses **₱41,156** (cutoff 1) and **₱49,008** (cutoff 2).

- [ ] **Step 7: Commit and push (CI deploys it live)**

```bash
git add -A && git commit -m "feat: seed data + live template preview" && git push
```
Verify: after CI goes green, `https://cha-ching-c3470.web.app` shows PIN pad → preview with live data. **M1 complete.**

---

## Self-review notes

- Spec coverage for M1 scope (build-order items 1–3): scaffold+deploy (T1–T2), CI (T3), PIN auth+rules (T4), data layer+selectors+tests (T5), seed (T6). Screens/rollover/export are M2/M3 by design.
- Cutoff-2 template total is 62,592 (includes laptop 4,333) → preview surplus 49,008 matches the sheet. Test asserts income-only case to stay independent of line edits.
- `generateMonthLines` defaults events to cutoff 2 — documented in code; editable when M2 adds line editing.
- Type names consistent across tasks (`MonthLine`, `HH`, `peso`, `cutoffSummary`).
