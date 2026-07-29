import { useState } from "react";
import { useCollection } from "../hooks/useCollection";
import { currentMonthKey, localIso } from "../lib/clock";
import { peso } from "../lib/format";
import { categoriesCol, debtsCol, expensesCol, monthLines } from "../lib/paths";
import { decodePaidFrom } from "../lib/paidFrom";
import { addExpense, deleteExpense } from "../lib/repo";
import { activeLines } from "../lib/selectors";
import { showToast } from "../lib/toast";
import type { Category, Channel, Debt, Expense, MonthLine } from "../lib/types";
import { useAccounts } from "./AccountsProvider";
import ChannelIcon from "./ChannelIcon";
import HeaderBand from "./HeaderBand";
import DueSoonStrip from "./DueSoonStrip";
import EditExpenseDialog from "./EditExpenseDialog";
import ImportExpenses from "./ImportExpenses";
import PaidFromPicker from "./PaidFromPicker";

export default function QuickAdd() {
  const { names: CHANNELS, chip, label } = useAccounts();
  const categories = useCollection<Category>(categoriesCol());
  const expenses = useCollection<Expense>(expensesCol());
  const allLines = useCollection<MonthLine>(monthLines(currentMonthKey()));
  const lines = activeLines(allLines);
  const debts = useCollection<Debt>(debtsCol());
  const activeDebts = debts.filter((d) => d.active).sort((a, b) => a.payoffOrder - b.payoffOrder);
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Food");
  const [channel, setChannel] = useState<Channel>("CASH");
  const [note, setNote] = useState("");
  const [when, setWhen] = useState(""); // "" = now
  const [envelope, setEnvelope] = useState<string>(() => localStorage.getItem("quickadd-envelope") ?? "");
  const [editing, setEditing] = useState<Expense | null>(null);
  const [importing, setImporting] = useState(false);

  const envelopes = lines
    .filter((l) => l.isEnvelope && !l.budgetGroup)
    .sort((a, b) => a.cutoff - b.cutoff || a.order - b.order);
  const groups = [...new Set(lines.filter((l) => l.isEnvelope && l.budgetGroup).map((l) => l.budgetGroup!))].sort();
  // "@savings" = Savings; "@group:X" = budget group X; "@debt:ID" = charged to
  // that debt. A remembered source that no longer exists (new month, deleted
  // line, deactivated debt) falls back to Unplanned.
  const activeEnvelope =
    envelope === "@savings"
    || (envelope.startsWith("@group:") && groups.includes(envelope.slice(7)))
    || (envelope.startsWith("@debt:") && activeDebts.some((d) => d.id === envelope.slice(6)))
    || envelopes.some((l) => l.id === envelope)
      ? envelope : "";
  const pickEnvelope = (id: string) => {
    setEnvelope(id);
    localStorage.setItem("quickadd-envelope", id);
  };

  const cats = [...categories].sort((a, b) => a.order - b.order);
  const recent = [...expenses].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
  const monthKey = currentMonthKey();
  const spentThisMonth = expenses
    .filter((e) => e.date.slice(0, 7) === monthKey)
    .reduce((s, e) => s + e.amount, 0);
  const value = Number(amount);
  const canSave = value > 0;

  function save() {
    if (!canSave) return;
    void addExpense({
      amount: value, category, channel, note, date: when ? `${when}T12:00:00` : localIso(),
      ...decodePaidFrom(activeEnvelope),
    }).catch((err) => {
      console.error(err);
      showToast("Expense didn't save — check connection");
    });
    setAmount("");
    setNote("");
    setWhen("");
  }

  function removeExpense(e: Expense) {
    const { id: _id, ...data } = e;
    void deleteExpense(e.id).catch(() => showToast("Delete failed — check connection"));
    showToast(`Deleted ${peso(e.amount)} · ${e.category}`, {
      action: { label: "Undo", run: () => void addExpense(data).catch(() => showToast("Undo failed — re-add manually")) },
      duration: 6000,
    });
  }

  const Label = ({ children }: { children: React.ReactNode }) => (
    <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-400 mb-1.5">{children}</p>
  );

  return (
    <>
      <HeaderBand title="SPENT THIS MONTH" value={peso(spentThisMonth)} />
      <main className="p-4">
      <DueSoonStrip />
      <div className="bg-white rounded-2xl shadow p-5 flex flex-col gap-5">
        <div>
          <Label>Amount</Label>
          <div className="flex items-baseline gap-1 border-b-2 border-stone-200 focus-within:border-emerald-500 pb-1">
            <span className="text-2xl font-bold text-stone-400">₱</span>
            <input
              type="number" inputMode="decimal" placeholder="0"
              value={amount} onChange={(e) => setAmount(e.target.value)}
              className="flex-1 min-w-0 text-3xl font-bold tabular-nums outline-none bg-transparent"
            />
          </div>
        </div>

        <div>
          <Label>Category</Label>
          <div className="flex flex-wrap gap-2">
            {cats.map((c) => (
              <button
                key={c.id} onClick={() => setCategory(c.name)}
                className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
                  category === c.name ? "bg-emerald-600 text-white" : "bg-stone-100 text-stone-600"
                }`}
              >{c.name}</button>
            ))}
          </div>
        </div>

        <div>
          <Label>Account</Label>
          <div className="flex flex-wrap gap-1.5">
            {CHANNELS.map((c) => (
              <button
                key={String(c)} onClick={() => setChannel(c)}
                className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
                  channel === c ? chip(c) : "bg-stone-100 text-stone-400"
                }`}
              >{c}</button>
            ))}
          </div>
        </div>

        <div>
          <Label>Paid from</Label>
          <PaidFromPicker value={activeEnvelope} onPick={pickEnvelope} groups={groups} envelopes={envelopes} debts={activeDebts} />
        </div>

        <div>
          <Label>Note</Label>
          <input
            placeholder="optional" value={note} onChange={(e) => setNote(e.target.value)}
            className="w-full text-base border-b border-stone-200 pb-1 outline-none focus:border-emerald-500"
          />
        </div>

        <div>
          <Label>Date</Label>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setWhen("")}
              className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
                when === "" ? "bg-emerald-600 text-white" : "bg-stone-100 text-stone-600"
              }`}
            >Today</button>
            <button
              onClick={() => setWhen(localIso(new Date(Date.now() - 86400000)).slice(0, 10))}
              className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
                when !== "" && when === localIso(new Date(Date.now() - 86400000)).slice(0, 10)
                  ? "bg-emerald-600 text-white" : "bg-stone-100 text-stone-600"
              }`}
            >Yesterday</button>
            <input
              type="date"
              value={when}
              max={localIso().slice(0, 10)}
              onChange={(e) => setWhen(e.target.value)}
              className="text-xs bg-stone-100 text-stone-600 rounded-full px-3 py-1.5 outline-none"
            />
          </div>
        </div>

        <button
          onClick={save} disabled={!canSave}
          className="bg-emerald-600 disabled:bg-stone-300 text-white font-semibold rounded-xl py-3.5 text-base"
        >Save{value > 0 ? ` ${peso(value)}` : ""}</button>
      </div>

      <div className="flex items-center justify-between mt-6 mb-2">
        <h2 className="font-semibold text-sm text-stone-600">Recent</h2>
        <button onClick={() => setImporting(true)} className="text-xs font-semibold text-emerald-700">📷 Import</button>
      </div>
      <ul className="flex flex-col gap-1.5">
        {recent.map((e) => (
          <li key={e.id} className="bg-white rounded-2xl px-3 py-2.5 flex items-center justify-between gap-2.5">
            <button onClick={() => setEditing(e)} className="flex items-center justify-between gap-2.5 min-w-0 flex-1 text-left">
              <span className="flex items-center gap-2.5 min-w-0">
                <ChannelIcon channel={String(e.channel)} initial={e.category.charAt(0).toUpperCase()} chipClass={chip(e.channel)} />
                <span className="text-sm truncate min-w-0">
                  <span className="block truncate">
                    {e.category}
                    {e.envelopeLineId && (
                      <span className="text-emerald-700"> · {lines.find((l) => l.id === e.envelopeLineId)?.name ?? "envelope"}</span>
                    )}
                    {e.fundedBySavings && <span className="text-cyan-700"> · Savings</span>}
                    {e.budgetGroup && <span className="text-emerald-700"> · {e.budgetGroup}</span>}
                    {e.paidWithDebtId && (
                      <span className="text-violet-700"> · 💳 {debts.find((d) => d.id === e.paidWithDebtId)?.name ?? "card"}</span>
                    )}
                    {e.note ? ` · ${e.note}` : ""}
                  </span>
                  <span className="block text-[10px] text-stone-400">{label(e.channel)}</span>
                </span>
              </span>
              <span className="text-sm font-semibold tabular-nums shrink-0">{peso(e.amount)}</span>
            </button>
            <button onClick={() => removeExpense(e)} className="text-stone-300 text-xs shrink-0">✕</button>
          </li>
        ))}
        {recent.length === 0 && <li className="text-sm text-stone-400 px-3">No expenses logged yet.</li>}
      </ul>

      {editing && (
        <EditExpenseDialog
          expense={editing} categories={cats} lines={lines} debts={activeDebts}
          onClose={() => setEditing(null)}
        />
      )}
      {importing && <ImportExpenses onClose={() => setImporting(false)} />}
      </main>
    </>
  );
}
