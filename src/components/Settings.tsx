import { useState } from "react";
import { lock } from "../lib/pinAuth";
import DebtsEditor from "./settings/DebtsEditor";

type Section =
  | "debts" | "template" | "incomes" | "categories" | "funds" | "events" | "pin" | "export";

const ROWS: { id: Section; label: string }[] = [
  { id: "debts", label: "Debts" },
  { id: "template", label: "Template lines" },
  { id: "incomes", label: "Income sources" },
  { id: "categories", label: "Categories" },
  { id: "funds", label: "Sinking funds" },
  { id: "events", label: "Events" },
  { id: "pin", label: "Change PIN" },
  { id: "export", label: "Export CSV" },
];

export default function Settings() {
  const [section, setSection] = useState<Section | null>(null);

  if (section) {
    return (
      <main className="p-4">
        <button onClick={() => setSection(null)} className="text-sm text-emerald-700 font-semibold mb-4">‹ Settings</button>
        <Editor section={section} />
      </main>
    );
  }

  return (
    <main className="p-4">
      <h1 className="text-xl font-bold mb-4">Settings</h1>
      <ul className="bg-white rounded-xl shadow divide-y divide-stone-100 mb-6">
        {ROWS.map((r) => (
          <li key={r.id}>
            <button onClick={() => setSection(r.id)} className="w-full flex items-center justify-between px-4 py-3 text-sm">
              {r.label}
              <span className="text-stone-300">›</span>
            </button>
          </li>
        ))}
      </ul>
      <button
        onClick={() => void lock()}
        className="w-full py-3 rounded-xl bg-white shadow text-sm font-semibold text-red-600"
      >
        Sign out
      </button>
    </main>
  );
}

function Editor({ section }: { section: Section }) {
  if (section === "debts") return <DebtsEditor />;
  return <div className="text-stone-500 text-sm">{section} editor — coming in a later step.</div>;
}
