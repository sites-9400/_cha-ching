import { useState } from "react";
import { useCollection } from "../hooks/useCollection";
import { peso } from "../lib/format";
import { categoriesCol, expensesCol } from "../lib/paths";
import { addExpense, deleteExpense, type ExpenseInput } from "../lib/repo";
import type { Category, Channel } from "../lib/types";
import { useAccounts } from "./AccountsProvider";

interface Expense extends ExpenseInput { id: string }

export default function QuickAdd() {
  const { names: CHANNELS, chip } = useAccounts();
  const categories = useCollection<Category>(categoriesCol());
  const expenses = useCollection<Expense>(expensesCol());
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Food");
  const [channel, setChannel] = useState<Channel>("CASH");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const cats = [...categories].sort((a, b) => a.order - b.order);
  const recent = [...expenses].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
  const value = Number(amount);
  const canSave = value > 0 && !busy;

  async function save() {
    if (!canSave) return;
    setBusy(true);
    try {
      await addExpense({ amount: value, category, channel, note, date: new Date().toISOString() });
      setAmount("");
      setNote("");
    } finally {
      setBusy(false);
    }
  }

  const Label = ({ children }: { children: React.ReactNode }) => (
    <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-400 mb-1.5">{children}</p>
  );

  return (
    <main className="p-4">
      <h1 className="text-xl font-bold mb-4">Quick Add</h1>
      <div className="bg-white rounded-2xl shadow p-5 flex flex-col gap-5">
        <div>
          <Label>Amount</Label>
          <div className="flex items-baseline gap-1 border-b-2 border-stone-200 focus-within:border-emerald-500 pb-1">
            <span className="text-2xl font-bold text-stone-400">₱</span>
            <input
              type="number" inputMode="decimal" placeholder="0" autoFocus
              value={amount} onChange={(e) => setAmount(e.target.value)}
              className="flex-1 min-w-0 text-3xl font-bold tabular-nums outline-none bg-transparent"
            />
          </div>
        </div>

        <div>
          <Label>Category</Label>
          <div className="flex flex-wrap gap-2">
            {cats.map((c) => (
              <button
                key={c.id} onClick={() => setCategory(c.name)}
                className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
                  category === c.name ? "bg-emerald-600 text-white" : "bg-stone-100 text-stone-600"
                }`}
              >{c.name}</button>
            ))}
          </div>
        </div>

        <div>
          <Label>Account</Label>
          <div className="flex flex-wrap gap-1.5">
            {CHANNELS.map((c) => (
              <button
                key={String(c)} onClick={() => setChannel(c)}
                className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
                  channel === c ? chip(c) : "bg-stone-100 text-stone-400"
                }`}
              >{c}</button>
            ))}
          </div>
        </div>

        <div>
          <Label>Note</Label>
          <input
            placeholder="optional" value={note} onChange={(e) => setNote(e.target.value)}
            className="w-full text-base border-b border-stone-200 pb-1 outline-none focus:border-emerald-500"
          />
        </div>

        <button
          onClick={() => void save()} disabled={!canSave}
          className="bg-emerald-600 disabled:bg-stone-300 text-white font-semibold rounded-xl py-3.5 text-base"
        >Save{value > 0 ? ` ${peso(value)}` : ""}</button>
      </div>

      <h2 className="font-semibold mt-6 mb-2 text-sm text-stone-600">Recent</h2>
      <ul className="flex flex-col gap-1.5">
        {recent.map((e) => (
          <li key={e.id} className="bg-white rounded-xl px-3 py-2.5 flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 min-w-0">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${chip(e.channel)}`}>{e.channel}</span>
              <span className="text-sm truncate">{e.category}{e.note ? ` · ${e.note}` : ""}</span>
            </span>
            <span className="flex items-center gap-2 shrink-0">
              <span className="text-sm font-semibold tabular-nums">{peso(e.amount)}</span>
              <button onClick={() => void deleteExpense(e.id)} className="text-stone-300 text-xs">✕</button>
            </span>
          </li>
        ))}
        {recent.length === 0 && <li className="text-sm text-stone-400 px-3">No expenses logged yet.</li>}
      </ul>
    </main>
  );
}
