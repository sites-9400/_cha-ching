import { useEffect, useState } from "react";
import PinPad from "./components/PinPad";
import { watchAuth } from "./lib/pinAuth";

export default function App() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => watchAuth(setSignedIn), []);

  if (signedIn === null) return null; // auth state loading
  if (!signedIn) return <PinPad />;

  return (
    <main className="min-h-screen bg-emerald-950 text-emerald-50 flex items-center justify-center">
      <h1 className="text-3xl font-bold">Unlocked ✅</h1>
    </main>
  );
}
