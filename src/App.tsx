import { useEffect, useState } from "react";
import AppShell from "./components/AppShell";
import AccountsProvider from "./components/AccountsProvider";
import PinPad from "./components/PinPad";
import { watchAuth } from "./lib/pinAuth";

export default function App() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  useEffect(() => watchAuth(setSignedIn), []);
  if (signedIn === null) return null;
  if (!signedIn) return <PinPad />;
  return (
    <AccountsProvider>
      <AppShell />
    </AccountsProvider>
  );
}
