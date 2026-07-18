import { useState } from "react";
import { lock } from "../lib/pinAuth";
import DebtsEditor from "./settings/DebtsEditor";
import TemplateEditor from "./settings/TemplateEditor";
import IncomesEditor from "./settings/IncomesEditor";
import CategoriesEditor from "./settings/CategoriesEditor";
import FundsEditor from "./settings/FundsEditor";
import EventsEditor from "./settings/EventsEditor";
import SubscriptionsEditor from "./settings/SubscriptionsEditor";
import AccountsEditor from "./settings/AccountsEditor";
import ChangePin from "./settings/ChangePin";
import ExportData from "./settings/ExportData";
import BackupsEditor from "./settings/BackupsEditor";

type Section =
  | "debts" | "template" | "incomes" | "categories" | "funds" | "subscriptions" | "events"
  | "accounts" | "pin" | "export" | "backups";

const ROWS: { id: Section; label: string }[] = [
  { id: "debts", label: "Debts" },
  { id: "accounts", label: "Accounts" },
  { id: "template", label: "Recurring" },
  { id: "incomes", label: "Income sources" },
  { id: "categories", label: "Categories" },
  { id: "funds", label: "Sinking funds" },
  { id: "subscriptions", label: "Subscriptions" },
  { id: "events", label: "Planned one-offs" },
  { id: "backups", label: "Backups" },
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
  if (section === "template") return <TemplateEditor />;
  if (section === "incomes") return <IncomesEditor />;
  if (section === "categories") return <CategoriesEditor />;
  if (section === "funds") return <FundsEditor />;
  if (section === "subscriptions") return <SubscriptionsEditor />;
  if (section === "events") return <EventsEditor />;
  if (section === "accounts") return <AccountsEditor />;
  if (section === "pin") return <ChangePin />;
  if (section === "export") return <ExportData />;
  if (section === "backups") return <BackupsEditor />;
  return <div className="text-stone-500 text-sm">{section} editor — coming in a later step.</div>;
}
