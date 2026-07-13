import { collectionGroup, onSnapshot, query } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "../lib/firebase";

/**
 * Live-subscribe to a collection group (e.g. every debt's "payments").
 * Each item carries its own id plus `debtId` = the parent debt doc id.
 * No where/orderBy → no custom index required; filter client-side.
 */
export function useCollectionGroup<T>(groupId: string): T[] {
  const [items, setItems] = useState<T[]>([]);
  useEffect(() => {
    const un = onSnapshot(query(collectionGroup(db, groupId)), (snap) =>
      setItems(
        snap.docs.map((d) => ({ id: d.id, debtId: d.ref.parent.parent?.id, ...d.data() }) as T),
      ),
    );
    return un;
  }, [groupId]);
  return items;
}
