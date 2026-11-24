import { useLiveQuery } from 'dexie-react-hooks';
import { Play, Trash2 } from 'lucide-react';
import { db } from '@/db/db';
import { deleteRecording } from '@/db/repo';
import { maybeItem } from '@/lib/items';
import { AudioButton } from '@/components/Audio';
import { Button, Card, Notice, PageHeader } from '@/components/ui';

export default function Recordings() {
  const recs = useLiveQuery(() => db.recordings.orderBy('at').reverse().toArray(), []);
  return (
    <div className="space-y-3">
      <PageHeader title="Moje nagrania" subtitle="Zapisane na tym urządzeniu — nigdzie nie są wysyłane" back="/wiecej" />
      {!recs?.length && <Notice tone="info">Brak zapisanych nagrań. Nagraj się przy dowolnym słowie i wybierz „Zapisz”.</Notice>}
      {recs?.map((r) => {
        const it = r.itemId ? maybeItem(r.itemId) : undefined;
        return (
          <Card key={r.id} className="flex items-center gap-3">
            <Button variant="secondary" size="sm" aria-label="Odsłuchaj swoje nagranie" onClick={() => void new Audio(URL.createObjectURL(r.blob)).play()}>
              <Play className="size-4" /> Ja
            </Button>
            {it && <AudioButton item={it} size="sm" label="Odsłuchaj wzorzec" />}
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium" lang="pt-PT">{r.label}</p>
              <p className="text-xs text-[var(--muted)]">
                {new Date(r.at).toLocaleString('pl-PL')} · {Math.round(r.durationMs / 1000)} s
              </p>
            </div>
            <Button variant="ghost" size="sm" aria-label="Usuń nagranie" onClick={() => r.id && deleteRecording(r.id)}>
              <Trash2 className="size-4" />
            </Button>
          </Card>
        );
      })}
    </div>
  );
}
