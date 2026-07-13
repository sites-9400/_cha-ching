import { useState } from "react";
import { useCollection } from "../../hooks/useCollection";
import { useAccounts } from "../AccountsProvider";
import { peso } from "../../lib/format";
import { debtsCol } from "../../lib/paths";
import { addDebt, updateDebt, deleteDebt } from "../../lib/repo";
import { adjacentSwap } from "../../lib/reorder";
import type { Channel, Debt } from "../../lib/types";
import ConfirmDialog from "../ConfirmDialog";

const BLANK: Omit<Debt, "id"> = {
  name: "", startingBalance: 0, currentBalance: 0, payoffOrder: 99,
  channel: "RCBC", isBNPL: false, active: true,
};

export default function DebtsEditor() {
  const debts = useCollection<Debt>(debtsCol());
  const sorted = [...debts].sort((a, b) => a.payoffOrder - b.payoffOrder);
  const [editing, setEditing] = useState<Debt | Omit<Debt, "id"> | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  async function move(index: number, dir: -1 | 1) {
    const pair = adjacentSwap(sorted, index, dir, "payoffOrder");
    if (!pair) return;
    await Promise.all(pair.map((p) => updateDebt(p.id, { payoffOrder: p.payoffOrder })));
  }

  if (editing) return <DebtForm debt={editing} onDone={() => setEditing(null)} />;

  return (
    <div>
      <h2 className="font-bold text-lg mb-3">Debts</h2>
      <ul className="flex flex-col gap-2">
        {sorted.map((d, i) => (
          <li key={d.id} className="bg-white rounded-xl shadow p-3 flex items-center gap-2">
            <span className="flex flex-col">
              <button onClick={() => void move(i, -1)} disabled={i === 0} className="text-stone-400 disabled:opacity-20 leading-none">▲</button>
              <button onClick={() => void move(i, 1)} disabled={i === sorted.length - 1} className="text-stone-400 disabled:opacity-20 leading-none">▼</button>
            </span>
            <button onClick={() => setEditing(d)} className="flex-1 flex items-center justify-between min-w-0">
              <span className="truncate text-sm font-medium">{d.name}{d.isBNPL ? " · BNPL" : ""}{d.active ? "" : " · archived"}</span>
              <span className="text-sm tabular-nums">{peso(d.currentBalance)}</span>
            </button>
            <button onClick={() => setConfirmId(d.id)} className="text-red-500 text-xs px-1">✕</button>
          </li>
        ))}
      </ul>
      <button onClick={() => setEditing({ ...BLANK })} className="mt-3 text-sm font-semibold text-emerald-700">+ Add debt</button>
      {confirmId && (
        <ConfirmDialog
          title="Delete debt?"
          message="This permanently removes the debt and its payment history."
          onConfirm={async () => { await deleteDebt(confirmId); setConfirmId(null); }}
          onCancel={() => setConfirmId(null)}
        />
      )}
    </div>
  );
}

function DebtForm({ debt, onDone }: { debt: Debt | Omit<Debt, "id">; onDone: () => void }) {
  const { names: CHANNELS } = useAccounts();
  const [f, setF] = useState(debt);
  const id = "id" in debt ? debt.id : null;
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF({ ...f, [k]: v });
  const num = (s: string) => (s === "" ? 0 : Number(s));

  async function save() {
    if (!f.name.trim()) return;
    if (id) await updateDebt(id, f);
    else await addDebt(f);
    onDone();
  }

  // Plain helper that RETURNS JSX (not a nested component) — a nested component
  // would get a new identity each render and remount the input, losing focus.
  const numberField = (label: string, k: "startingBalance" | "currentBalance" | "payoffOrder" | "dueDay" | "minimum") => (
    <label className="flex items-center justify-between text-sm">
      {label}
      <input
        type="number" inputMode="decimal"
        value={(f[k] as number | undefined) ?? ""}
        onChange={(e) => set(k, (e.target.value === "" ? undefined : num(e.target.value)) as never)}
        className="w-28 text-right border-b border-stone-300 outline-none tabular-nums"
      />
    </label>
  );

  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-bold text-lg">{id ? "Edit debt" : "Add debt"}</h2>
      <input placeholder="Name" value={f.name} onChange={(e) => set("name", e.target.value)}
        className="text-sm border-b border-stone-300 outline-none pb-1" />
      {numberField("Starting balance", "startingBalance")}
      {numberField("Current balance", "currentBalance")}
      {numberField("Payoff order", "payoffOrder")}
      {numberField("Due day (1–31)", "dueDay")}
      {numberField("Minimum", "minimum")}
      <label className="flex items-center justify-between text-sm">
        Channel
        <select value={f.channel} onChange={(e) => set("channel", e.target.value as Channel)} className="text-sm border-b border-stone-300 outline-none">
          {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>
      <label className="flex items-center justify-between text-sm">0% BNPL
        <input type="checkbox" checked={f.isBNPL} onChange={(e) => set("isBNPL", e.target.checked)} />
      </label>
      <label className="flex items-center justify-between text-sm">Active
        <input type="checkbox" checked={f.active} onChange={(e) => set("active", e.target.checked)} />
      </label>
      <div className="flex gap-2 mt-2">
        <button onClick={onDone} className="flex-1 py-2 rounded-lg text-sm text-stone-500 bg-stone-100">Cancel</button>
        <button onClick={() => void save()} disabled={!f.name.trim()}
          className="flex-1 py-2 rounded-lg text-sm font-semibold text-white bg-emerald-600 disabled:opacity-40">Save</button>
      </div>
    </div>
  );
}
