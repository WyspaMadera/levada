import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { X } from 'lucide-react';
import { content } from '@/content/content';
import type { Exercise, Skill, SpeakingTask } from '@/content/schema';
import type { SelfRating } from '@/db/db';
import { logSpeaking, logStudy, recordResult, saveTestResult } from '@/db/repo';
import { SKILL_LABEL_PL } from '@/lib/srs';
import { ExerciseView } from '@/components/ExerciseView';
import { SpeakingTaskView } from '@/components/SpeakingTaskView';
import { MonologueTask } from '@/components/MonologueTask';
import { AnswerAttempt } from '@/components/AnswerAttempt';
import { AudioButton } from '@/components/Audio';
import { getItem, itemView } from '@/lib/items';
import { useApp } from '@/state/AppContext';
import { Button, Card, Notice, ProgressBar } from '@/components/ui';

type Mono = NonNullable<import('@/content/schema').Test['monologues']>[number];
type Step =
  | { kind: 'ex'; ex: Exercise; section: number }
  | { kind: 'speak'; task: SpeakingTask }
  | { kind: 'scn'; scenarioId: string; turn: number }
  | { kind: 'mono'; m: Mono };

export default function TestPlayer() {
  const { id = '' } = useParams();
  const test = content.tests.get(id);
  const nav = useNavigate();
  const [phase, setPhase] = useState<'intro' | 'run' | 'done'>('intro');
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<{ section: number; correct: boolean }[]>([]);
  const [speaking, setSpeaking] = useState<{ taskId: string; selfRating: SelfRating }[]>([]);
  const started = useRef(Date.now());
  const speakSec = useRef(0);
  const monoRes = useRef<{ id: string; checked: number; total: number; seconds: number }[]>([]);
  const scnRes = useRef<Record<string, SelfRating[]>>({});

  const steps = useMemo<Step[]>(() => {
    if (!test) return [];
    const ex: Step[] = test.sections.flatMap((s, si) =>
      s.exerciseIds.map((e) => content.exercises.get(e)).filter((e): e is Exercise => Boolean(e)).map((e) => ({ kind: 'ex' as const, ex: e, section: si })),
    );
    const sp: Step[] = test.speakingTaskIds.map((t) => content.speaking.get(t)).filter((t): t is SpeakingTask => Boolean(t)).map((task) => ({ kind: 'speak' as const, task }));
    const scn: Step[] = (test.scenarioIds ?? []).flatMap((id) => {
      const sc = content.scenarios.find((x) => x.id === id);
      return sc ? sc.turns.map((_, turn) => ({ kind: 'scn' as const, scenarioId: id, turn })) : [];
    });
    const mono: Step[] = (test.monologues ?? []).map((m) => ({ kind: 'mono' as const, m }));
    return [...ex, ...scn, ...sp, ...mono];
  }, [test]);

  if (!test) return <Notice tone="warn">Nie ma takiego sprawdzianu.</Notice>;

  const finish = async (finalSpeaking: typeof speaking) => {
    const sections = test.sections.map((s, si) => {
      const xs = answers.filter((a) => a.section === si);
      return { titlePl: s.titlePl, skill: s.skill, correct: xs.filter((a) => a.correct).length, total: xs.length };
    });
    const total = sections.reduce((a, s) => a + s.total, 0);
    const score = total ? sections.reduce((a, s) => a + s.correct, 0) / total : 0;
    const scenarios = Object.entries(scnRes.current).map(([id, ratings]) => ({ id, ratings }));
    await saveTestResult({ testId: test.id, score, sections, speaking: finalSpeaking, monologues: monoRes.current, scenarios });
    await logStudy('test', (Date.now() - started.current) / 1000, speakSec.current);
    setPhase('done');
  };

  if (phase === 'intro') {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">{test.titlePl}</h1>
        <p>{test.introPl}</p>
        <Card className="space-y-1 text-sm">
          {test.sections.map((s) => (
            <p key={s.titlePl}>
              • {s.titlePl} — {s.exerciseIds.length} zadań
            </p>
          ))}
          <p>• Mówienie — {test.speakingTaskIds.length} zadania (samoocena)</p>
        </Card>
        <Notice tone="info">Wynik części mówionej to Twoja samoocena — aplikacja nie ocenia automatycznie wymowy ani płynności.</Notice>
        <Button size="lg" className="w-full" onClick={() => setPhase('run')} data-testid="test-start">
          Zaczynam
        </Button>
        <Button variant="ghost" className="w-full" onClick={() => nav(-1)}>
          Nie teraz
        </Button>
      </div>
    );
  }

  if (phase === 'done') {
    const sections = test.sections.map((s, si) => {
      const xs = answers.filter((a) => a.section === si);
      return { ...s, correct: xs.filter((a) => a.correct).length, total: xs.length };
    });
    const total = sections.reduce((a, s) => a + s.total, 0);
    const score = total ? sections.reduce((a, s) => a + s.correct, 0) / total : 0;
    const weak = sections.filter((s) => s.total && s.correct / s.total < test.passThreshold);
    const remedial = test.remedialLessonIds.map((l) => content.lessonById.get(l)).filter(Boolean);
    return (
      <div className="space-y-4" data-testid="test-result">
        <h1 className="text-2xl font-bold">Wynik: {Math.round(score * 100)}%</h1>
        <p className="text-sm text-[var(--muted)]">Część pisemno-słuchowa (oceniana automatycznie).</p>
        <Card className="space-y-2">
          {sections.map((s) => (
            <div key={s.titlePl}>
              <div className="flex justify-between text-sm">
                <span>
                  {s.titlePl} <span className="text-[var(--muted)]">({SKILL_LABEL_PL[s.skill as Skill]})</span>
                </span>
                <span>
                  {s.correct}/{s.total}
                </span>
              </div>
              <ProgressBar value={s.total ? s.correct / s.total : 0} label={s.titlePl} />
            </div>
          ))}
        </Card>
        <Card className="space-y-1 text-sm">
          <p className="font-semibold">Mówienie (samoocena)</p>
          <p>
            Umiem: {speaking.filter((s) => s.selfRating === 'can').length} · Prawie: {speaking.filter((s) => s.selfRating === 'almost').length} · Nie umiem:{' '}
            {speaking.filter((s) => s.selfRating === 'cannot').length}
          </p>
          {Object.entries(scnRes.current).map(([id, rs]) => (
            <p key={id}>
              Symulacja „{content.scenarios.find((x) => x.id === id)?.titlePl}”: umiem {rs.filter((r) => r === 'can').length} z {rs.length} wymian
            </p>
          ))}
          {monoRes.current.map((m) => (
            <p key={m.id}>
              Monolog: {m.checked} z {m.total} punktów planu, {m.seconds} s mówienia
            </p>
          ))}
          <p className="text-xs text-[var(--muted)]">Wyniki mówienia to samoocena — nie są liczone do wyniku procentowego.</p>
        </Card>
        {test.kind === 'stage' && (
          <Link to="/kompetencje" className="block">
            <Button variant="outline" className="w-full">
              Zobacz mapę kompetencji
            </Button>
          </Link>
        )}
        {score >= test.passThreshold && weak.length === 0 ? (
          <Notice tone="ok">Świetnie — jesteś gotowy/gotowa na dalszy materiał.</Notice>
        ) : (
          <Notice tone="info" title="Rekomendacja">
            <p>{weak.length ? `Warto powtórzyć: ${weak.map((w) => w.titlePl.toLowerCase()).join(', ')}.` : 'Warto jeszcze utrwalić materiał.'} Możesz iść dalej — nic nie jest zablokowane.</p>
            <ul className="mt-2 space-y-1">
              {remedial.map((l) => (
                <li key={l!.id}>
                  <Link className="underline" to={`/lekcja/${l!.id}`}>
                    {l!.titlePl}
                  </Link>
                </li>
              ))}
            </ul>
          </Notice>
        )}
        <Button size="lg" className="w-full" onClick={() => nav('/')}>
          Wróć do „Dzisiaj”
        </Button>
      </div>
    );
  }

  const st = steps[i]!;
  const advance = (sp = speaking) => (i + 1 < steps.length ? setI(i + 1) : void finish(sp));
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button type="button" aria-label="Przerwij sprawdzian" className="focus-ring rounded-full p-2 hover:bg-[var(--surface-2)]" onClick={() => nav('/')}>
          <X className="size-5" />
        </button>
        <div className="flex-1">
          <p className="text-sm font-semibold">
            {test.titlePl} · {st.kind === 'ex' ? test.sections[st.section]!.titlePl : st.kind === 'scn' ? 'Symulacja rozmowy' : st.kind === 'mono' ? 'Monolog' : 'Mówienie'}
          </p>
          <ProgressBar value={i / steps.length} label="Postęp sprawdzianu" />
        </div>
      </div>
      {st.kind === 'ex' ? (
        <ExerciseView
          key={st.ex.id}
          exercise={st.ex}
          onAnswered={(o) => {
            setAnswers((xs) => [...xs, { section: st.section, correct: o.correct }]);
            void recordResult({
              itemId: o.itemId,
              skill: o.skill,
              correct: o.correct,
              self: o.self,
              context: 'test',
              exerciseId: st.ex.id,
              answer: o.given,
              mistake: o.correct ? undefined : { category: o.category, expected: o.expected, given: o.given, notePl: o.explanation },
            });
          }}
          onNext={() => advance()}
        />
      ) : st.kind === 'scn' ? (
        <ScenarioTurnStep
          key={`${st.scenarioId}-${st.turn}`}
          scenarioId={st.scenarioId}
          turn={st.turn}
          onDone={(self, seconds) => {
            speakSec.current += seconds;
            (scnRes.current[st.scenarioId] ??= []).push(self);
            advance();
          }}
        />
      ) : st.kind === 'mono' ? (
        <MonologueTask
          key={st.m.id}
          {...st.m}
          onDone={(r) => {
            speakSec.current += r.seconds;
            monoRes.current.push({ id: st.m.id, ...r });
            void logSpeaking({ taskId: st.m.id, selfRating: r.checked / r.total >= 0.7 ? 'can' : r.checked / r.total >= 0.4 ? 'almost' : 'cannot', seconds: r.seconds, context: 'test' });
            advance();
          }}
        />
      ) : (
        <SpeakingTaskView
          key={st.task.id}
          task={st.task}
          onDone={({ self, seconds }) => {
            speakSec.current += seconds;
            void logSpeaking({ taskId: st.task.id, selfRating: self, seconds, context: 'test' });
            const next = [...speaking, { taskId: st.task.id, selfRating: self }];
            setSpeaking(next);
            setTimeout(() => advance(next), 300);
          }}
        />
      )}
    </div>
  );
}

/** Jedna wymiana symulacji rozmowy w sprawdzianie. */
function ScenarioTurnStep({ scenarioId, turn, onDone }: { scenarioId: string; turn: number; onDone: (self: SelfRating, seconds: number) => void }) {
  const { settings } = useApp();
  const sc = content.scenarios.find((x) => x.id === scenarioId)!;
  const t = sc.turns[turn]!;
  const it = getItem(t.promptItemId);
  const v = itemView(it, settings.gender, t.promptFem);
  return (
    <div className="space-y-3" data-testid="test-scenario">
      {turn === 0 && <p className="text-sm text-[var(--muted)]">{sc.contextPl}</p>}
      <Card className="flex items-center gap-3">
        <AudioButton item={it} fem={v.fem} size="md" repeat={1} />
        <div>
          <p className="text-sm text-[var(--muted)]">{t.speaker}:</p>
          <p className="font-semibold" lang="pt-PT">{v.pt}</p>
        </div>
      </Card>
      <AnswerAttempt taskPl={`Twoja kolej: ${t.taskPl}`} answerItemIds={t.answerItemIds} personal={t.personal} onRated={({ self, seconds }) => onDone(self, seconds)} />
    </div>
  );
}
