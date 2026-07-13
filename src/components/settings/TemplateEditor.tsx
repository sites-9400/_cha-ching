import { useState } from "react";
import { useCollection } from "../../hooks/useCollection";
import { useAccounts } from "../AccountsProvider";
import { currentMonthKey } from "../../lib/clock";
import { peso } from "../../lib/format";
import { monthLines, templateLines } from "../../lib/paths";
import { addTemplateLine, updateTemplateLine, deleteTemplateLine, syncMonthFromTemplate } from "../../lib/repo";
import type { Channel, MonthLine, TemplateLine } from "../../lib/types";
import ConfirmDialog from "../ConfirmDialog";

const BLANK: Omit<TemplateLine, "id"> = { name: "", amount: 0, channel: "CIMB", cutoff: 1, order: 99 };

export default function TemplateEditor() {
  const monthKey = currentMonthKey();
  const lines = useCollection<TemplateLine>(templateLines());
  const monthLineList = useCollection<MonthLine>(monthLines(monthKey));
  const sorted = [...lines].sort((a, b) => (a.cutoff - b.cutoff) || (a.order - b.order));
  const [editing, setEditing] = useState<TemplateLine | Omit<TemplateLine, "id"> | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  if (editing) {
    return (
      <Form
        line={editing}
        onDone={async () => { await syncMonthFromTemplate(monthKey); setEditing(null); }}
        onCancel={() => setEditing(null)}
      />
    );
  }

  const counterpart = confirmId ? monthLineList.find((l) => l.id === confirmId && !l.oneOff) : undefined;
  const paid = counterpart?.status === "PAID";

  return (
    <div>
      <h2 className="font-bold text-lg mb-1">Template lines</h2>
      <p className="text-xs text-stone-400 mb-3">Edits sync into the current month, keeping your ticks.</p>
      <ul className="flex flex-col gap-2">
        {sorted.map((l) => (
          <li key={l.id} className="bg-white rounded-xl shadow p-3 flex items-center gap-2">
            <button onClick={() => setEditing(l)} className="flex-1 flex items-center justify-between min-w-0">
              <span className="truncate text-sm">C{l.cutoff} · {l.name}</span>
              <span className="text-sm tabular-nums">{peso(l.amount)}</span>
            </button>
            <button onClick={() => setConfirmId(l.id)} className="text-red-500 text-xs px-1">✕</button>
          </li>
        ))}
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

function Form({ line, onDone, onCancel }: { line: TemplateLine | Omit<TemplateLine, "id">; onDone: () => void | Promise<void>; onCancel: () => void }) {
  const { names: CHANNELS } = useAccounts();
  const [f, setF] = useState(line);
  const id = "id" in line ? line.id : null;
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF({ ...f, [k]: v });

  async function save() {
    if (!f.name.trim()) return;
    if (id) await updateTemplateLine(id, f); else await addTemplateLine(f);
    await onDone();
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
      <div className="flex gap-2 mt-2">
        <button onClick={onCancel} className="flex-1 py-2 rounded-lg text-sm text-stone-500 bg-stone-100">Cancel</button>
        <button onClick={() => void save()} disabled={!f.name.trim()} className="flex-1 py-2 rounded-lg text-sm font-semibold text-white bg-emerald-600 disabled:opacity-40">Save</button>
      </div>
    </div>
  );
}
