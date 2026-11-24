import { useState } from 'react';
import { Link } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { Lock, Pause, Play, Trash2 } from 'lucide-react';
import { content } from '@/content/content';
import type { BiographySection } from '@/content/schema';
import { db, type Profile } from '@/db/db';
import { deleteRecording, logSpeaking } from '@/db/repo';
import { getItem, itemView } from '@/lib/items';
import { stopAll } from '@/lib/audio';
import { useApp } from '@/state/AppContext';
import { useCourse } from '@/state/course';
import { usePlayer } from '@/components/Audio';
import { Phon } from '@/components/Phon';
import { PronunciationCard } from '@/components/PronunciationCard';
import { Recorder } from '@/components/Recorder';
import { Badge, Button, Card, Notice, PageHeader } from '@/components/ui';

function personalLine(t: BiographySection['templates'][number], profile: Profile | undefined, gender: 'm' | 'f') {
  if (!t.personal) return null;
  const value = profile?.[t.personal.field];
  const tmpl = getItem(t.personal.templateItemId);
  const v = itemView(tmpl, gender);
  return value ? { pt: t.personal.templatePt.replace(`{${t.personal.field}}`, value), phon: v.pron.plSlow?.replace('…', value), value } : null;
}

/** Wypowiedź o sobie budowana etapami; kolejne nagrania pozwalają zobaczyć postęp. */
export default function Biography() {
  const { settings } = useApp();
  const course = useCourse();
  const profile = useLiveQuery(() => db.profile.get('profile'), []);
  const recs = useLiveQuery(() => db.recordings.filter((r) => (r.taskId ?? '').startsWith('bio-')).toArray(), []) ?? [];
  const { play } = usePlayer();
  const [playingAll, setPlayingAll] = useState(false);
  const sections = content.biography;
  const open = sections.filter((s) => course.completedIds.has(s.unlockAfterLessonId));

  const playAll = async () => {
    setPlayingAll(true);
    for (const s of open)
      for (const t of s.templates) {
        if (t.optional || t.personal) continue;
        const r = await play(getItem(t.itemId), { repeat: 1, key: `bio-${t.itemId}` });
        if (!r.ok || stopFlag.stop) break;
        await new Promise((x) => setTimeout(x, 400));
      }
    stopFlag.stop = false;
    setPlayingAll(false);
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Mój portugalski życiorys" subtitle="Krok po kroku budujesz wypowiedź o sobie — docelowo 2–3 minuty" back="/wiecej" />
      <Card className="flex items-center justify-between gap-2">
        <p className="text-sm">
          Twoje dane (imię, miasto…) są tylko na tym urządzeniu.{' '}
          <Link className="underline" to="/zyciorys/dane">
            Edytuj dane
          </Link>
        </p>
        {!profile?.name && <Badge tone="warn">brak imienia</Badge>}
      </Card>
      {sections.length === 0 && <Notice tone="info">Sekcje wypowiedzi są w przygotowaniu.</Notice>}
      {open.length > 0 && (
        <Button
          variant="secondary"
          onClick={() => {
            if (playingAll) {
              stopFlag.stop = true;
              stopAll();
            } else void playAll();
          }}
        >
          {playingAll ? <Pause className="size-4" /> : <Play className="size-4" />} {playingAll ? 'Zatrzymaj' : 'Posłuchaj wzorów po kolei'}
        </Button>
      )}
      {sections.map((s, i) => {
        const unlocked = course.completedIds.has(s.unlockAfterLessonId);
        if (!unlocked)
          return (
            <Card key={s.id} className="flex items-center gap-3 opacity-60">
              <Lock className="size-4" />
              <div>
                <p className="font-semibold">
                  {i + 1}. {s.titlePl}
                </p>
                <p className="text-xs text-[var(--muted)]">Po lekcji: {content.lessonById.get(s.unlockAfterLessonId)?.titlePl}</p>
              </div>
            </Card>
          );
        const mine = recs.filter((r) => r.taskId === `bio-${s.id}`).sort((a, b) => a.at.localeCompare(b.at));
        return (
          <Card key={s.id} className="space-y-3">
            <h2 className="font-bold">
              {i + 1}. {s.titlePl}
            </h2>
            <p className="text-sm text-[var(--muted)]">{s.hintPl}</p>
            {s.templates.map((t) => {
              const pl = personalLine(t, profile, settings.gender);
              return (
                <div key={t.itemId} className="space-y-1">
                  {t.optional && <Badge>opcjonalnie</Badge>}
                  {pl ? (
                    <div className="rounded-xl border border-atlantic-500/40 bg-atlantic-100/50 p-3 dark:bg-atlantic-700/20">
                      <p className="font-semibold" lang="pt-PT">{pl.pt}</p>
                      {pl.phon && <Phon text={pl.phon} size="sm" />}
                      <p className="text-xs text-[var(--muted)]">„{pl.value}” wymawiasz po swojemu.</p>
                    </div>
                  ) : (
                    <PronunciationCard item={getItem(t.itemId)} variant="compact" />
                  )}
                </div>
              );
            })}
            <div className="border-t border-[var(--border)] pt-3">
              <p className="mb-2 text-sm font-medium">Powiedz tę część na głos i nagraj (zapisz, by porównać za tydzień):</p>
              <Recorder label={`Życiorys: ${s.titlePl}`} taskId={`bio-${s.id}`} onRecorded={(sec) => void logSpeaking({ taskId: `bio-${s.id}`, selfRating: 'almost', seconds: sec, context: 'lab' })} />
              {mine.length > 0 && (
                <ul className="mt-2 space-y-1 text-sm">
                  {mine.map((r, k) => (
                    <li key={r.id} className="flex items-center gap-2">
                      <Button size="sm" variant="secondary" aria-label={`Odtwórz wersję ${k + 1}`} onClick={() => void new Audio(URL.createObjectURL(r.blob)).play()}>
                        <Play className="size-3.5" /> Wersja {k + 1}
                      </Button>
                      <span className="text-xs text-[var(--muted)]">
                        {new Date(r.at).toLocaleDateString('pl-PL')} · {Math.round(r.durationMs / 1000)} s
                      </span>
                      <button type="button" aria-label="Usuń nagranie" className="focus-ring ml-auto rounded p-1" onClick={() => r.id && deleteRecording(r.id)}>
                        <Trash2 className="size-4 text-[var(--muted)]" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
        );
      })}
      <p className="text-xs text-[var(--muted)]">Wzory zdań to sprawdzone szablony z kursu — nie tłumaczymy automatycznie dowolnego tekstu. Zapis wymowy: niezweryfikowany przez native speakera.</p>
    </div>
  );
}

const stopFlag = { stop: false };
