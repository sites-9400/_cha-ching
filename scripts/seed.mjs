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
