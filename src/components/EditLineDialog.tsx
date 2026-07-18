import { useState } from "react";
import { updateMonthLine } from "../lib/repo";
import type { Channel, MonthLine } from "../lib/types";
import { useAccounts } from "./AccountsProvider";

/** Inline-edit a single month line (name / amount / channel) for this month only. */
export default function EditLineDialog(
  { monthKey, line, onClose }: { monthKey: string; line: MonthLine; onClose: () => void },
) {
  const { names } = useAccounts();
  const [name, setName] = useState(line.name);
  const [amount, setAmount] = useState(String(line.amount));
  const [channel, setChannel] = useState<Channel>(line.channel);
  const [isEnvelope, setIsEnvelope] = useState(!!line.isEnvelope);
  const [budgetGroup, setBudgetGroup] = useState(line.budgetGroup ?? "");
  const amt = Number(amount);
  const valid = name.trim() !== "" && amt >= 0;

  async function save() {
    if (!valid) return;
    await updateMonthLine(monthKey, line.id, {
      name: name.trim(), amount: amt, channel, isEnvelope,
      budgetGroup: isEnvelope ? budgetGroup.trim() : "",
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
        {isEnvelope && (
          <label className="flex items-center justify-between text-sm gap-2">Budget group
            <input
              placeholder="e.g. Allowance" value={budgetGroup}
              onChange={(e) => setBudgetGroup(e.target.value)}
              className="w-32 text-right border-b border-stone-300 outline-none"
            />
          </label>
        )}
        <p className="text-[11px] text-stone-400">Changes apply to {monthKey} only — the template stays as-is.</p>
        <div className="flex gap-2 mt-1">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg text-sm text-stone-500 bg-stone-100">Cancel</button>
          <button onClick={() => void save()} disabled={!valid} className="flex-1 py-2 rounded-lg text-sm font-semibold text-white bg-emerald-600 disabled:opacity-40">Save</button>
        </div>
      </div>
    </div>
  );
}
