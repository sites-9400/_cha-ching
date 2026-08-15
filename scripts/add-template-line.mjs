/**
 * Add ONE recurring monthly line to the template, without touching anything else.
 *
 *   SEED_PIN=<your 6-digit pin> node scripts/add-template-line.mjs
 *
 * Do NOT use `npm run seed` for this — seed.mjs rewrites the whole household
 * from the 2026-07-13 snapshot and would clobber every edit made since.
 *
 * To add a different line later, change the LINE constant below.
 * `order` is computed automatically as last-in-its-cutoff.
 */
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { collection, doc, getDoc, getDocs, getFirestore, setDoc } from "firebase/firestore";

const LINE = {
  id: "philhealth",
  name: "PhilHealth",
  amount: 500,
  channel: "CIMB",
  cutoff: 1,
};

const pin = process.env.SEED_PIN;
if (!pin) {
  console.error("Usage: SEED_PIN=<your 6-digit pin> node scripts/add-template-line.mjs");
  process.exit(1);
}

const app = initializeApp({
  apiKey: "AIzaSyB5AbM8zHTAcp6PqGhC2PW0uxRfhFtMaEw",
  authDomain: "cha-ching-c3470.firebaseapp.com",
  projectId: "cha-ching-c3470",
});
const db = getFirestore(app);
await signInWithEmailAndPassword(getAuth(app), "vault@cha-ching.app", `${pin}:chaching-2026-x7-pepper`);

const COL = "households/main/template-lines";

// Refuse to overwrite an existing line — this script only ever adds.
const existing = await getDoc(doc(db, `${COL}/${LINE.id}`));
if (existing.exists()) {
  console.error(`✋ "${LINE.id}" already exists — not overwriting. Current value:`);
  console.error(JSON.stringify(existing.data(), null, 2));
  console.error("Edit it in Settings → Template instead, or change LINE.id.");
  process.exit(1);
}

// Place it last within its cutoff.
const snap = await getDocs(collection(db, COL));
const orders = snap.docs
  .map((d) => d.data())
  .filter((l) => l.cutoff === LINE.cutoff)
  .map((l) => Number(l.order) || 0);
const order = (orders.length ? Math.max(...orders) : 0) + 1;

const line = { ...LINE, order };
await setDoc(doc(db, `${COL}/${LINE.id}`), line);

console.log("✅ Added template line:");
console.log(JSON.stringify(line, null, 2));
console.log(`\n(cutoff ${LINE.cutoff} had ${orders.length} lines; this one is order ${order})`);
process.exit(0);
