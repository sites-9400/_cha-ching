import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, getDoc, collection, getDocs } from "firebase/firestore";
import fs from "node:fs";

const pin = process.env.SEED_PIN;
if (!pin) {
  console.error("Usage: SEED_PIN=<your 6-digit pin> npm run backup");
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
const data = {};

// Fetch every doc in a collection, tagging each with its id.
const dump = async (path) => {
  const snap = await getDocs(collection(db, path));
  const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  data[path] = docs;
  console.log(`${path}: ${docs.length} doc(s)`);
  return docs;
};

// The household root doc itself (meta: savingsBalance, floor, currency).
const hhSnap = await getDoc(doc(db, HH));
data[HH] = hhSnap.exists() ? hhSnap.data() : null;
console.log(`${HH}: ${hhSnap.exists() ? 1 : 0} doc(s)`);

// Collections directly under the household — mirrors src/lib/paths.ts.
const collections = [
  "template-lines",
  "template-incomes",
  "categories",
  "events",
  "sinkingFunds",
  "accounts",
  "debts",
  "expenses",
  "savingsMoves",
  "subscriptions",
];
for (const name of collections) await dump(`${HH}/${name}`);

// Per-debt subcollections (debtPayments / debtCycles in paths.ts).
const debts = data[`${HH}/debts`];
for (const d of debts) {
  await dump(`${HH}/debts/${d.id}/payments`);
  await dump(`${HH}/debts/${d.id}/cycles`);
}

// Months collection, plus per-month subcollections (monthLines / monthIncomes / monthBackups).
await dump(`${HH}/months`);
const months = data[`${HH}/months`];
for (const m of months) {
  await dump(`${HH}/months/${m.id}/lines`);
  await dump(`${HH}/months/${m.id}/incomes`);
  await dump(`${HH}/months/${m.id}/backups`);
}

const now = new Date();
const pad = (n) => String(n).padStart(2, "0");
const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

const outDir = "/Users/gamaliel/Library/CloudStorage/Dropbox/Personal Workspace/finances/cha-ching-backups/";
fs.mkdirSync(outDir, { recursive: true });
const outPath = `${outDir}cha-ching-backup-${stamp}.json`;

fs.writeFileSync(
  outPath,
  JSON.stringify(
    {
      exportedAt: now.toISOString(),
      projectId: app.options.projectId,
      data,
    },
    null,
    2,
  ),
);
console.log(`Backup written to ${outPath}`);
process.exit(0);
