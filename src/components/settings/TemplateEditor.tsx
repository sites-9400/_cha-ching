import { Fragment, useState } from "react";
import { useCollection } from "../../hooks/useCollection";
import { useAccounts } from "../AccountsProvider";
import { currentMonthKey } from "../../lib/clock";
import { peso } from "../../lib/format";
import { debtsCol, monthLines, templateLines } from "../../lib/paths";
import { addTemplateLine, updateTemplateLine, deleteTemplateLine, syncMonthFromTemplate } from "../../lib/repo";
import { isCutoffClosed } from "../../lib/selectors";
import type { Channel, Debt, MonthLine, TemplateLine } from "../../lib/types";
import ConfirmDialog from "../ConfirmDialog";

const BLANK: Omit<TemplateLine, "id"> = { name: "", amount: 0, channel: "CIMB", cutoff: 1, order: 99 };

type SortKey = "cutoff" | "amount" | "channel" | "name";
const SORTS: { key: SortKey; label: string }[] = [
  { key: "cutoff", label: "Cutoff" },
  { key: "amount", label: "Amount" },
  { key: "channel", label: "Channel" },
  { key: "name", label: "Name" },
];
const compareBy: Record<SortKey, (a: TemplateLine, b: TemplateLine) => number> = {
  cutoff: (a, b) => (a.cutoff - b.cutoff) || (a.order - b.order),
  amount: (a, b) => b.amount - a.amount, // biggest first
  channel: (a, b) => String(a.channel).localeCompare(String(b.channel)) || (a.order - b.order),
  name: (a, b) => a.name.localeCompare(b.name),
};

export default function TemplateEditor() {
  const monthKey = currentMonthKey();
  const lines = useCollection<TemplateLine>(templateLines());
  const monthLineList = useCollection<MonthLine>(monthLines(monthKey));
  const { chip, label } = useAccounts();
  const [sort, setSort] = useState<SortKey>("cutoff");
  const sorted = [...lines].sort(compareBy[sort]);
  const [editing, setEditing] = useState<TemplateLine | Omit<TemplateLine, "id"> | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (editing) {
    return (
      <Form
        line={editing}
        onDone={async (saved) => {
          await syncMonthFromTemplate(monthKey);
          setNotice(
            isCutoffClosed(monthLineList, saved.cutoff)
              ? `Cutoff ${saved.cutoff} is closed for ${monthKey} — this line starts next month.`
              : null,
          );
          setEditing(null);
        }}
        onCancel={() => setEditing(null)}
      />
    );
  }

  const counterpart = confirmId ? monthLineList.find((l) => l.id === confirmId && !l.oneOff) : undefined;
  const paid = counterpart?.status === "PAID";

  return (
    <div>
      <h2 className="font-bold text-lg mb-1">Recurring</h2>
      <p className="text-xs text-stone-400 mb-3">Edits sync into the current month's open cutoffs, keeping your ticks. Closed cutoffs are frozen.</p>
      {notice && (
        <p className="mb-3 rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 flex justify-between gap-2">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="font-semibold shrink-0">✕</button>
        </p>
      )}
      <div className="flex items-center gap-1.5 mb-3">
        <span className="text-[11px] text-stone-400">Sort</span>
        <div className="flex rounded-full bg-stone-100 p-0.5 text-[11px] font-semibold">
          {SORTS.map((s) => (
            <button
              key={s.key}
              onClick={() => setSort(s.key)}
              className={`px-2.5 py-0.5 rounded-full ${sort === s.key ? "bg-white shadow text-stone-700" : "text-stone-400"}`}
            >{s.label}</button>
          ))}
        </div>
      </div>
      <ul className="flex flex-col gap-2">
        {sorted.map((l, i) => {
          const groupHeader = sort === "channel" && (i === 0 || sorted[i - 1].channel !== l.channel);
          return (
            <Fragment key={l.id}>
              {groupHeader && (
                <li className="pt-2 first:pt-0 text-[10px] font-bold uppercase tracking-wide text-stone-400">
                  {label(l.channel)}
                </li>
              )}
              <li className="bg-white rounded-xl shadow p-3 flex items-center gap-2">
                <button onClick={() => setEditing(l)} className="flex-1 flex items-center gap-2 min-w-0">
                  <span className="text-[10px] text-stone-400 shrink-0">C{l.cutoff}</span>
                  <span className="truncate text-sm flex-1 text-left">{l.name}</span>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${chip(l.channel)}`}>{label(l.channel)}</span>
                  <span className="text-sm tabular-nums shrink-0">{peso(l.amount)}</span>
                </button>
                <button onClick={() => setConfirmId(l.id)} className="text-red-500 text-xs px-1">✕</button>
              </li>
            </Fragment>
          );
        })}
      </ul>
      <button onClick={() => setEditing({ ...BLANK })} className="mt-3 text-sm font-semibold text-emerald-700">+ Add line</button>
      {confirmId && (
        <ConfirmDialog
          title="Delete template line?"
          message={
            counterpart
              ? `This also removes it from ${monthKey}${paid ? " — where it's already marked PAID" : ""}.`
              : "Removed from future months."
          }
          onConfirm={async () => {
            await deleteTemplateLine(confirmId);
            await syncMonthFromTemplate(monthKey);
            setConfirmId(null);
          }}
          onCancel={() => setConfirmId(null)}
        />
      )}
    </div>
  );
}

function Form({ line, onDone, onCancel }: {
  line: TemplateLine | Omit<TemplateLine, "id">;
  onDone: (saved: Omit<TemplateLine, "id">) => void | Promise<void>;
  onCancel: () => void;
}) {
  const { names: CHANNELS } = useAccounts();
  const debts = useCollection<Debt>(debtsCol());
  const [f, setF] = useState(line);
  const id = "id" in line ? line.id : null;
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF({ ...f, [k]: v });

  async function save() {
    if (!f.name.trim()) return;
    // A budget group implies the line is a budget line — no separate toggle needed.
    const group = f.budgetGroup?.trim() ?? "";
    const withGroup = { ...f, budgetGroup: group, ...(group ? { isEnvelope: true } : {}) };
    // Firestore rejects undefined values (cleared "Pays debt" leaves debtId: undefined) — strip them.
    const clean = Object.fromEntries(Object.entries(withGroup).filter(([, v]) => v !== undefined)) as typeof f;
    if (id) await updateTemplateLine(id, clean); else await addTemplateLine(clean);
    await onDone(clean);
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-bold text-lg">{id ? "Edit line" : "Add line"}</h2>
      <input placeholder="Name" value={f.name} onChange={(e) => set("name", e.target.value)} className="text-sm border-b border-stone-300 outline-none pb-1" />
      <label className="flex items-center justify-between text-sm">Amount
        <input type="number" inputMode="decimal" value={f.amount || ""} onChange={(e) => set("amount", Number(e.target.value))} className="w-28 text-right border-b border-stone-300 outline-none tabular-nums" />
      </label>
      <label className="flex items-center justify-between text-sm">Cutoff
        <select value={f.cutoff} onChange={(e) => set("cutoff", Number(e.target.value) as 1 | 2)} className="text-sm border-b border-stone-300 outline-none">
          <option value={1}>1</option><option value={2}>2</option>
        </select>
      </label>
      <label className="flex items-center justify-between text-sm">Channel
        <select value={f.channel} onChange={(e) => set("channel", e.target.value as Channel)} className="text-sm border-b border-stone-300 outline-none">
          {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>
      <label className="flex items-center justify-between text-sm">Order
        <input type="number" value={f.order} onChange={(e) => set("order", Number(e.target.value))} className="w-20 text-right border-b border-stone-300 outline-none tabular-nums" />
      </label>
      <label className="flex items-center justify-between text-sm gap-2">
        <span className="shrink-0">Pays debt</span>
        <select value={f.debtId ?? ""} onChange={(e) => set("debtId", e.target.value || undefined)} className="text-sm border-b border-stone-300 outline-none min-w-0 flex-1 text-right">
          <option value="">— none —</option>
          {[...debts].filter((d) => d.active).sort((a, b) => a.payoffOrder - b.payoffOrder).map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </label>
      <p className="text-[11px] text-stone-400 -mt-1">Ticking this line PAID logs a payment to that debt.</p>
      <label className="flex items-center justify-between text-sm">Budget
        <input type="checkbox" checked={!!f.isEnvelope} onChange={(e) => set("isEnvelope", e.target.checked)} />
      </label>
      <p className="text-[11px] text-stone-400 -mt-1">Quick Add can draw spending from this budget line instead of free cash.</p>
      <label className="flex items-center justify-between text-sm gap-2">Budget group
        <input
          placeholder="e.g. Allowance"
          value={f.budgetGroup ?? ""}
          onChange={(e) => set("budgetGroup", e.target.value)}
          className="w-32 text-right border-b border-stone-300 outline-none"
        />
      </label>
      <p className="text-[11px] text-stone-400 -mt-1">Lines with the same group name share ONE combined pool. Setting a group makes this a budget line automatically.</p>
      <div className="flex gap-2 mt-2">
        <button onClick={onCancel} className="flex-1 py-2 rounded-lg text-sm text-stone-500 bg-stone-100">Cancel</button>
        <button onClick={() => void save()} disabled={!f.name.trim()} className="flex-1 py-2 rounded-lg text-sm font-semibold text-white bg-emerald-600 disabled:opacity-40">Save</button>
      </div>
    </div>
  );
}
