import { useState } from "react";
import { CHANNELS } from "../lib/channels";
import { addMonthIncome, addMonthLine } from "../lib/repo";
import type { Channel } from "../lib/types";

export default function AddOneOff({ monthKey, onClose }: { monthKey: string; onClose: () => void }) {
  const [kind, setKind] = useState<"expense" | "income">("expense");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [channel, setChannel] = useState<Channel>("CASH");
  const [cutoff, setCutoff] = useState<1 | 2>(2);
  const [day, setDay] = useState("28");
  const amt = Number(amount);
  const valid = name.trim() !== "" && amt > 0;

  async function save() {
    if (!valid) return;
    if (kind === "expense") {
      await addMonthLine(monthKey, { name: name.trim(), amount: amt, channel, cutoff, order: 900, oneOff: true, status: "" });
    } else {
      await addMonthIncome(monthKey, { name: name.trim(), amount: amt, day: Number(day) || 1, cutoff });
    }
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xs p-5 flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-bold">Add one-off</h3>
        <div className="flex gap-2">
          {(["expense", "income"] as const).map((k) => (
            <button key={k} onClick={() => setKind(k)}
              className={`flex-1 py-1.5 rounded-lg text-sm font-semibold ${kind === k ? "bg-emerald-600 text-white" : "bg-stone-100 text-stone-500"}`}>
              {k === "expense" ? "Expense" : "Income"}
            </button>
          ))}
        </div>
        <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} className="text-sm border-b border-stone-300 outline-none pb-1" />
        <label className="flex items-center justify-between text-sm">Amount
          <input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-28 text-right border-b border-stone-300 outline-none tabular-nums" />
        </label>
        <label className="flex items-center justify-between text-sm">Cutoff
          <select value={cutoff} onChange={(e) => setCutoff(Number(e.target.value) as 1 | 2)} className="text-sm border-b border-stone-300 outline-none">
            <option value={1}>1</option><option value={2}>2</option>
          </select>
        </label>
        {kind === "expense" ? (
          <label className="flex items-center justify-between text-sm">Channel
            <select value={channel} onChange={(e) => setChannel(e.target.value as Channel)} className="text-sm border-b border-stone-300 outline-none">
              {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
        ) : (
          <label className="flex items-center justify-between text-sm">Day (1–31)
            <input type="number" value={day} onChange={(e) => setDay(e.target.value)} className="w-20 text-right border-b border-stone-300 outline-none tabular-nums" />
          </label>
        )}
        <div className="flex gap-2 mt-1">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg text-sm text-stone-500 bg-stone-100">Cancel</button>
          <button onClick={() => void save()} disabled={!valid} className="flex-1 py-2 rounded-lg text-sm font-semibold text-white bg-emerald-600 disabled:opacity-40">Add</button>
        </div>
      </div>
    </div>
  );
}
