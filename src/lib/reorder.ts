/**
 * Given a sorted list and an index, return the two id→newValue patches that swap
 * item[index] with its neighbor in direction dir (-1 up, +1 down) on numeric `key`.
 * Returns null when the move runs off either end. Pure.
 */
export function adjacentSwap<K extends string>(
  items: readonly (Record<K, number> & { id: string })[],
  index: number,
  dir: -1 | 1,
  key: K,
): [Record<K, number> & { id: string }, Record<K, number> & { id: string }] | null {
  const j = index + dir;
  if (j < 0 || j >= items.length) return null;
  const a = items[index], b = items[j];
  return [
    { id: a.id, [key]: b[key] } as Record<K, number> & { id: string },
    { id: b.id, [key]: a[key] } as Record<K, number> & { id: string },
  ];
}
