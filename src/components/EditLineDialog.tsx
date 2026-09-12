import { useState } from "react";
import { useCollection } from "../hooks/useCollection";
import { debtsCol } from "../lib/paths";
import { updateMonthLine } from "../lib/repo";
import type { Channel, Debt, DebtSplit, MonthLine } from "../lib/types";
import { useAccounts } from "./AccountsProvider";
import DebtSplitsEditor from "./DebtSplitsEditor";

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
  const [debtSplits, setDebtSplits] = useState<DebtSplit[] | undefined>(line.debtSplits);
  const ticked = line.status !== "";
  const hadDebtId = !!line.debtId;
  const hadDebtSplits = !!line.debtSplits?.length;
  const amt = Number(amount);
  const valid = name.trim() !== "" && amt >= 0;

  async function save() {
    if (!valid) return;
    // A budget group implies the line is a budget line — no separate toggle needed.
    const group = budgetGroup.trim();
    // Clearing a previously-set link must remove the field (deleteField):
    // not send undefined (Firestore rejects literal undefined). While ticked,
    // the picker is locked, so neither field is sent, exactly as before.
    const splitting = !!debtSplits && debtSplits.length > 0;
    await updateMonthLine(monthKey, line.id, {
      name: name.trim(), amount: amt, channel,
      isEnvelope: isEnvelope || group !== "", budgetGroup: group,
      debtId: ticked ? undefined : (splitting ? null : (debtId || (hadDebtId ? null : undefined))),
      debtSplits: ticked ? undefined : (splitting ? debtSplits : (hadDebtSplits ? null : undefined)),
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
        {/* A ticked line has already logged its payment(s) under the current
            debt(s); re-linking it would orphan them, so require an untick first. */}
        <DebtSplitsEditor
          debts={debts} amount={amt} debtId={debtId} debtSplits={debtSplits} disabled={ticked}
          onChange={(v) => { setDebtId(v.debtId ?? ""); setDebtSplits(v.debtSplits); }}
        />
        <p className="text-[11px] text-stone-400">Changes apply to {monthKey} only — the template stays as-is.</p>
        <div className="flex gap-2 mt-1">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg text-sm text-stone-500 bg-stone-100">Cancel</button>
          <button onClick={() => void save()} disabled={!valid} className="flex-1 py-2 rounded-lg text-sm font-semibold text-white bg-emerald-600 disabled:opacity-40">Save</button>
        </div>
      </div>
    </div>
  );
}
