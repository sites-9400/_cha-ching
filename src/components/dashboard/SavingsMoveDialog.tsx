import { useState } from "react";
import { localIso } from "../../lib/clock";
import { addSavingsMove } from "../../lib/repo";

export default function SavingsMoveDialog({ onClose }: { onClose: () => void }) {
  const [direction, setDirection] = useState<"in" | "out">("in");
  const [amount, setAmount] = useState("");
  const [source, setSource] = useState("");
  const [date, setDate] = useState(localIso().slice(0, 10));
  const amt = Number(amount);
  const valid = amt > 0 && source.trim() !== "";

  async function save() {
    if (!valid) return;
    await addSavingsMove({
      amount: amt, direction, source: source.trim(),
      date: `${date}T12:00:00`,
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-manila rounded-xl border border-rule shadow-card w-full max-w-xs p-5 flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-bold">Savings</h3>
        <div className="flex gap-2">
          {([["in", "Add"], ["out", "Withdraw"]] as const).map(([d, lbl]) => (
            <button key={d} onClick={() => setDirection(d)}
              className={`flex-1 min-h-11 rounded-lg text-sm font-semibold ${direction === d ? "bg-ink text-manila" : "bg-stone-100 text-stone-500"}`}>
              {lbl}
            </button>
          ))}
        </div>
        <label className="flex items-center justify-between text-sm min-h-11">Amount
          <input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-28 text-right min-h-11 border-b border-stone-300 outline-none tabular-nums" />
        </label>
        <input aria-label="Source (e.g. Side gig)" placeholder="Source (e.g. Side gig)" value={source} onChange={(e) => setSource(e.target.value)} className="text-sm min-h-11 border-b border-stone-300 outline-none pb-1" />
        <label className="flex items-center justify-between text-sm min-h-11">Date
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="text-sm min-h-11 border-b border-stone-300 outline-none" />
        </label>
        <div className="flex gap-2 mt-1">
          <button onClick={onClose} className="flex-1 min-h-11 rounded-lg text-sm text-stone-500 bg-stone-100">Cancel</button>
          <button onClick={() => void save()} disabled={!valid} className="flex-1 min-h-11 rounded-lg text-sm font-semibold text-manila bg-ink disabled:opacity-40">Save</button>
        </div>
      </div>
    </div>
  );
}
