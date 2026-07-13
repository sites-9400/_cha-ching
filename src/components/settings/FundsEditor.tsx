import { useState } from "react";
import { useCollection } from "../../hooks/useCollection";
import { peso } from "../../lib/format";
import { fundsCol } from "../../lib/paths";
import { addFund, updateFund, deleteFund } from "../../lib/repo";
import type { SinkingFund } from "../../lib/types";
import ConfirmDialog from "../ConfirmDialog";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const BLANK: Omit<SinkingFund, "id"> = { name: "", monthlyDeposit: 0, releaseMonths: [], balance: 0 };

export default function FundsEditor() {
  const funds = useCollection<SinkingFund>(fundsCol());
  const [editing, setEditing] = useState<SinkingFund | Omit<SinkingFund, "id"> | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  if (editing) return <Form fund={editing} onDone={() => setEditing(null)} />;

  return (
    <div>
      <h2 className="font-bold text-lg mb-3">Sinking funds</h2>
      <ul className="flex flex-col gap-2">
        {funds.map((fund) => (
          <li key={fund.id} className="bg-white rounded-xl shadow p-3 flex items-center gap-2">
            <button onClick={() => setEditing(fund)} className="flex-1 flex items-center justify-between min-w-0">
              <span className="truncate text-sm">{fund.name}</span>
              <span className="text-sm tabular-nums">{peso(fund.monthlyDeposit)}/mo</span>
            </button>
            <button onClick={() => setConfirmId(fund.id)} className="text-red-500 text-xs px-1">✕</button>
          </li>
        ))}
      </ul>
      <button onClick={() => setEditing({ ...BLANK })} className="mt-3 text-sm font-semibold text-emerald-700">+ Add fund</button>
      {confirmId && (
        <ConfirmDialog title="Delete sinking fund?" message="Its schedule and balance are removed."
          onConfirm={async () => { await deleteFund(confirmId); setConfirmId(null); }}
          onCancel={() => setConfirmId(null)} />
      )}
    </div>
  );
}

function Form({ fund, onDone }: { fund: SinkingFund | Omit<SinkingFund, "id">; onDone: () => void }) {
  const [f, setF] = useState(fund);
  const id = "id" in fund ? fund.id : null;
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF({ ...f, [k]: v });
  const toggleMonth = (m: number) =>
    set("releaseMonths", f.releaseMonths.includes(m) ? f.releaseMonths.filter((x) => x !== m) : [...f.releaseMonths, m].sort((a, b) => a - b));

  async function save() {
    if (!f.name.trim()) return;
    if (id) await updateFund(id, f); else await addFund(f);
    onDone();
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-bold text-lg">{id ? "Edit fund" : "Add fund"}</h2>
      <input placeholder="Name" value={f.name} onChange={(e) => set("name", e.target.value)} className="text-sm border-b border-stone-300 outline-none pb-1" />
      <label className="flex items-center justify-between text-sm">Monthly deposit
        <input type="number" inputMode="decimal" value={f.monthlyDeposit || ""} onChange={(e) => set("monthlyDeposit", Number(e.target.value))} className="w-28 text-right border-b border-stone-300 outline-none tabular-nums" />
      </label>
      <label className="flex items-center justify-between text-sm">Balance
        <input type="number" inputMode="decimal" value={f.balance || ""} onChange={(e) => set("balance", Number(e.target.value))} className="w-28 text-right border-b border-stone-300 outline-none tabular-nums" />
      </label>
      <div>
        <p className="text-sm mb-1">Release months</p>
        <div className="flex flex-wrap gap-1">
          {MONTHS.map((label, i) => {
            const m = i + 1;
            const on = f.releaseMonths.includes(m);
            return (
              <button key={m} onClick={() => toggleMonth(m)}
                className={`text-xs px-2 py-1 rounded-full ${on ? "bg-emerald-600 text-white" : "bg-stone-100 text-stone-500"}`}>
                {label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex gap-2 mt-2">
        <button onClick={onDone} className="flex-1 py-2 rounded-lg text-sm text-stone-500 bg-stone-100">Cancel</button>
        <button onClick={() => void save()} disabled={!f.name.trim()} className="flex-1 py-2 rounded-lg text-sm font-semibold text-white bg-emerald-600 disabled:opacity-40">Save</button>
      </div>
    </div>
  );
}
