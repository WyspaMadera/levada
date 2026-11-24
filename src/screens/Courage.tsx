import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Play, Shuffle, Timer } from 'lucide-react';
import { content } from '@/content/content';
import { db, type SelfRating } from '@/db/db';
import { logStudy, saveConversation, saveRecording } from '@/db/repo';
import { recordingSupported, startRecording, type RecordingHandle } from '@/lib/recorder';
import { getItem, itemView } from '@/lib/items';
import { useApp } from '@/state/AppContext';
import { AudioButton } from '@/components/Audio';
import { Button, Card, Notice, PageHeader } from '@/components/ui';

const SECONDS = 60;

/** Minuta odwagi: 60 sekund mówienia na znany temat, bez przygotowania. */
export default function Courage() {
  const { settings } = useApp();
  const done = useLiveQuery(() => db.lessonProgress.where('status').equals('completed').toArray(), []);
  const history = useLiveQuery(() => db.recordings.filter((r) => (r.taskId ?? '').startsWith('courage')).toArray(), []) ?? [];
  const open = useMemo(() => content.questions.filter((q) => done?.some((d) => d.lessonId === q.unlockAfterLessonId)), [done]);
  const [qi, setQi] = useState(0);
  const [phase, setPhase] = useState<'ready' | 'talking' | 'rate' | 'done'>('ready');
  const [left, setLeft] = useState(SECONDS);
  const [err, setErr] = useState<string | null>(null);
  const handle = useRef<RecordingHandle | null>(null);
  const blob = useRef<{ blob: Blob; mime: string; durationMs: number } | null>(null);
  const q = open.length ? open[qi % open.length] : undefined;

  useEffect(() => {
    if (phase !== 'talking') return;
    if (left <= 0) {
      void finishTalking();
      return;
    }
    const t = setTimeout(() => setLeft((x) => x - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, left]);

  useEffect(() => () => handle.current?.cancel(), []);

  const start = async () => {
    setErr(null);
    setLeft(SECONDS);
    blob.current = null;
    if (recordingSupported()) {
      try {
        handle.current = await startRecording(SECONDS * 1000 + 2000);
      } catch {
        setErr('Bez mikrofonu — mów na głos, licznik i tak działa.');
      }
    }
    setPhase('talking');
  };
  const finishTalking = async () => {
    if (handle.current) {
      blob.current = await handle.current.stop();
      handle.current = null;
    }
    setPhase('rate');
  };
  const rate = async (self: SelfRating) => {
    const seconds = SECONDS - Math.max(0, left);
    if (blob.current) await saveRecording({ taskId: `courage-${q?.id ?? 'x'}`, label: `Minuta odwagi: ${q ? getItem(q.questionItemId).pt : ''}`, ...blob.current });
    await saveConversation({ kind: 'courage', refId: q?.id, turns: [{ speaker: 'other', itemId: q?.questionItemId }, { speaker: 'learner', self }], seconds, speakingSeconds: seconds });
    await logStudy('speaking', seconds, seconds);
    setPhase('done');
  };

  if (!done) return null;
  if (!q)
    return (
      <div className="space-y-4">
        <PageHeader title="Minuta odwagi" back="/wiecej" />
        <Notice tone="info">Tematy pojawią się po pierwszych lekcjach.</Notice>
      </div>
    );
  const it = getItem(q.questionItemId);
  const v = itemView(it, settings.gender);

  return (
    <div className="space-y-4" data-testid="courage">
      <PageHeader title="Minuta odwagi" subtitle="60 sekund mówienia bez przygotowania. Błędy są w porządku — liczy się mówienie." back="/wiecej" />
      <Card className="space-y-3">
        <p className="text-sm text-[var(--muted)]">Temat: {q.topicPl}</p>
        <div className="flex items-center gap-3">
          <AudioButton item={it} size="md" repeat={1} />
          <div>
            <p className="text-xl font-semibold" lang="pt-PT">{v.pt}</p>
            <p className="text-sm text-[var(--muted)]">{v.pl}</p>
          </div>
        </div>
        <p className="text-sm">Mów jak najdłużej: odpowiedz, dodaj szczegół, użyj „e”, „mas”, „também”. Przydatne: {q.usefulItemIds.map((u) => getItem(u).pt).join(', ')}.</p>
        {phase === 'ready' && (
          <div className="flex gap-2">
            <Button size="lg" className="flex-1" onClick={start}>
              <Timer className="size-5" /> Start — 60 s
            </Button>
            <Button variant="secondary" aria-label="Inny temat" onClick={() => setQi((x) => x + 1 + Math.floor(Math.random() * 3))}>
              <Shuffle className="size-5" />
            </Button>
          </div>
        )}
        {phase === 'talking' && (
          <div className="space-y-2 text-center">
            <p className="text-5xl font-bold tabular-nums" aria-live="polite">{left}</p>
            <Button variant="secondary" onClick={finishTalking}>
              Skończyłem/am wcześniej
            </Button>
          </div>
        )}
        {phase === 'rate' && (
          <div className="space-y-2">
            {blob.current && (
              <Button variant="secondary" onClick={() => void new Audio(URL.createObjectURL(blob.current!.blob)).play()}>
                <Play className="size-4" /> Odsłuchaj siebie
              </Button>
            )}
            <p className="font-medium">Jak poszło?</p>
            <div className="grid grid-cols-3 gap-2">
              <Button variant="success" onClick={() => rate('can')}>Mówiłem/am płynnie</Button>
              <Button variant="secondary" onClick={() => rate('almost')}>Z przerwami</Button>
              <Button variant="secondary" onClick={() => rate('cannot')}>Prawie nic</Button>
            </div>
          </div>
        )}
        {phase === 'done' && (
          <div className="space-y-2">
            <Notice tone="ok">Brawo za odwagę! Nagranie zapisane na urządzeniu — za tydzień porównaj, jak brzmisz.</Notice>
            <Button
              className="w-full"
              onClick={() => {
                setQi((x) => x + 1);
                setPhase('ready');
              }}
            >
              Następny temat
            </Button>
          </div>
        )}
        {err && <p className="text-sm text-[var(--muted)]">{err}</p>}
      </Card>
      {history.length > 0 && (
        <Card className="space-y-1">
          <h2 className="font-bold">Twoje minuty odwagi</h2>
          {[...history].reverse().slice(0, 10).map((r) => (
            <div key={r.id} className="flex items-center gap-2 text-sm">
              <Button size="sm" variant="secondary" aria-label="Odtwórz" onClick={() => void new Audio(URL.createObjectURL(r.blob)).play()}>
                <Play className="size-3.5" />
              </Button>
              <span className="min-w-0 flex-1 truncate" lang="pt-PT">{r.label.replace('Minuta odwagi: ', '')}</span>
              <span className="text-xs text-[var(--muted)]">
                {new Date(r.at).toLocaleDateString('pl-PL')} · {Math.round(r.durationMs / 1000)} s
              </span>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
