import { useState } from "react";
import { useCollection } from "../hooks/useCollection";
import { debtsCol } from "../lib/paths";
import { updateMonthLine } from "../lib/repo";
import type { Channel, Debt, MonthLine } from "../lib/types";
import { useAccounts } from "./AccountsProvider";

/** Inline-edit a single month line (name / amount / channel / pays-debt) for this month only. */
export default function EditLineDialog(
  { monthKey, line, onClose }: { monthKey: string; line: MonthLine; onClose: () => void },
) {
  const { names } = useAccounts();
  const debts = useCollection<Debt>(debtsCol());
  const [name, setName] = useState(line.name);
  const [amount, setAmount] = useState(String(line.amount));
  const [channel, setChannel] = useState<Channel>(line.channel);
  const [isEnvelope, setIsEnvelope] = useState(!!line.isEnvelope);
  const [budgetGroup, setBudgetGroup] = useState(line.budgetGroup ?? "");
  const [debtId, setDebtId] = useState(line.debtId ?? "");
  const ticked = line.status !== "";
  const amt = Number(amount);
  const valid = name.trim() !== "" && amt >= 0;

  async function save() {
    if (!valid) return;
    // A budget group implies the line is a budget line — no separate toggle needed.
    const group = budgetGroup.trim();
    // Clearing a previously-set link must remove the field (deleteField):
    // not send undefined (Firestore rejects literal undefined).
    await updateMonthLine(monthKey, line.id, {
      name: name.trim(), amount: amt, channel,
      isEnvelope: isEnvelope || group !== "", budgetGroup: group,
      debtId: ticked ? undefined : (debtId || (line.debtId ? null : undefined)),
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xs p-5 flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-bold">Edit line · this month</h3>
        <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)}
          className="text-sm border-b border-stone-300 outline-none pb-1" />
        <label className="flex items-center justify-between text-sm">Amount
          <input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)}
            className="w-28 text-right border-b border-stone-300 outline-none tabular-nums" />
        </label>
        <label className="flex items-center justify-between text-sm">Channel
          <select value={channel} onChange={(e) => setChannel(e.target.value)} className="text-sm border-b border-stone-300 outline-none">
            {names.map((c) => <option key={String(c)} value={String(c)}>{c}</option>)}
          </select>
        </label>
        <label className="flex items-center justify-between text-sm">Budget
          <input type="checkbox" checked={isEnvelope} onChange={(e) => setIsEnvelope(e.target.checked)} />
        </label>
        <label className="flex items-center justify-between text-sm gap-2">Budget group
          <input
            placeholder="e.g. Allowance" value={budgetGroup}
            onChange={(e) => setBudgetGroup(e.target.value)}
            className="w-32 text-right border-b border-stone-300 outline-none"
          />
        </label>
        <label className="flex items-center justify-between text-sm gap-2">
          <span className="shrink-0">Pays debt</span>
          {/* A ticked line has already logged its payment under the current debt;
              re-linking it would orphan that payment, so require an untick first. */}
          <select value={debtId} disabled={ticked} onChange={(e) => setDebtId(e.target.value)} className="text-sm border-b border-stone-300 outline-none min-w-0 flex-1 text-right disabled:opacity-40">
            <option value="">— none —</option>
            {[...debts].filter((d) => d.active).sort((a, b) => a.payoffOrder - b.payoffOrder).map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </label>
        <p className="text-[11px] text-stone-400 -mt-1">
          {ticked ? "Untick the line first to change which debt it pays." : "Ticking this line PAID logs a payment to that debt."}
        </p>
        <p className="text-[11px] text-stone-400">Changes apply to {monthKey} only — the template stays as-is.</p>
        <div className="flex gap-2 mt-1">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg text-sm text-stone-500 bg-stone-100">Cancel</button>
          <button onClick={() => void save()} disabled={!valid} className="flex-1 py-2 rounded-lg text-sm font-semibold text-white bg-emerald-600 disabled:opacity-40">Save</button>
        </div>
      </div>
    </div>
  );
}
