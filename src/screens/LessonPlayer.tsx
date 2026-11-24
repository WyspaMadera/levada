import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { CheckCircle2, X } from 'lucide-react';
import { content } from '@/content/content';
import { lessonStudyItemIds } from '@/content/index';
import type { Exercise, SpeakingTask } from '@/content/schema';
import { db } from '@/db/db';
import { completeLesson, logSpeaking, logStudy, recordResult, setLessonStep, startLesson } from '@/db/repo';
import { getItem } from '@/lib/items';
import { scoreOutcomes, type ScoredOutcome } from '@/lib/lessonResult';
import { SKILL_LABEL_PL } from '@/lib/srs';
import { useApp } from '@/state/AppContext';
import { PronunciationCard } from '@/components/PronunciationCard';
import { DialogueView } from '@/components/DialogueView';
import { ExerciseView, type ExerciseOutcome } from '@/components/ExerciseView';
import { SpeakingTaskView } from '@/components/SpeakingTaskView';
import { Badge, Button, Card, Notice, ProgressBar, RichText, cx } from '@/components/ui';

const STEPS = ['Rozgrzewka', 'Nowe słowa', 'Prosta zasada', 'Przykłady', 'Dialog', 'Ćwiczenia', 'Mówię samodzielnie', 'Podsumowanie'] as const;

export default function LessonPlayer() {
  const { id = '' } = useParams();
  const lesson = content.lessonById.get(id);
  const nav = useNavigate();
  const { settings } = useApp();
  const saved = useLiveQuery(() => db.lessonProgress.get(id), [id]);
  const [step, setStep] = useState<number | null>(null);
  const [wordIdx, setWordIdx] = useState(0);
  const [exIdx, setExIdx] = useState(0);
  const [spIdx, setSpIdx] = useState(0);
  const [outcomes, setOutcomes] = useState<ScoredOutcome[]>([]);
  const [completed, setCompleted] = useState(false);
  const startedAt = useRef(Date.now());
  const speakingSec = useRef(0);
  const logged = useRef(false);

  useEffect(() => {
    if (lesson) void startLesson(lesson.id);
  }, [lesson]);
  useEffect(() => {
    if (step === null && saved !== undefined) {
      const s = saved && saved.status === 'started' ? Math.min(saved.step, 4) : 0;
      setStep(s);
    }
  }, [saved, step]);
  useEffect(() => {
    if (lesson && step !== null && step < 7) void setLessonStep(lesson.id, step);
    window.scrollTo({ top: 0 });
  }, [lesson, step]);

  const exercises = useMemo(() => (lesson?.exerciseIds ?? []).map((e) => content.exercises.get(e)).filter((e): e is Exercise => Boolean(e)), [lesson]);
  const tasks = useMemo(() => (lesson?.speakingTaskIds ?? []).map((s) => content.speaking.get(s)).filter((s): s is SpeakingTask => Boolean(s)), [lesson]);

  // logowanie czasu nauki przy wyjściu
  useEffect(
    () => () => {
      if (!logged.current) void logStudy('lesson', (Date.now() - startedAt.current) / 1000, speakingSec.current);
    },
    [],
  );

  if (!lesson) {
    return (
      <div className="space-y-4 py-10">
        <Notice tone="warn" title="Nie ma takiej lekcji">
          Ta lekcja nie istnieje albo nie jest jeszcze gotowa.
        </Notice>
        <Link to="/szlak" className="underline">Wróć do szlaku</Link>
      </div>
    );
  }
  if (step === null) return <p className="py-10 text-center text-[var(--muted)]">Ładowanie lekcji…</p>;

  const sound = content.soundById.get(lesson.warmup.soundId);
  const newItems = lesson.newItemIds.map(getItem);
  const go = (s: number) => setStep(Math.max(0, Math.min(7, s)));

  const finishLesson = async (final: ScoredOutcome[]) => {
    const score = scoreOutcomes(final);
    const study = lessonStudyItemIds(content, lesson);
    const sentences = study.filter((i) => getItem(i).kind === 'sentence');
    await completeLesson({ lessonId: lesson.id, score, newItemIds: lesson.newItemIds, studyItemIds: study, sentenceItemIds: sentences });
    setCompleted(true);
  };

  const onExerciseAnswered = (ex: Exercise, o: ExerciseOutcome) => {
    setOutcomes((xs) => [...xs, { kind: ex.type === 'recallSay' ? 'self' : 'auto', correct: o.correct, self: o.self, skill: o.skill, exerciseId: ex.id, itemId: o.itemId, expected: o.expected, given: o.given }]);
    if (o.speakingSeconds) speakingSec.current += o.speakingSeconds;
    void recordResult({
      itemId: o.itemId,
      skill: o.skill,
      correct: o.correct,
      self: o.self,
      context: 'lesson',
      exerciseId: ex.id,
      lessonId: lesson.id,
      answer: o.given,
      mistake: o.correct ? undefined : { category: o.category, expected: o.expected, given: o.given, notePl: o.explanation },
    });
  };

  const body = (() => {
    switch (step) {
      case 0:
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Rozgrzewka: {sound?.titlePl}</h2>
            <p>{lesson.warmup.textPl}</p>
            {lesson.warmup.itemIds.map((i) => (
              <PronunciationCard key={i} item={getItem(i)} variant="compact" />
            ))}
            {sound && (
              <Card className="text-sm">
                <p>{sound.summaryPl}</p>
                <Link className="mt-1 inline-block underline" to={`/dzwieki/${sound.id}`}>
                  Więcej w laboratorium „Dźwięki”
                </Link>
              </Card>
            )}
          </div>
        );
      case 1: {
        const it = newItems[wordIdx];
        if (!it) return <Notice>Ta lekcja nie wprowadza nowych słów — to powtórka.</Notice>;
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Nowe słowa</h2>
              <span className="text-sm text-[var(--muted)]">
                {wordIdx + 1} / {newItems.length}
              </span>
            </div>
            <p className="text-sm text-[var(--muted)]">Posłuchaj → spójrz na zapis wymowy → powtórz na głos 2–3 razy.</p>
            <PronunciationCard key={it.id} item={it} showRecorder />
            <div className="flex gap-1" aria-hidden>
              {newItems.map((_, i) => (
                <span key={i} className={cx('h-1 flex-1 rounded-full', i <= wordIdx ? 'bg-atlantic-600' : 'bg-[var(--border)]')} />
              ))}
            </div>
          </div>
        );
      }
      case 2:
        return lesson.grammar ? (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">{lesson.grammar.titlePl}</h2>
            <RichText text={lesson.grammar.explanationPl} />
            {lesson.grammar.table && (
              <table className="w-full overflow-hidden rounded-xl border border-[var(--border)] text-sm">
                <tbody>
                  {lesson.grammar.table.map(([pt, pl]) => (
                    <tr key={pt} className="border-b border-[var(--border)] last:border-0">
                      <td className="p-2 font-semibold" lang="pt-PT">{pt}</td>
                      <td className="p-2 text-[var(--muted)]">{pl}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {lesson.grammar.tableItemIds && (
              <Card className="divide-y divide-[var(--border)] py-1">
                {lesson.grammar.tableItemIds.map((i) => (
                  <PronunciationCard key={i} item={getItem(i)} variant="row" />
                ))}
              </Card>
            )}
          </div>
        ) : (
          <Notice>W tej lekcji nie ma nowej zasady.</Notice>
        );
      case 3:
        return (
          <div className="space-y-3">
            <h2 className="text-xl font-bold">Przykłady</h2>
            {(lesson.grammar?.exampleIds ?? []).map((i) => (
              <PronunciationCard key={i} item={getItem(i)} variant="compact" />
            ))}
          </div>
        );
      case 4:
        return (
          <div className="space-y-3">
            {lesson.dialogueIds.map((d) => {
              const dl = content.dialogues.get(d);
              return dl ? (
                <div key={d}>
                  <h2 className="mb-2 text-xl font-bold">Dialog: {dl.titlePl}</h2>
                  <DialogueView dialogue={dl} />
                </div>
              ) : null;
            })}
          </div>
        );
      case 5: {
        const ex = exercises[exIdx];
        if (!ex) return <Notice>Brak ćwiczeń.</Notice>;
        return (
          <div className="space-y-3">
            <p className="text-sm text-[var(--muted)]">
              Ćwiczenie {exIdx + 1} z {exercises.length}
            </p>
            <ExerciseView
              key={ex.id}
              exercise={ex}
              onAnswered={(o) => onExerciseAnswered(ex, o)}
              onNext={() => (exIdx + 1 < exercises.length ? setExIdx(exIdx + 1) : go(6))}
              nextLabel={exIdx + 1 < exercises.length ? 'Dalej' : 'Do mówienia'}
            />
          </div>
        );
      }
      case 6: {
        const t = tasks[spIdx];
        if (!t) return <Notice>Brak zadań mówienia w tej lekcji.</Notice>;
        return (
          <div className="space-y-3">
            <p className="text-sm text-[var(--muted)]">
              Mówię samodzielnie · zadanie {spIdx + 1} z {tasks.length}
            </p>
            <SpeakingTaskView
              key={t.id}
              task={t}
              onDone={({ self, seconds }) => {
                speakingSec.current += seconds;
                void logSpeaking({ taskId: t.id, selfRating: self, seconds, context: 'lesson' });
                setOutcomes((xs) => [...xs, { kind: 'self', correct: self !== 'cannot', self, skill: 'speaking', exerciseId: t.id, itemId: t.modelItemIds[0], expected: '', given: self }]);
                // model odpowiedzi trafia do powtórek mówienia
                for (const m of t.modelItemIds.slice(0, 2))
                  void recordResult({ itemId: m, skill: 'speaking', correct: self !== 'cannot', self, context: 'lesson', exerciseId: t.id, lessonId: lesson.id });
                setTimeout(() => (spIdx + 1 < tasks.length ? setSpIdx(spIdx + 1) : go(7)), 350);
              }}
            />
          </div>
        );
      }
      default:
        return <Summary lessonId={lesson.id} outcomes={outcomes} completed={completed} onFinish={finishLesson} />;
    }
  })();

  const nextDisabled = step === 5 || step === 6;
  const advance = () => {
    if (step === 1 && wordIdx + 1 < newItems.length) {
      setWordIdx(wordIdx + 1);
      return;
    }
    if (step === 3 && lesson.dialogueIds.length === 0) return go(5);
    if (step === 1 && !lesson.grammar) return go(3);
    go(step + 1);
  };
  const back = () => {
    if (step === 1 && wordIdx > 0) return setWordIdx(wordIdx - 1);
    go(step - 1);
  };

  return (
    <div className="space-y-4" data-testid="lesson-player">
      <div className="sticky top-0 z-10 -mx-4 space-y-2 bg-[var(--bg)]/95 px-4 pb-2 pt-1 backdrop-blur">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="focus-ring rounded-full p-2 hover:bg-[var(--surface-2)]"
            aria-label="Zamknij lekcję (postęp zostanie zapisany)"
            onClick={() => nav('/')}
          >
            <X className="size-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{lesson.titlePl}</p>
            <p className="text-xs text-[var(--muted)]">
              Krok {step + 1}/8 · {STEPS[step]}
            </p>
          </div>
          {lesson.status !== 'published' && <Badge tone="warn" title="Lekcja przygotowana starannie, ale jeszcze bez weryfikacji przez native speakera.">w weryfikacji</Badge>}
        </div>
        <ProgressBar value={(step + (step === 5 ? exIdx / Math.max(1, exercises.length) : 0)) / 7} label="Postęp lekcji" />
      </div>

      {step === 0 && (
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">{lesson.titlePl}</h1>
          {lesson.subtitlePl && <p className="text-[var(--muted)]">{lesson.subtitlePl}</p>}
          <ul className="mt-2 list-inside list-disc text-sm text-[var(--muted)]">
            {lesson.goals.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        </div>
      )}

      {body}

      {step < 7 && !nextDisabled && (
        <div className="flex gap-2 pt-2">
          {step > 0 && (
            <Button variant="secondary" onClick={back}>
              Wstecz
            </Button>
          )}
          <Button size="lg" className="flex-1" onClick={advance} data-testid="lesson-next">
            Dalej
          </Button>
        </div>
      )}
      {(step === 5 || step === 6) && settings && (
        <div className="flex justify-between pt-2 text-sm">
          <button type="button" className="focus-ring underline text-[var(--muted)]" onClick={() => go(step - 1)}>
            Wróć do poprzedniego kroku
          </button>
          {step === 6 && (
            <button type="button" className="focus-ring underline text-[var(--muted)]" onClick={() => go(7)}>
              Pomiń mówienie
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Summary({ lessonId, outcomes, completed, onFinish }: { lessonId: string; outcomes: ScoredOutcome[]; completed: boolean; onFinish: (o: ScoredOutcome[]) => Promise<void> }) {
  const lesson = content.lessonById.get(lessonId)!;
  const nav = useNavigate();
  const started = useRef(false);
  useEffect(() => {
    if (!started.current) {
      started.current = true;
      void onFinish(outcomes);
    }
  }, [onFinish, outcomes]);
  const score = scoreOutcomes(outcomes);
  const wrong = outcomes.filter((o) => !o.correct && o.kind === 'auto');
  const weakSkills = [...new Set(outcomes.filter((o) => !o.correct).map((o) => o.skill))];
  const study = lessonStudyItemIds(content, lesson);
  const nextLesson = content.lessons.find((l) => l.week * 10 + l.day > lesson.week * 10 + lesson.day && l.status !== 'draft');
  const auto = outcomes.filter((o) => o.kind === 'auto');

  return (
    <div className="space-y-4" data-testid="lesson-summary">
      <div className="flex items-center gap-3">
        <CheckCircle2 className="size-10 text-laurel-600" />
        <div>
          <h2 className="text-xl font-bold">Lekcja ukończona</h2>
          <p className="text-sm text-[var(--muted)]">
            {auto.length > 0 ? `Ćwiczenia: ${auto.filter((o) => o.correct).length}/${auto.length} poprawnie` : 'Bez ćwiczeń ocenianych automatycznie'}
            {outcomes.length > 0 && ` · wynik lekcji ${Math.round(score * 100)}%`}
          </p>
        </div>
      </div>
      <Card>
        <p className="mb-2 font-semibold">Co umiem powiedzieć</p>
        <ul className="list-inside list-disc space-y-1 text-sm">
          {lesson.canDo.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </Card>
      <Card>
        <p className="mb-1 font-semibold">Czego się nauczyłem</p>
        <p className="text-sm text-[var(--muted)]">{lesson.goals.join(' · ')}</p>
        <div className="mt-2 divide-y divide-[var(--border)]">
          {lesson.newItemIds.map((i) => (
            <PronunciationCard key={i} item={getItem(i)} variant="row" />
          ))}
        </div>
      </Card>
      <Card>
        <p className="mb-1 font-semibold">Co wymaga dalszej pracy</p>
        {wrong.length === 0 && weakSkills.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Bez błędów w tej lekcji. Utrwalimy materiał w powtórkach.</p>
        ) : (
          <>
            {weakSkills.length > 0 && <p className="text-sm">Obszary: {weakSkills.map((s) => SKILL_LABEL_PL[s]).join(', ')}.</p>}
            <ul className="mt-1 space-y-1 text-sm">
              {wrong.slice(0, 6).map((w, i) => (
                <li key={i}>
                  ✗ <span className="text-[var(--muted)]">Twoja odpowiedź:</span> {w.given} → <strong lang="pt-PT">{w.expected}</strong>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-[var(--muted)]">Błędy trafiły do „Zeszytu błędów”.</p>
          </>
        )}
      </Card>
      <Notice tone="ok">{completed ? `Do powtórek trafiło ${study.length} elementów (słowa, przykłady, zdania z dialogu).` : 'Zapisuję postęp…'}</Notice>
      {score < 0.6 && outcomes.length > 3 && (
        <Notice tone="info">Ta lekcja była trudna — warto ją powtórzyć jutro, zanim pójdziesz dalej. Nic nie jest zablokowane.</Notice>
      )}
      <div className="grid gap-2">
        <Button size="lg" onClick={() => nav('/')} disabled={!completed} data-testid="lesson-finish">
          Zakończ
        </Button>
        {nextLesson && (
          <Button variant="secondary" onClick={() => nav(`/lekcja/${nextLesson.id}`)} disabled={!completed}>
            Następna lekcja: {nextLesson.titlePl}
          </Button>
        )}
        {lesson.testId && (
          <Button variant="outline" onClick={() => nav(`/sprawdzian/${lesson.testId}`)} disabled={!completed}>
            Sprawdzian tygodnia
          </Button>
        )}
      </div>
    </div>
  );
}
