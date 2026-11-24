import { useLiveQuery } from 'dexie-react-hooks';
import { Star } from 'lucide-react';
import { db, type MyPhrase } from '@/db/db';
import { toggleMyPhrase } from '@/state/myPhrases';
import { cx } from './ui';

/** Dodaj / usuń z „Moich zdań”. */
export function SaveButton({ itemId, source = 'other', className }: { itemId: string; source?: MyPhrase['source']; className?: string }) {
  const saved = (useLiveQuery(() => db.myPhrases.where('itemId').equals(itemId).count(), [itemId]) ?? 0) > 0;
  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={saved ? 'Usuń z Moich zdań' : 'Zapisz w Moich zdaniach'}
      title={saved ? 'W Moich zdaniach' : 'Zapisz w Moich zdaniach'}
      onClick={() => void toggleMyPhrase(itemId, source)}
      className={cx('focus-ring rounded-full p-1.5 hover:bg-[var(--surface-2)]', className)}
    >
      <Star className={cx('size-5', saved ? 'fill-amber-400 text-amber-500' : 'text-[var(--muted)]')} />
    </button>
  );
}
