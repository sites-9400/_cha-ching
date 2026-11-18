import { useState } from "react";
import { lock } from "../lib/pinAuth";
import { getThemePref, setThemePref, type ThemePref } from "../lib/theme";
import HeaderBand from "./HeaderBand";
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
import { ChevronLeftIcon, ChevronRightIcon } from "./icons";

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

const THEMES: { id: ThemePref; label: string }[] = [
  { id: "system", label: "System" },
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
];

export default function Settings() {
  const [section, setSection] = useState<Section | null>(null);
  const [theme, setTheme] = useState<ThemePref>(getThemePref);

  const pickTheme = (t: ThemePref) => {
    setTheme(t);
    setThemePref(t);
  };

  if (section) {
    return (
      <main className="p-4 pt-[calc(env(safe-area-inset-top)+1rem)]">
        <button onClick={() => setSection(null)} className="text-sm text-ink font-semibold mb-2 inline-flex items-center gap-1 min-h-11"><ChevronLeftIcon className="h-4 w-4" /><span className="underline underline-offset-2">Settings</span></button>
        <Editor section={section} />
      </main>
    );
  }

  return (
    <>
      <HeaderBand title="Settings" />
      <main className="p-4">
      <div className="bg-manila rounded-xl border border-rule shadow-card px-4 py-3 mb-4 flex items-center justify-between">
        <span className="text-sm">Appearance</span>
        <div className="flex rounded-full bg-stone-100 p-0.5 text-xs font-semibold">
          {THEMES.map((t) => (
            <button
              key={t.id}
              onClick={() => pickTheme(t.id)}
              className={`px-3 min-h-11 rounded-full ${theme === t.id ? "bg-ink text-manila" : "text-ink-2"}`}
            >{t.label}</button>
          ))}
        </div>
      </div>
      <ul className="bg-manila rounded-xl border border-rule shadow-card divide-y divide-stone-100 mb-6">
        {ROWS.map((r) => (
          <li key={r.id}>
            <button onClick={() => setSection(r.id)} className="w-full min-h-11 flex items-center justify-between px-4 py-3 text-sm">
              {r.label}
              <ChevronRightIcon className="h-4 w-4 text-ink-2" />
            </button>
          </li>
        ))}
      </ul>
      <button
        onClick={() => void lock()}
        className="w-full min-h-11 py-3 rounded-xl bg-manila border border-rule shadow-card text-sm font-semibold text-marker-red-text"
      >
        Sign out
      </button>
      </main>
    </>
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
