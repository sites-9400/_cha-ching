import { doc, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "../lib/firebase";

/** Live-subscribe to one doc. undefined = loading, null = missing, T = present. */
export function useDoc<T>(path: string): T | null | undefined {
  const [value, setValue] = useState<T | null | undefined>(undefined);
  useEffect(() => {
    // Path changed: back to loading. Never leak the previous doc's value (a stale
    // `null` here once let the month auto-generator overwrite an existing month).
    setValue(undefined);
    const un = onSnapshot(doc(db, path), (snap) =>
      setValue(snap.exists() ? ({ id: snap.id, ...snap.data() } as T) : null),
    );
    return un;
  }, [path]);
  return value;
}
