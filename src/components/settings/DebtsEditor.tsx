import { useState } from "react";
import { useCollection } from "../../hooks/useCollection";
import { useAccounts } from "../AccountsProvider";
import { peso } from "../../lib/format";
import { debtsCol } from "../../lib/paths";
import { addDebt, updateDebt, deleteDebt } from "../../lib/repo";
import { adjacentSwap } from "../../lib/reorder";
import type { Channel, Debt } from "../../lib/types";
import ConfirmDialog from "../ConfirmDialog";
import { ChevronDownIcon, ChevronUpIcon, CloseIcon } from "../icons";

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
            <span className="flex">
              <button onClick={() => void move(i, -1)} disabled={i === 0} className="text-ink-2 disabled:opacity-20 leading-none inline-flex items-center justify-center min-h-11 min-w-11" aria-label="Move up"><ChevronUpIcon className="h-3.5 w-3.5" /></button>
              <button onClick={() => void move(i, 1)} disabled={i === sorted.length - 1} className="text-ink-2 disabled:opacity-20 leading-none inline-flex items-center justify-center min-h-11 min-w-11" aria-label="Move down"><ChevronDownIcon className="h-3.5 w-3.5" /></button>
            </span>
            <button onClick={() => setEditing(d)} className="flex-1 min-h-11 flex items-center justify-between min-w-0">
              <span className="truncate text-sm font-medium">{d.name}{d.isBNPL ? " · BNPL" : ""}{d.active ? "" : " · archived"}</span>
              <span className="text-sm tabular-nums">{peso(d.currentBalance)}</span>
            </button>
            <button onClick={() => setConfirmId(d.id)} aria-label="Remove" className="text-marker-red-text inline-flex items-center justify-center min-h-11 min-w-11"><CloseIcon /></button>
          </li>
        ))}
      </ul>
      <button onClick={() => setEditing({ ...BLANK })} className="mt-1 text-sm font-semibold text-ink underline underline-offset-2 inline-flex items-center min-h-11 px-2 -mx-2">+ Add debt</button>
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
    // Cleared number fields hold `undefined`, which Firestore rejects — drop them.
    const clean = Object.fromEntries(Object.entries(f).filter(([, v]) => v !== undefined)) as typeof f;
    if (id) await updateDebt(id, clean);
    else await addDebt(clean);
    onDone();
  }

  // Plain helper that RETURNS JSX (not a nested component) — a nested component
  // would get a new identity each render and remount the input, losing focus.
  const numberField = (label: string, k: "startingBalance" | "currentBalance" | "payoffOrder" | "dueDay" | "statementDay" | "minimum" | "creditLimit") => (
    <label className="flex items-center justify-between text-sm min-h-11">
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
      <input aria-label="Name" placeholder="Name" value={f.name} onChange={(e) => set("name", e.target.value)}
        className="text-sm border-b border-stone-300 outline-none pb-1" />
      {numberField("Starting balance", "startingBalance")}
      {numberField("Current balance", "currentBalance")}
      {numberField("Payoff order", "payoffOrder")}
      {numberField("Due day (1–31)", "dueDay")}
      {numberField("Statement day (1–31)", "statementDay")}
      {numberField("Minimum", "minimum")}
      {numberField("Credit limit", "creditLimit")}
      <label className="flex items-center justify-between text-sm min-h-11">
        Channel
        <select value={f.channel} onChange={(e) => set("channel", e.target.value as Channel)} className="text-sm min-h-11 border-b border-stone-300 outline-none">
          {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>
      <label className="flex items-center justify-between text-sm min-h-11">Installment plan
        <input type="checkbox" checked={f.isBNPL} onChange={(e) => set("isBNPL", e.target.checked)} />
      </label>
      <label className="flex items-center justify-between text-sm min-h-11">Active
        <input type="checkbox" checked={f.active} onChange={(e) => set("active", e.target.checked)} />
      </label>
      <div className="flex gap-2 mt-2">
        <button onClick={onDone} className="flex-1 min-h-11 rounded-lg text-sm text-stone-500 bg-stone-100">Cancel</button>
        <button onClick={() => void save()} disabled={!f.name.trim()}
          className="flex-1 min-h-11 rounded-lg text-sm font-semibold text-white bg-emerald-600 disabled:opacity-40">Save</button>
      </div>
    </div>
  );
}
