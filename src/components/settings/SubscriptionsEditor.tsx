import { useState } from "react";
import { useCollection } from "../../hooks/useCollection";
import { useAccounts } from "../AccountsProvider";
import { peso } from "../../lib/format";
import { subscriptionsCol } from "../../lib/paths";
import { addSubscription, updateSubscription, deleteSubscription } from "../../lib/repo";
import type { Channel, Subscription } from "../../lib/types";
import ConfirmDialog from "../ConfirmDialog";

const BLANK: Omit<Subscription, "id"> = { name: "", amount: 0 };

/** Itemized registry of individual services (Netflix, iCloud, …) that today hide inside
 *  bundled "Subscriptions (…)" recurring lines. Informational only — does not create
 *  lines or affect the money math. */
export default function SubscriptionsEditor() {
  const subs = useCollection<Subscription>(subscriptionsCol());
  const sorted = [...subs].sort((a, b) => b.amount - a.amount);
  const total = subs.reduce((sum, s) => sum + s.amount, 0);
  const { chip, label } = useAccounts();
  const [editing, setEditing] = useState<Subscription | Omit<Subscription, "id"> | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  if (editing) return <Form sub={editing} onDone={() => setEditing(null)} />;

  return (
    <div>
      <h2 className="font-bold text-lg mb-1">Subscriptions</h2>
      <p className="text-xs text-stone-400 mb-3">
        {peso(total)}/month across {subs.length} subscriptions
      </p>
      <ul className="flex flex-col gap-2">
        {sorted.map((s) => (
          <li key={s.id} className="bg-white rounded-xl shadow p-3 flex items-center gap-2">
            <button onClick={() => setEditing(s)} className="flex-1 flex items-center gap-2 min-w-0">
              <span className="truncate text-sm flex-1 text-left">{s.name}</span>
              {s.channel && (
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${chip(s.channel)}`}>{label(s.channel)}</span>
              )}
              <span className="text-sm tabular-nums shrink-0">{peso(s.amount)}</span>
            </button>
            <button onClick={() => setConfirmId(s.id)} className="text-red-500 text-xs px-1">✕</button>
          </li>
        ))}
      </ul>
      <button onClick={() => setEditing({ ...BLANK })} className="mt-3 text-sm font-semibold text-emerald-700">+ Add subscription</button>
      {confirmId && (
        <ConfirmDialog title="Delete subscription?" message="It will no longer appear in this registry."
          onConfirm={async () => { await deleteSubscription(confirmId); setConfirmId(null); }}
          onCancel={() => setConfirmId(null)} />
      )}
    </div>
  );
}

function Form({ sub, onDone }: { sub: Subscription | Omit<Subscription, "id">; onDone: () => void }) {
  const { names: CHANNELS } = useAccounts();
  const [f, setF] = useState(sub);
  const id = "id" in sub ? sub.id : null;
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF({ ...f, [k]: v });

  async function save() {
    if (!f.name.trim()) return;
    if (id) await updateSubscription(id, f); else await addSubscription(f);
    onDone();
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-bold text-lg">{id ? "Edit subscription" : "Add subscription"}</h2>
      <input placeholder="Name" value={f.name} onChange={(e) => set("name", e.target.value)} className="text-sm border-b border-stone-300 outline-none pb-1" />
      <label className="flex items-center justify-between text-sm">Amount
        <input type="number" inputMode="decimal" value={f.amount || ""} onChange={(e) => set("amount", Number(e.target.value))} className="w-28 text-right border-b border-stone-300 outline-none tabular-nums" />
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
        <button onClick={() => void save()} disabled={!f.name.trim()} className="flex-1 py-2 rounded-lg text-sm font-semibold text-white bg-emerald-600 disabled:opacity-40">Save</button>
      </div>
    </div>
  );
}
