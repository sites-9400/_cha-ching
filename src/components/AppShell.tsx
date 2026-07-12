import { useState } from "react";
import TabBar, { type TabId } from "./TabBar";
import MonthProvider from "./MonthProvider";
import ThisMonth from "./ThisMonth";
import QuickAdd from "./QuickAdd";

function Placeholder({ title }: { title: string }) {
  return (
    <div className="p-6 text-center text-stone-500">
      <h1 className="text-lg font-bold text-stone-800 mb-2">{title}</h1>
      <p className="text-sm">Coming in a later step.</p>
    </div>
  );
}

export default function AppShell() {
  const [tab, setTab] = useState<TabId>("month");
  return (
    <MonthProvider>
      <div className="min-h-screen bg-stone-100 text-stone-900 pb-16 max-w-md mx-auto">
        {tab === "month" && <ThisMonth />}
        {tab === "debts" && <Placeholder title="Debts" />}
        {tab === "add" && <QuickAdd />}
        {tab === "dashboard" && <Placeholder title="Stats" />}
        {tab === "settings" && <Placeholder title="Settings" />}
        <TabBar active={tab} onChange={setTab} />
      </div>
    </MonthProvider>
  );
}
