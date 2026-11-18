import { useState } from "react";
import { useCollection } from "../hooks/useCollection";
import { debtsCol } from "../lib/paths";
import { resolveGroup } from "../lib/lineGroups";
import { setLineGroup, updateMonthLine } from "../lib/repo";
import type { Channel, Debt, DebtSplit, LineGroup, MonthLine } from "../lib/types";
import { useAccounts } from "./AccountsProvider";
import DebtSplitsEditor from "./DebtSplitsEditor";
import GroupChips from "./GroupChips";

/** Inline-edit a single month line (name / amount / channel / pays-debt) for this month only. */
export default function EditLineDialog(
  { monthKey, line, onClose, onRemove }:
  { monthKey: string; line: MonthLine; onClose: () => void; onRemove?: () => void },
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
  const [lineGroup, setLineGroupState] = useState<LineGroup | undefined>(line.group);
  const ticked = line.status !== "";
  const hadDebtId = !!line.debtId;
  const hadDebtSplits = !!line.debtSplits?.length;
  const amt = Number(amount);
  const debtLinked = !!debtId || !!debtSplits?.length;
  const shownGroup = resolveGroup({ name, debtId: debtId || undefined, debtSplits, group: lineGroup, isEnvelope, budgetGroup });
  const valid = name.trim() !== "" && amt >= 0;

  async function save() {
    if (!valid) return;
    // A budget group implies the line is a budget line — no separate toggle needed.
    const group = budgetGroup.trim();
    // Clearing a previously-set link must remove the field (deleteField):
    // not send undefined (Firestore rejects literal undefined). While ticked,
    // the picker is locked, so neither field is sent, exactly as before.
    const splitting = !!debtSplits && debtSplits.length > 0;
    const groupChanged = !debtLinked && lineGroup !== undefined && lineGroup !== line.group;
    const otherChanged =
      name.trim() !== line.name || amt !== line.amount || channel !== line.channel
      || (isEnvelope || group !== "") !== !!line.isEnvelope || group !== (line.budgetGroup ?? "")
      || (!ticked && ((debtId || undefined) !== line.debtId
        || JSON.stringify(debtSplits ?? null) !== JSON.stringify(line.debtSplits ?? null)));
    // A group-only change is metadata: it must not mark the line overridden.
    if (otherChanged || !groupChanged) {
      await updateMonthLine(monthKey, line.id, {
        name: name.trim(), amount: amt, channel,
        isEnvelope: isEnvelope || group !== "", budgetGroup: group,
        debtId: ticked ? undefined : (splitting ? null : (debtId || (hadDebtId ? null : undefined))),
        debtSplits: ticked ? undefined : (splitting ? debtSplits : (hadDebtSplits ? null : undefined)),
      });
    }
    if (groupChanged) await setLineGroup(monthKey, line.id, lineGroup!);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-manila rounded-xl border border-rule shadow-card w-full max-w-xs p-5 flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-bold">Edit line · this month</h3>
        <input aria-label="Name" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)}
          className="text-sm border-b border-stone-300 outline-none pb-1" />
        <label className="flex items-center justify-between text-sm min-h-11">Amount
          <input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)}
            className="w-28 text-right border-b border-stone-300 outline-none tabular-nums" />
        </label>
        <label className="flex items-center justify-between text-sm min-h-11">Channel
          <select value={channel} onChange={(e) => setChannel(e.target.value)} className="text-sm min-h-11 border-b border-stone-300 outline-none">
            {names.map((c) => <option key={String(c)} value={String(c)}>{c}</option>)}
          </select>
        </label>
        <label className="flex items-center justify-between text-sm min-h-11">Budget
          <input type="checkbox" checked={isEnvelope} onChange={(e) => setIsEnvelope(e.target.checked)} />
        </label>
        <label className="flex items-center justify-between text-sm min-h-11 gap-2">Budget group
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
        <div className="flex flex-col gap-1">
          <span className="text-sm">Group</span>
          <GroupChips value={shownGroup} disabled={debtLinked} onChange={(g) => setLineGroupState(g)} />
          {debtLinked && <p className="text-xs text-ink-2">Card and loan payments always count as Cards &amp; debts.</p>}
        </div>
        <p className="text-xs text-ink-2">Changes apply to {monthKey} only — the template stays as-is.</p>
        {onRemove && (
          <button
            type="button"
            onClick={() => { onClose(); onRemove(); }}
            className="self-start inline-flex items-center min-h-11 text-sm font-semibold text-marker-red-text underline underline-offset-2"
          >Remove from this month</button>
        )}
        <div className="flex gap-2 mt-1">
          <button onClick={onClose} className="flex-1 min-h-11 rounded-lg text-sm text-stone-500 bg-stone-100">Cancel</button>
          <button onClick={() => void save()} disabled={!valid} className="flex-1 min-h-11 rounded-lg text-sm font-semibold text-manila bg-ink disabled:opacity-40">Save</button>
        </div>
      </div>
    </div>
  );
}
