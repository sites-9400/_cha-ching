import { useState } from "react";
import { useCollection } from "../../hooks/useCollection";
import { useAccounts } from "../AccountsProvider";
import { peso } from "../../lib/format";
import { eventsCol } from "../../lib/paths";
import { addEvent, updateEvent, deleteEvent } from "../../lib/repo";
import type { Channel, EventItem } from "../../lib/types";
import ConfirmDialog from "../ConfirmDialog";

const BLANK: Omit<EventItem, "id"> = { name: "", amount: 0, month: "" };

export default function EventsEditor() {
  const events = useCollection<EventItem>(eventsCol());
  const sorted = [...events].sort((a, b) => a.month.localeCompare(b.month));
  const [editing, setEditing] = useState<EventItem | Omit<EventItem, "id"> | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  if (editing) return <Form ev={editing} onDone={() => setEditing(null)} />;

  return (
    <div>
      <h2 className="font-bold text-lg mb-1">Planned one-offs</h2>
      <p className="text-xs text-stone-400 mb-3">Suggested one-off lines when a month is generated.</p>
      <ul className="flex flex-col gap-2">
        {sorted.map((e) => (
          <li key={e.id} className="bg-white rounded-xl shadow p-3 flex items-center gap-2">
            <button onClick={() => setEditing(e)} className="flex-1 flex items-center justify-between min-w-0">
              <span className="truncate text-sm">{e.month} · C{e.cutoff ?? 2} · {e.name}</span>
              <span className="text-sm tabular-nums">{peso(e.amount)}</span>
            </button>
            <button onClick={() => setConfirmId(e.id)} className="text-red-500 text-xs px-1">✕</button>
          </li>
        ))}
      </ul>
      <button onClick={() => setEditing({ ...BLANK })} className="mt-3 text-sm font-semibold text-emerald-700">+ Add event</button>
      {confirmId && (
        <ConfirmDialog title="Delete event?" message="It will no longer be suggested."
          onConfirm={async () => { await deleteEvent(confirmId); setConfirmId(null); }}
          onCancel={() => setConfirmId(null)} />
      )}
    </div>
  );
}

function Form({ ev, onDone }: { ev: EventItem | Omit<EventItem, "id">; onDone: () => void }) {
  const { names: CHANNELS } = useAccounts();
  const [f, setF] = useState(ev);
  const id = "id" in ev ? ev.id : null;
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF({ ...f, [k]: v });
  const validMonth = /^\d{4}-\d{2}$/.test(f.month);

  async function save() {
    if (!f.name.trim() || !validMonth) return;
    if (id) await updateEvent(id, f); else await addEvent(f);
    onDone();
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-bold text-lg">{id ? "Edit event" : "Add event"}</h2>
      <input placeholder="Name" value={f.name} onChange={(e) => set("name", e.target.value)} className="text-sm border-b border-stone-300 outline-none pb-1" />
      <label className="flex items-center justify-between text-sm">Amount
        <input type="number" inputMode="decimal" value={f.amount || ""} onChange={(e) => set("amount", Number(e.target.value))} className="w-28 text-right border-b border-stone-300 outline-none tabular-nums" />
      </label>
      <label className="flex items-center justify-between text-sm">Month (YYYY-MM)
        <input placeholder="2026-08" value={f.month} onChange={(e) => set("month", e.target.value)} className="w-28 text-right border-b border-stone-300 outline-none tabular-nums" />
      </label>
      <label className="flex items-center justify-between text-sm">Cutoff
        <select value={f.cutoff ?? 2} onChange={(e) => set("cutoff", Number(e.target.value) as 1 | 2)} className="text-sm border-b border-stone-300 outline-none">
          <option value={1}>1st cutoff</option>
          <option value={2}>2nd cutoff</option>
        </select>
      </label>
      <label className="flex items-center justify-between text-sm">Channel (optional)
        <select value={f.channel ?? ""} onChange={(e) => set("channel", (e.target.value || undefined) as Channel | undefined)} className="text-sm border-b border-stone-300 outline-none">
          <option value="">—</option>
          {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>
      <input placeholder="Note (optional)" value={f.note ?? ""} onChange={(e) => set("note", e.target.value || undefined)} className="text-sm border-b border-stone-300 outline-none pb-1" />
      <div className="flex gap-2 mt-2">
        <button onClick={onDone} className="flex-1 py-2 rounded-lg text-sm text-stone-500 bg-stone-100">Cancel</button>
        <button onClick={() => void save()} disabled={!f.name.trim() || !validMonth} className="flex-1 py-2 rounded-lg text-sm font-semibold text-white bg-emerald-600 disabled:opacity-40">Save</button>
      </div>
    </div>
  );
}
