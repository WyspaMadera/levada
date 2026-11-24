import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { CheckCircle2, Lock } from 'lucide-react';
import { content } from '@/content/content';
import { db, type SelfRating } from '@/db/db';
import { getItem } from '@/lib/items';
import { useCourse } from '@/state/course';
import { PronunciationCard } from '@/components/PronunciationCard';
import { Badge, Button, Card, Notice, PageHeader } from '@/components/ui';

/** Misje w prawdziwym życiu: użyj zwrotu na Maderze i zapisz, jak poszło. */
export default function Missions() {
  const course = useCourse();
  const logs = useLiveQuery(() => db.missionLogs.toArray(), []) ?? [];
  const [openId, setOpenId] = useState<string | null>(null);
  const [note, setNote] = useState('');

  const done = (id: string) => logs.filter((l) => l.missionId === id);
  const save = async (missionId: string, self: SelfRating) => {
    await db.missionLogs.add({ missionId, self, notePl: note.trim() || undefined, at: new Date().toISOString() });
    setNote('');
    setOpenId(null);
  };

  return (
    <div className="space-y-3">
      <PageHeader title="Misje w prawdziwym życiu" subtitle="Najlepsza powtórka: użyć zwrotu naprawdę" back="/wiecej" />
      <Notice tone="info">Misje są dobrowolne i proste. Nie wymagają żadnych formalności — to zwykłe, krótkie rozmowy.</Notice>
      {content.missions.length === 0 && <Notice tone="info">Misje są w przygotowaniu.</Notice>}
      {content.missions.map((m) => {
        const unlocked = course.completedIds.has(m.unlockAfterLessonId);
        const d = done(m.id);
        if (!unlocked)
          return (
            <Card key={m.id} className="flex items-center gap-3 opacity-60">
              <Lock className="size-4" />
              <div>
                <p className="font-semibold">{m.titlePl}</p>
                <p className="text-xs text-[var(--muted)]">Po lekcji: {content.lessonById.get(m.unlockAfterLessonId)?.titlePl}</p>
              </div>
            </Card>
          );
        return (
          <Card key={m.id} className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold">{m.titlePl}</p>
              {d.length > 0 && (
                <Badge tone="ok">
                  <CheckCircle2 className="size-3.5" /> {d.length}×
                </Badge>
              )}
            </div>
            <p className="text-sm">{m.taskPl}</p>
            <p className="text-sm text-[var(--muted)]">{m.tipPl}</p>
            {m.phraseItemIds.map((id) => (
              <PronunciationCard key={id} item={getItem(id)} variant="row" />
            ))}
            {openId === m.id ? (
              <div className="space-y-2">
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Krótka notatka (opcjonalnie): jak poszło, co usłyszałeś/aś?"
                  aria-label="Notatka"
                  className="focus-ring w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2 text-sm"
                />
                <div className="grid grid-cols-3 gap-2">
                  <Button variant="success" onClick={() => save(m.id, 'can')}>Udało się</Button>
                  <Button variant="secondary" onClick={() => save(m.id, 'almost')}>Częściowo</Button>
                  <Button variant="secondary" onClick={() => save(m.id, 'cannot')}>Nie wyszło</Button>
                </div>
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setOpenId(m.id)}>
                Zrobione — zapisz
              </Button>
            )}
            {d.length > 0 && d[d.length - 1]!.notePl && <p className="text-xs text-[var(--muted)]">Ostatnia notatka: {d[d.length - 1]!.notePl}</p>}
          </Card>
        );
      })}
    </div>
  );
}
