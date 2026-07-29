import { useEffect, useState } from "react";
import AppShell from "./components/AppShell";
import AccountsProvider from "./components/AccountsProvider";
import PinPad from "./components/PinPad";
import ToastHost from "./components/ToastHost";
import { watchAuth } from "./lib/pinAuth";

export default function App() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  useEffect(() => watchAuth(setSignedIn), []);
  if (signedIn === null) return null;
  return (
    <>
      <ToastHost />
      {signedIn ? (
        <AccountsProvider>
          <AppShell />
        </AccountsProvider>
      ) : (
        <PinPad />
      )}
    </>
  );
}
