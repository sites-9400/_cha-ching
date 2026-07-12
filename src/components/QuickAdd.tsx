import { useState } from "react";
import { useCollection } from "../hooks/useCollection";
import { channelChipSafe, CHANNELS } from "../lib/channels";
import { peso } from "../lib/format";
import { categoriesCol, expensesCol } from "../lib/paths";
import { addExpense, deleteExpense, type ExpenseInput } from "../lib/repo";
import type { Channel } from "../lib/types";

interface Category { id: string; name: string; order: number }
interface Expense extends ExpenseInput { id: string }

export default function QuickAdd() {
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

  return (
    <main className="p-4">
      <h1 className="text-xl font-bold mb-4">Quick Add</h1>
      <div className="bg-white rounded-xl shadow p-4 flex flex-col gap-3">
        <input
          type="number" inputMode="decimal" placeholder="Amount"
          value={amount} onChange={(e) => setAmount(e.target.value)}
          className="text-2xl font-bold tabular-nums border-b border-stone-200 pb-2 outline-none"
        />
        <div className="flex flex-wrap gap-2">
          {cats.map((c) => (
            <button
              key={c.id} onClick={() => setCategory(c.name)}
              className={`text-xs px-3 py-1.5 rounded-full ${
                category === c.name ? "bg-emerald-600 text-white" : "bg-stone-100 text-stone-600"
              }`}
            >{c.name}</button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {CHANNELS.map((c) => (
            <button
              key={c} onClick={() => setChannel(c)}
              className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                channel === c ? channelChipSafe(c) : "bg-stone-100 text-stone-400"
              }`}
            >{c}</button>
          ))}
        </div>
        <input
          placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)}
          className="text-sm border-b border-stone-200 pb-1 outline-none"
        />
        <button
          onClick={() => void save()} disabled={!canSave}
          className="mt-2 bg-emerald-600 disabled:bg-stone-300 text-white font-semibold rounded-lg py-3"
        >Save {value > 0 ? peso(value) : ""}</button>
      </div>

      <h2 className="font-semibold mt-6 mb-2 text-sm text-stone-600">Recent</h2>
      <ul className="flex flex-col gap-1">
        {recent.map((e) => (
          <li key={e.id} className="bg-white rounded-lg px-3 py-2 flex items-center justify-between gap-2">
            <span className="text-sm">{e.category}{e.note ? ` · ${e.note}` : ""}</span>
            <span className="flex items-center gap-2">
              <span className="text-sm font-semibold tabular-nums">{peso(e.amount)}</span>
              <button onClick={() => void deleteExpense(e.id)} className="text-stone-400 text-xs">✕</button>
            </span>
          </li>
        ))}
        {recent.length === 0 && <li className="text-sm text-stone-400 px-3">No expenses logged yet.</li>}
      </ul>
    </main>
  );
}
