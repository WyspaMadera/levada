import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { BookOpen, CheckCircle2, Lock, Pause, Play, X } from 'lucide-react';
import { content } from '@/content/content';
import { readingCoverage } from '@/content/coverage';
import type { LearningItem, Reading } from '@/content/schema';
import { db } from '@/db/db';
import { logStudy, recordResult } from '@/db/repo';
import { speakText, stopAll } from '@/lib/audio';
import { getItem, itemView } from '@/lib/items';
import { useApp } from '@/state/AppContext';
import { useCourse } from '@/state/course';
import { AudioButton, usePlayer } from '@/components/Audio';
import { Phon } from '@/components/Phon';
import { SaveButton } from '@/components/SaveButton';
import { Badge, Button, Card, Notice, PageHeader, cx } from '@/components/ui';

/** Słownik form: słowa (elementy jednowyrazowe) z całego kursu → znaczenie. */
function wordMeanings(): Map<string, { pl: string; item: LearningItem }> {
  const m = new Map<string, { pl: string; item: LearningItem }>();
  for (const it of content.items.values()) {
    if (it.kind !== 'word') continue;
    for (const [pt, pl] of [
      [it.pt, it.pl],
      [it.ptFem, it.plFem ?? it.pl],
    ] as const) {
      if (pt && !pt.includes(' ')) m.set(pt.toLowerCase(), { pl, item: it });
    }
  }
  return m;
}

function useReadDone() {
  const rows = useLiveQuery(() => db.attempts.where('exerciseId').startsWith('reading-').toArray(), []) ?? [];
  return new Set(rows.map((r) => r.exerciseId.split('|')[0]!.replace('reading-', '')));
}

export function ReadingsList() {
  const course = useCourse();
  const done = useReadDone();
  return (
    <div className="space-y-3">
      <PageHeader title="Czytam i rozumiem" subtitle="Krótkie teksty z poznanego słownictwa" back="/wiecej" />
      {content.readings.length === 0 && <Notice tone="info">Czytanki są w przygotowaniu.</Notice>}
      {content.readings.map((r) => {
        const open = course.completedIds.has(r.unlockAfterLessonId);
        const lesson = content.lessonById.get(r.unlockAfterLessonId);
        return open ? (
          <Link key={r.id} to={`/czytanki/${r.id}`} className="block">
            <Card className="flex items-center gap-3">
              <BookOpen className="size-6 text-atlantic-600" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold" lang="pt-PT">{r.titlePt}</p>
                <p className="text-xs text-[var(--muted)]">
                  {r.titlePl} · {r.sentenceItemIds.length} zdań
                </p>
              </div>
              {done.has(r.id) ? <CheckCircle2 className="size-5 text-laurel-600" aria-label="przeczytane" /> : <Badge>{r.level}</Badge>}
            </Card>
          </Link>
        ) : (
          <Card key={r.id} className="flex items-center gap-3 opacity-60">
            <Lock className="size-4" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{r.titlePl}</p>
              <p className="text-xs text-[var(--muted)]">Po lekcji: {lesson?.titlePl}</p>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

export default function ReadingView() {
  const { id = '' } = useParams();
  const r = content.readings.find((x) => x.id === id);
  if (!r) return <Notice tone="warn">Nie ma takiej czytanki.</Notice>;
  return <ReadingBody r={r} />;
}

function ReadingBody({ r }: { r: Reading }) {
  const { settings, audio } = useApp();
  const { play } = usePlayer();
  const [showPron, setShowPron] = useState(false);
  const [showPl, setShowPl] = useState(false);
  const [word, setWord] = useState<{ form: string; sentence: string } | null>(null);
  const [playing, setPlaying] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [started] = useState(() => Date.now());
  const cov = useMemo(() => readingCoverage(content, r), [r]);
  const meanings = useMemo(wordMeanings, []);
  const glossary = useMemo(() => new Map(r.glossary.map((g) => [g.form.toLowerCase(), g])), [r]);
  const items = r.sentenceItemIds.map(getItem);

  const playAll = async () => {
    for (let i = 0; i < items.length; i++) {
      setPlaying(i);
      const res = await play(items[i]!, { repeat: 1, key: `rd-${i}` });
      if (!res.ok) break;
      await new Promise((x) => setTimeout(x, 500));
      if (playingRef.stop) break;
    }
    playingRef.stop = false;
    setPlaying(null);
  };

  const meaningOf = (form: string) => {
    const g = glossary.get(form);
    if (g) return { pl: g.pl, note: g.notePl, item: g.itemId ? content.items.get(g.itemId) : undefined };
    const m = meanings.get(form) ?? (form.endsWith('s') ? meanings.get(form.slice(0, -1)) : undefined);
    return m ? { pl: m.pl, note: undefined, item: m.item } : null;
  };

  return (
    <div className="space-y-4" data-testid="reading">
      <PageHeader title={r.titlePt} subtitle={`${r.titlePl} · ${r.level}`} back="/czytanki" />
      <p className="text-xs text-[var(--muted)]">
        Szacunkowo znasz ok. {Math.round(cov.ratio * 100)}% słów z lekcji (formy odmienione rozpoznajemy częściowo). Dotknij dowolnego słowa, aby zobaczyć znaczenie.
      </p>
      <div className="flex flex-wrap gap-2">
        {audio?.choice.voice && (
          <Button
            size="sm"
            variant={playing !== null ? 'danger' : 'primary'}
            onClick={() => {
              if (playing !== null) {
                playingRef.stop = true;
                stopAll();
                setPlaying(null);
              } else void playAll();
            }}
          >
            {playing !== null ? <Pause className="size-4" /> : <Play className="size-4" />} {playing !== null ? 'Zatrzymaj' : 'Odtwórz cały tekst'}
          </Button>
        )}
        <Button size="sm" variant="secondary" aria-pressed={showPron} onClick={() => setShowPron((x) => !x)}>
          {showPron ? 'Ukryj wymowę' : 'Pokaż wymowę'}
        </Button>
        <Button size="sm" variant="secondary" aria-pressed={showPl} onClick={() => setShowPl((x) => !x)}>
          {showPl ? 'Ukryj tłumaczenie' : 'Pokaż tłumaczenie'}
        </Button>
      </div>
      <Card className="space-y-3">
        {items.map((it, i) => {
          const v = itemView(it, settings.gender);
          return (
            <div key={it.id} className={cx('rounded-xl p-1', playing === i && 'bg-atlantic-100/60 dark:bg-atlantic-700/25')}>
              <div className="flex items-start gap-2">
                <AudioButton item={it} size="sm" repeat={1} />
                <p className="flex-1 text-lg leading-relaxed" lang="pt-PT">
                  {v.pt.split(/(\s+)/).map((tok, k) => {
                    const form = tok.toLowerCase().replace(/[^\p{L}-]/gu, '');
                    if (!form) return <span key={k}>{tok}</span>;
                    return (
                      <button
                        key={k}
                        type="button"
                        className={cx('focus-ring rounded px-0.5 hover:bg-amber-100 dark:hover:bg-amber-700/30', glossary.has(form) && 'underline decoration-dotted decoration-amber-700 underline-offset-4')}
                        onClick={() => setWord({ form, sentence: it.id })}
                      >
                        {tok}
                      </button>
                    );
                  })}
                </p>
                <SaveButton itemId={it.id} source="reading" />
              </div>
              {showPron && v.pron.plSlow && <Phon text={v.pron.plSlow} size="sm" className="ml-11 block text-[var(--muted)]" />}
              {showPl && <p className="ml-11 text-sm text-[var(--muted)]">{v.pl}</p>}
            </div>
          );
        })}
      </Card>
      <p className="text-xs text-[var(--muted)]">Wymowa zdań: zapis niezweryfikowany przez native speakera.</p>

      <section className="space-y-3" aria-label="Pytania">
        <h2 className="font-bold">Czy rozumiesz?</h2>
        {r.questions.map((q, qi) => {
          const chosen = answers[qi];
          return (
            <Card key={qi} className="space-y-2">
              <p className="font-medium">{q.questionPl}</p>
              <div className="grid gap-2">
                {q.options.map((o, oi) => (
                  <button
                    key={oi}
                    type="button"
                    disabled={chosen !== undefined}
                    onClick={() => {
                      setAnswers((a) => ({ ...a, [qi]: oi }));
                      void recordResult({ skill: 'recognition', correct: oi === q.answerIndex, context: 'review', exerciseId: `reading-${r.id}|q${qi}`, schedule: false });
                      if (Object.keys(answers).length + 1 === r.questions.length) void logStudy('lesson', (Date.now() - started) / 1000);
                    }}
                    className={cx(
                      'focus-ring rounded-xl border-2 px-3 py-2 text-left',
                      chosen === undefined && 'border-[var(--border)]',
                      chosen !== undefined && oi === q.answerIndex && 'border-laurel-600 bg-laurel-100 dark:bg-laurel-700/30',
                      chosen === oi && oi !== q.answerIndex && 'border-coral-600 bg-coral-100 dark:bg-coral-600/20',
                    )}
                  >
                    {o}
                  </button>
                ))}
              </div>
              {chosen !== undefined && q.explanationPl && <p className="text-sm text-[var(--muted)]">{q.explanationPl}</p>}
            </Card>
          );
        })}
      </section>

      {word && (
        <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-xl p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]" role="dialog" aria-label={`Słowo: ${word.form}`}>
          <Card className="space-y-2 shadow-xl">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xl font-bold" lang="pt-PT">{word.form}</p>
              <div className="flex items-center gap-1">
                {audio?.choice.voice && (
                  <Button size="sm" variant="secondary" aria-label="Odsłuchaj słowo" onClick={() => void speakText(word.form, audio.choice.voice, settings.playbackRate)}>
                    <Play className="size-4" />
                  </Button>
                )}
                <button type="button" aria-label="Zamknij" className="focus-ring rounded-full p-2" onClick={() => setWord(null)}>
                  <X className="size-5" />
                </button>
              </div>
            </div>
            {(() => {
              const m = meaningOf(word.form);
              if (!m) return <p className="text-sm text-[var(--muted)]">To słowo znasz z lekcji — zobacz tłumaczenie całego zdania: „{itemView(getItem(word.sentence), settings.gender).pl}”.</p>;
              return (
                <>
                  <p>{m.pl}</p>
                  {m.note && <p className="text-sm text-[var(--muted)]">{m.note}</p>}
                  {m.item && m.item.pronunciation.plSlow && (
                    <p className="text-sm">
                      {m.item.pt !== word.form && <span className="text-[var(--muted)]">od: </span>}
                      <span lang="pt-PT">{m.item.pt}</span> · <Phon text={m.item.pronunciation.plSlow} size="sm" />
                    </p>
                  )}
                </>
              );
            })()}
            <p className="text-xs text-[var(--muted)]">Odsłuch pojedynczego słowa: głos urządzenia.</p>
          </Card>
        </div>
      )}
    </div>
  );
}

const playingRef = { stop: false };
