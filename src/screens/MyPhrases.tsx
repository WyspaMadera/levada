import { useState } from 'react';
import { Link } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { Mic, Play, Trash2 } from 'lucide-react';
import { content } from '@/content/content';
import { findBrazilianSuspects } from '@/content/brazil';
import { db } from '@/db/db';
import { speakText } from '@/lib/audio';
import { useApp } from '@/state/AppContext';
import { PronunciationCard } from '@/components/PronunciationCard';
import { Badge, Button, Card, Notice, PageHeader } from '@/components/ui';

export default function MyPhrases() {
  const { audio, settings } = useApp();
  const rows = useLiveQuery(() => db.myPhrases.orderBy('at').reverse().toArray(), []);
  const [pt, setPt] = useState('');
  const [pl, setPl] = useState('');
  const suspects = pt ? findBrazilianSuspects(pt).filter((s) => s.severity === 'suspect') : [];
  if (!rows) return null;
  const saved = rows.filter((r) => r.itemId && content.items.has(r.itemId));
  const custom = rows.filter((r) => r.customPt);

  return (
    <div className="space-y-4">
      <PageHeader title="Moje zdania" subtitle="Twój własny zbiór — zapisuj gwiazdką ☆ przy dowolnym zdaniu" back="/wiecej" />
      {saved.length > 0 && (
        <Link to="/powtorki?tryb=moje" className="block">
          <Button size="lg" className="w-full">
            <Mic className="size-5" /> Ćwicz na głos ({Math.min(saved.length, 15)})
          </Button>
        </Link>
      )}
      {saved.length === 0 && <Notice tone="info">Nie masz jeszcze zapisanych zdań. Dotknij gwiazdki przy zdaniu w lekcji, ściągawce lub czytance.</Notice>}
      {saved.map((r) => (
        <PronunciationCard key={r.id} item={content.items.get(r.itemId!)!} variant="compact" />
      ))}

      <Card className="space-y-3">
        <h2 className="font-bold">Własne zdanie</h2>
        <p className="text-sm text-[var(--muted)]">
          Np. zdanie usłyszane od sąsiada. Własnych zdań nie sprawdzamy i nie tworzymy dla nich zapisu wymowy — możesz je odsłuchać głosem urządzenia.
        </p>
        <input value={pt} onChange={(e) => setPt(e.target.value)} lang="pt-PT" placeholder="Po portugalsku" aria-label="Zdanie po portugalsku" className="focus-ring w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2" />
        <input value={pl} onChange={(e) => setPl(e.target.value)} placeholder="Po polsku (znaczenie)" aria-label="Znaczenie po polsku" className="focus-ring w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2" />
        {suspects.length > 0 && (
          <Notice tone="warn">
            Wygląda na formę brazylijską: {suspects.map((s) => `„${s.match}” — ${s.suggestionPl}`).join(' ')}
          </Notice>
        )}
        <Button
          variant="secondary"
          disabled={!pt.trim()}
          onClick={async () => {
            await db.myPhrases.add({ customPt: pt.trim(), customPl: pl.trim() || undefined, source: 'custom', at: new Date().toISOString() });
            setPt('');
            setPl('');
          }}
        >
          Dodaj
        </Button>
      </Card>

      {custom.map((r) => (
        <Card key={r.id} className="flex items-center gap-3">
          {audio?.choice.voice && (
            <Button size="sm" variant="secondary" aria-label="Odsłuchaj (głos urządzenia)" onClick={() => void speakText(r.customPt!, audio.choice.voice, settings.playbackRate)}>
              <Play className="size-4" />
            </Button>
          )}
          <div className="min-w-0 flex-1">
            <p className="font-semibold" lang="pt-PT">{r.customPt}</p>
            {r.customPl && <p className="text-sm text-[var(--muted)]">{r.customPl}</p>}
            <Badge>Twój tekst — bez zapisu wymowy</Badge>
          </div>
          <button type="button" aria-label="Usuń" className="focus-ring rounded p-1" onClick={() => r.id && db.myPhrases.delete(r.id)}>
            <Trash2 className="size-4 text-[var(--muted)]" />
          </button>
        </Card>
      ))}
    </div>
  );
}
