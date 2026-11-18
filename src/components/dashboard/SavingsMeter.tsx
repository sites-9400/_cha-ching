import { useState } from "react";
import { peso } from "../../lib/format";
import { CloseIcon } from "../icons";

/** Savings balance against the ₱ floor — a single value vs a threshold. */
export default function SavingsMeter({
  balance, floor, onSave, onAdd,
}: { balance: number; floor: number; onSave: (v: number) => void | Promise<void>; onAdd: () => void }) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState(String(balance));

  const below = balance < floor;
  const scaleMax = Math.max(balance, floor) * 1.15 || 1;
  const fillPct = Math.min(100, (balance / scaleMax) * 100);
  const floorPct = Math.min(100, (floor / scaleMax) * 100);

  async function save() {
    const v = Number(raw);
    if (v >= 0) await onSave(v);
    setEditing(false);
  }

  return (
    <section className="bg-manila rounded-xl border border-rule shadow-card p-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-display font-bold text-[20px] leading-6 text-ink">Savings</h2>
        {editing ? (
          <span className="flex items-center gap-1">
            <input
              type="number" inputMode="decimal" autoFocus value={raw}
              onChange={(e) => setRaw(e.target.value)}
              className="w-28 text-right text-sm border-b border-stone-300 outline-none tabular-nums"
            />
            <button onClick={() => void save()} className="text-xs font-semibold text-ink underline underline-offset-2 px-1">Save</button>
            <button onClick={() => { setEditing(false); setRaw(String(balance)); }} aria-label="Cancel edit" className="text-stone-500 px-1"><CloseIcon /></button>
          </span>
        ) : (
          <button onClick={() => { setEditing(true); setRaw(String(balance)); }} className="text-sm font-bold tabular-nums">
            {peso(balance)} <span className="text-xs font-semibold text-ink underline underline-offset-2">edit</span>
          </button>
        )}
      </div>
      <div className="relative h-4 rounded-full bg-stone-100 overflow-hidden">
        <div className={`h-full ${below ? "bg-marker-red" : "bg-ink"}`} style={{ width: `${fillPct}%` }} />
        {/* floor threshold marker */}
        <div className="absolute top-0 bottom-0 w-0.5 bg-red-600" style={{ left: `${floorPct}%` }} />
      </div>
      <p className={`mt-2 text-xs ${below ? "text-red-600 font-semibold" : "text-stone-400"}`}>
        {below
          ? `Below floor by ${peso(floor - balance)}`
          : `${peso(balance - floor)} above the ${peso(floor)} floor`}
      </p>
      <button onClick={onAdd} className="mt-3 text-sm font-semibold text-ink underline underline-offset-2">+ Add to savings</button>
    </section>
  );
}
