import { useEffect, useState } from "react";
import MonthPreview from "./components/MonthPreview";
import PinPad from "./components/PinPad";
import { watchAuth } from "./lib/pinAuth";

export default function App() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => watchAuth(setSignedIn), []);

  if (signedIn === null) return null; // auth state loading
  if (!signedIn) return <PinPad />;

  return <MonthPreview />;
}
