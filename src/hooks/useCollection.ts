import { collection, onSnapshot, query } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "../lib/firebase";
import { showToast } from "../lib/toast";

/** Live-subscribe to a Firestore collection; returns [{id, ...data}] array. */
export function useCollection<T>(path: string): T[] {
  const [items, setItems] = useState<T[]>([]);
  useEffect(() => {
    const un = onSnapshot(
      query(collection(db, path)),
      (snap) => setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T)),
      (err) => {
        console.error("[sync]", path, err);
        showToast("Sync error — check connection or reload");
      },
    );
    return un;
  }, [path]);
  return items;
}
