import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router';
import { db, type Mistake } from '@/db/db';
import type { MistakeCategory } from '@/content/schema';
import { maybeItem } from '@/lib/items';
import { PronunciationCard } from '@/components/PronunciationCard';
import { Badge, Button, Card, Notice, PageHeader } from '@/components/ui';

export const CATEGORY_PL: Record<MistakeCategory, string> = {
  meaning: 'Pomylone znaczenie',
  listening: 'Niezrozumiane ze słuchu',
  'ser-estar': 'Ser czy estar',
  conjugation: 'Odmiana czasownika',
  'gender-article': 'Rodzaj i rodzajnik',
  'word-order': 'Szyk zdania',
  politeness: 'Forma grzecznościowa',
  pronunciation: 'Wymowa',
  building: 'Samodzielne budowanie zdania',
  vocabulary: 'Słówko z pamięci',
};

export default function Mistakes() {
  const open = useLiveQuery(() => db.mistakes.where('resolved').equals(0).reverse().sortBy('at'), []);
  const resolvedCount = useLiveQuery(() => db.mistakes.where('resolved').equals(1).count(), []);
  if (!open) return <p className="py-10 text-center text-[var(--muted)]">Ładowanie…</p>;
  const groups = new Map<MistakeCategory, Mistake[]>();
  for (const m of open) groups.set(m.category, [...(groups.get(m.category) ?? []), m]);

  return (
    <div className="space-y-4">
      <PageHeader title="Zeszyt błędów" subtitle="Pomyłki to normalna część nauki — tu wracają do Ciebie" back="/wiecej" />
      {open.length === 0 ? (
        <Notice tone="ok">Brak otwartych błędów.{resolvedCount ? ` Opanowane: ${resolvedCount}.` : ''}</Notice>
      ) : (
        <>
          <Link to="/powtorki?bledy=1">
            <Button size="lg" className="w-full">
              Przećwicz błędy ({Math.min(open.length, 15)})
            </Button>
          </Link>
          <p className="text-xs text-[var(--muted)]">Błąd znika z listy po dwóch kolejnych poprawnych odpowiedziach. Opanowane: {resolvedCount ?? 0}.</p>
        </>
      )}
      {[...groups.entries()].map(([cat, list]) => (
        <Card key={cat} className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">{CATEGORY_PL[cat]}</h2>
            <Badge>{list.length}</Badge>
          </div>
          {list.slice(0, 12).map((m) => {
            const it = m.itemId ? maybeItem(m.itemId) : undefined;
            return (
              <div key={m.id} className="space-y-1 border-t border-[var(--border)] pt-2 text-sm">
                <p>
                  <span className="text-[var(--muted)]">Twoja odpowiedź:</span> {m.given || '—'} · <span className="text-[var(--muted)]">poprawnie:</span>{' '}
                  <strong lang="pt-PT">{m.expected}</strong>
                </p>
                {m.notePl && <p className="text-[var(--muted)]">{m.notePl}</p>}
                {it && <PronunciationCard item={it} variant="row" />}
              </div>
            );
          })}
        </Card>
      ))}
    </div>
  );
}
