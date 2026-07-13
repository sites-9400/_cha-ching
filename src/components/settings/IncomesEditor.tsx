import { useState } from "react";
import { useCollection } from "../../hooks/useCollection";
import { peso } from "../../lib/format";
import { templateIncomes } from "../../lib/paths";
import { addTemplateIncome, updateTemplateIncome, deleteTemplateIncome } from "../../lib/repo";
import type { Income } from "../../lib/types";
import ConfirmDialog from "../ConfirmDialog";

const BLANK: Omit<Income, "id"> = { name: "", amount: 0, day: 13, cutoff: 1 };

export default function IncomesEditor() {
  const incomes = useCollection<Income>(templateIncomes());
  const sorted = [...incomes].sort((a, b) => (a.cutoff - b.cutoff) || (a.day - b.day));
  const [editing, setEditing] = useState<Income | Omit<Income, "id"> | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  if (editing) return <Form income={editing} onDone={() => setEditing(null)} />;

  return (
    <div>
      <h2 className="font-bold text-lg mb-3">Income sources</h2>
      <ul className="flex flex-col gap-2">
        {sorted.map((i) => (
          <li key={i.id} className="bg-white rounded-xl shadow p-3 flex items-center gap-2">
            <button onClick={() => setEditing(i)} className="flex-1 flex items-center justify-between min-w-0">
              <span className="truncate text-sm">C{i.cutoff} · day {i.day} · {i.name}</span>
              <span className="text-sm tabular-nums">{peso(i.amount)}</span>
            </button>
            <button onClick={() => setConfirmId(i.id)} className="text-red-500 text-xs px-1">✕</button>
          </li>
        ))}
      </ul>
      <button onClick={() => setEditing({ ...BLANK })} className="mt-3 text-sm font-semibold text-emerald-700">+ Add income</button>
      {confirmId && (
        <ConfirmDialog title="Delete income source?" message="Removed from future months."
          onConfirm={async () => { await deleteTemplateIncome(confirmId); setConfirmId(null); }}
          onCancel={() => setConfirmId(null)} />
      )}
    </div>
  );
}

function Form({ income, onDone }: { income: Income | Omit<Income, "id">; onDone: () => void }) {
  const [f, setF] = useState(income);
  const id = "id" in income ? income.id : null;
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF({ ...f, [k]: v });

  async function save() {
    if (!f.name.trim()) return;
    if (id) await updateTemplateIncome(id, f); else await addTemplateIncome(f);
    onDone();
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-bold text-lg">{id ? "Edit income" : "Add income"}</h2>
      <input placeholder="Name" value={f.name} onChange={(e) => set("name", e.target.value)} className="text-sm border-b border-stone-300 outline-none pb-1" />
      <label className="flex items-center justify-between text-sm">Amount
        <input type="number" inputMode="decimal" value={f.amount || ""} onChange={(e) => set("amount", Number(e.target.value))} className="w-28 text-right border-b border-stone-300 outline-none tabular-nums" />
      </label>
      <label className="flex items-center justify-between text-sm">Day (1–31)
        <input type="number" value={f.day} onChange={(e) => set("day", Number(e.target.value))} className="w-20 text-right border-b border-stone-300 outline-none tabular-nums" />
      </label>
      <label className="flex items-center justify-between text-sm">Cutoff
        <select value={f.cutoff} onChange={(e) => set("cutoff", Number(e.target.value) as 1 | 2)} className="text-sm border-b border-stone-300 outline-none">
          <option value={1}>1</option><option value={2}>2</option>
        </select>
      </label>
      <div className="flex gap-2 mt-2">
        <button onClick={onDone} className="flex-1 py-2 rounded-lg text-sm text-stone-500 bg-stone-100">Cancel</button>
        <button onClick={() => void save()} disabled={!f.name.trim()} className="flex-1 py-2 rounded-lg text-sm font-semibold text-white bg-emerald-600 disabled:opacity-40">Save</button>
      </div>
    </div>
  );
}
