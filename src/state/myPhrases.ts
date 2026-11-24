import { useLiveQuery } from 'dexie-react-hooks';
import { db, type MyPhrase } from '@/db/db';

export function useMyPhraseIds(): Set<string> {
  const rows = useLiveQuery(() => db.myPhrases.toArray(), []) ?? [];
  return new Set(rows.flatMap((r) => (r.itemId ? [r.itemId] : [])));
}

export async function toggleMyPhrase(itemId: string, source: MyPhrase['source'] = 'other') {
  const existing = await db.myPhrases.where('itemId').equals(itemId).first();
  if (existing?.id) await db.myPhrases.delete(existing.id);
  else await db.myPhrases.add({ itemId, source, at: new Date().toISOString() });
}
