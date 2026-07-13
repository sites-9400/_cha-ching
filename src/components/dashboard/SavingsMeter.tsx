import { useState } from "react";
import { peso } from "../../lib/format";

/** Savings balance against the ₱ floor — a single value vs a threshold. */
export default function SavingsMeter({
  balance, floor, onSave,
}: { balance: number; floor: number; onSave: (v: number) => void | Promise<void> }) {
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
    <section className="bg-white rounded-xl shadow p-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-semibold text-sm">Savings</h2>
        {editing ? (
          <span className="flex items-center gap-1">
            <input
              type="number" inputMode="decimal" autoFocus value={raw}
              onChange={(e) => setRaw(e.target.value)}
              className="w-28 text-right text-sm border-b border-stone-300 outline-none tabular-nums"
            />
            <button onClick={() => void save()} className="text-xs font-semibold text-emerald-700 px-1">Save</button>
            <button onClick={() => { setEditing(false); setRaw(String(balance)); }} className="text-xs text-stone-400">✕</button>
          </span>
        ) : (
          <button onClick={() => { setEditing(true); setRaw(String(balance)); }} className="text-sm font-bold tabular-nums">
            {peso(balance)} <span className="text-xs font-normal text-emerald-700">edit</span>
          </button>
        )}
      </div>
      <div className="relative h-4 rounded-full bg-stone-100 overflow-hidden">
        <div className={`h-full ${below ? "bg-red-500" : "bg-emerald-500"}`} style={{ width: `${fillPct}%` }} />
        {/* floor threshold marker */}
        <div className="absolute top-0 bottom-0 w-0.5 bg-red-600" style={{ left: `${floorPct}%` }} />
      </div>
      <p className={`mt-2 text-xs ${below ? "text-red-600 font-semibold" : "text-stone-400"}`}>
        {below
          ? `Below floor by ${peso(floor - balance)}`
          : `${peso(balance - floor)} above the ${peso(floor)} floor`}
      </p>
    </section>
  );
}
