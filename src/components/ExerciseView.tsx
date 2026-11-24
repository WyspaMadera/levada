import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Eye, RotateCcw, X } from 'lucide-react';
import { EXERCISE_SKILL, type Exercise, type MistakeCategory, type Skill } from '@/content/schema';
import { acceptedPt, getItem, itemView } from '@/lib/items';
import { judgeAnswer, normalizeAnswer, shuffle } from '@/lib/answers';
import type { SelfRating } from '@/db/db';
import { useApp } from '@/state/AppContext';
import { AudioButton, useAudioAvailable, usePlayer } from './Audio';
import { Phon } from './Phon';
import { PronunciationCard } from './PronunciationCard';
import { Recorder } from './Recorder';
import { Button, Notice, cx } from './ui';

export type ExerciseOutcome = {
  correct: boolean;
  self?: SelfRating;
  itemId?: string;
  skill: Skill;
  given: string;
  expected: string;
  category: MistakeCategory;
  explanation?: string;
  speakingSeconds?: number;
};

const DEFAULT_CATEGORY: Record<Skill, MistakeCategory> = {
  listening: 'listening',
  recognition: 'meaning',
  recall: 'vocabulary',
  building: 'building',
  speaking: 'building',
};

const SPECIAL = ['ã', 'õ', 'ç', 'á', 'é', 'ê', 'ó', 'ô', 'í', 'ú', 'à', 'â'];

function targetOf(ex: Exercise): string | undefined {
  switch (ex.type) {
    case 'fillGap':
      return ex.fullItemId;
    case 'minimalPair':
      return undefined;
    default:
      return ex.targetItemId;
  }
}

const SKILL_HINT: Record<Exercise['type'], string> = {
  listenChoose: 'Słuchanie',
  minimalPair: 'Słuchanie — para minimalna',
  readChoose: 'Rozpoznawanie',
  recallChoose: 'Przypominanie',
  typeAnswer: 'Pisanie z pamięci',
  recallSay: 'Mówienie',
  buildSentence: 'Budowanie zdania',
  transform: 'Jedno zdanie — wiele możliwości',
  fillGap: 'Uzupełnij lukę',
};

export function ExerciseView({
  exercise,
  onAnswered,
  onNext,
  nextLabel = 'Dalej',
  skillOverride,
}: {
  exercise: Exercise;
  onAnswered: (o: ExerciseOutcome) => void;
  onNext: () => void;
  nextLabel?: string;
  skillOverride?: Skill;
}) {
  const { settings } = useApp();
  const skill = skillOverride ?? EXERCISE_SKILL[exercise.type];
  const [outcome, setOutcome] = useState<ExerciseOutcome | null>(null);
  const answered = outcome !== null;

  const finish = (o: Omit<ExerciseOutcome, 'skill' | 'category' | 'itemId'> & { itemId?: string; category?: MistakeCategory }) => {
    if (answered) return;
    const full: ExerciseOutcome = {
      ...o,
      skill,
      itemId: o.itemId ?? targetOf(exercise),
      category: o.category ?? exercise.mistakeCategory ?? DEFAULT_CATEGORY[skill],
      explanation: o.explanation ?? exercise.explanationPl,
    };
    setOutcome(full);
    onAnswered(full);
  };

  const g = settings.gender;
  const prompt = exercise.promptPl;

  return (
    <div className="space-y-4" data-testid="exercise" data-type={exercise.type}>
      <p className="text-xs font-semibold uppercase tracking-wide text-atlantic-700 dark:text-atlantic-100">{SKILL_HINT[exercise.type]}</p>
      {exercise.type === 'listenChoose' || exercise.type === 'readChoose' || exercise.type === 'recallChoose' ? (
        <ChoiceBody exercise={exercise} gender={g} prompt={prompt} answered={answered} finish={finish} />
      ) : exercise.type === 'minimalPair' ? (
        <MinimalPairBody exercise={exercise} gender={g} prompt={prompt} answered={answered} finish={finish} />
      ) : exercise.type === 'fillGap' ? (
        <FillGapBody exercise={exercise} prompt={prompt} answered={answered} finish={finish} />
      ) : exercise.type === 'buildSentence' || exercise.type === 'transform' ? (
        <BuildBody exercise={exercise} gender={g} prompt={prompt} answered={answered} finish={finish} />
      ) : exercise.type === 'typeAnswer' ? (
        <TypeBody exercise={exercise} gender={g} prompt={prompt} answered={answered} finish={finish} />
      ) : (
        <SayBody exercise={exercise} gender={g} prompt={prompt} answered={answered} finish={finish} />
      )}

      {outcome && (
        <Feedback outcome={outcome} exercise={exercise}>
          <Button size="lg" className="w-full" onClick={onNext} autoFocus>
            {nextLabel}
          </Button>
        </Feedback>
      )}
    </div>
  );
}

type BodyProps<T extends Exercise['type']> = {
  exercise: Extract<Exercise, { type: T }>;
  gender?: 'm' | 'f';
  prompt?: string;
  answered: boolean;
  finish: (o: { correct: boolean; given: string; expected: string; self?: SelfRating; explanation?: string; itemId?: string; speakingSeconds?: number }) => void;
};

function Feedback({ outcome, exercise, children }: { outcome: ExerciseOutcome; exercise: Exercise; children: React.ReactNode }) {
  const target = outcome.itemId ? getItem(outcome.itemId) : undefined;
  const isSay = exercise.type === 'recallSay';
  return (
    <div
      className={cx(
        'space-y-3 rounded-2xl border p-4',
        outcome.correct ? 'border-laurel-600/40 bg-laurel-100/70 dark:bg-laurel-700/20' : 'border-coral-600/40 bg-coral-100/70 dark:bg-coral-600/15',
      )}
      role="status"
      aria-live="polite"
    >
      {!isSay && (
        <p className="flex items-center gap-2 font-semibold">
          {outcome.correct ? <Check className="size-5 text-laurel-700" /> : <X className="size-5 text-coral-600" />}
          {outcome.correct ? 'Dobrze!' : 'Jeszcze nie.'}
          {!outcome.correct && <span className="font-normal">Poprawnie: <strong lang="pt-PT">{outcome.expected}</strong></span>}
        </p>
      )}
      {outcome.explanation && <p className="text-sm">{outcome.explanation}</p>}
      {target && !isSay && <PronunciationCard item={target} variant="compact" />}
      {children}
    </div>
  );
}

function ChoiceBody({ exercise, gender = 'm', prompt, answered, finish }: BodyProps<'listenChoose' | 'readChoose' | 'recallChoose'>) {
  const target = getItem(exercise.targetItemId);
  const options = useMemo(() => shuffle(exercise.optionItemIds.map(getItem)), [exercise.optionItemIds]);
  const [chosen, setChosen] = useState<string | null>(null);
  const { available } = useAudioAvailable(target);
  const { play } = usePlayer();
  const { settings } = useApp();
  const tv = itemView(target, gender);
  const listening = exercise.type === 'listenChoose';
  const autoplayed = useRef(false);
  useEffect(() => {
    if (listening && available && settings.autoPlayAudio && !autoplayed.current) {
      autoplayed.current = true;
      void play(target, { fem: tv.fem, repeat: 1 });
    }
  }, [listening, available, settings.autoPlayAudio, play, target, tv.fem]);

  const label = (id: string) => {
    const v = itemView(getItem(id), gender);
    return exercise.type === 'recallChoose' ? v.pt : v.pl;
  };
  const pick = (id: string) => {
    if (answered) return;
    setChosen(id);
    finish({ correct: id === target.id, given: label(id), expected: exercise.type === 'recallChoose' ? tv.pt : tv.pl });
  };

  return (
    <>
      <p className="text-lg font-semibold">{prompt ?? (listening ? 'Posłuchaj i wybierz znaczenie.' : exercise.type === 'readChoose' ? 'Co to znaczy?' : 'Jak to powiedzieć po portugalsku?')}</p>
      {listening ? (
        available ? (
          <div className="flex items-center justify-center gap-4 py-2">
            <AudioButton item={target} fem={tv.fem} size="lg" label="Odtwórz nagranie" repeat={1} />
            <AudioButton item={target} fem={tv.fem} slow size="md" label="Odtwórz wolniej" repeat={1} />
          </div>
        ) : (
          <Notice tone="warn" title="Brak głosu pt-PT">
            Na tym urządzeniu nie ma portugalskiego (europejskiego) głosu ani nagrania. Zamiast słuchania — przeczytaj: <strong lang="pt-PT">{tv.pt}</strong>
          </Notice>
        )
      ) : exercise.type === 'readChoose' ? (
        <div className="flex items-center gap-3 rounded-2xl bg-[var(--surface-2)] p-4">
          <AudioButton item={target} fem={tv.fem} />
          <div>
            <p className="text-2xl font-bold" lang="pt-PT">{tv.pt}</p>
            {settings.showPronunciation && tv.pron.plSlow && <Phon text={tv.pron.plSlow} className="text-[var(--muted)]" />}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl bg-[var(--surface-2)] p-4">
          <p className="text-xl font-semibold">{tv.pl}</p>
        </div>
      )}
      <div className="grid gap-2">
        {options.map((o) => {
          const isTarget = o.id === target.id;
          const state = !answered ? 'idle' : isTarget ? 'right' : chosen === o.id ? 'wrong' : 'idle';
          return (
            <button
              key={o.id}
              type="button"
              disabled={answered}
              onClick={() => pick(o.id)}
              lang={exercise.type === 'recallChoose' ? 'pt-PT' : 'pl'}
              className={cx(
                'focus-ring min-h-12 rounded-xl border-2 px-4 py-3 text-left text-[15px] font-medium transition',
                state === 'idle' && 'border-[var(--border)] bg-[var(--surface)] hover:border-atlantic-500',
                state === 'right' && 'border-laurel-600 bg-laurel-100 dark:bg-laurel-700/30',
                state === 'wrong' && 'border-coral-600 bg-coral-100 dark:bg-coral-600/20',
              )}
            >
              {label(o.id)}
            </button>
          );
        })}
      </div>
    </>
  );
}

function MinimalPairBody({ exercise, gender = 'm', prompt, answered, finish }: BodyProps<'minimalPair'>) {
  const [a, b] = exercise.itemIds;
  const played = useMemo(() => (Math.random() < 0.5 ? a : b), [a, b]);
  const item = getItem(played);
  const { available } = useAudioAvailable(item);
  const [chosen, setChosen] = useState<string | null>(null);
  const opts = [getItem(a), getItem(b)];
  if (!available) {
    return (
      <Notice tone="warn" title="To ćwiczenie wymaga dźwięku">
        Brak głosu pt-PT i nagrania. Pomiń je albo skonfiguruj głos w Ustawieniach.
        <div className="mt-3">
          <Button variant="secondary" onClick={() => finish({ correct: true, given: '(pominięte — brak audio)', expected: '', itemId: played })}>
            Pomiń
          </Button>
        </div>
      </Notice>
    );
  }
  return (
    <>
      <p className="text-lg font-semibold">{prompt ?? 'Które słowo słyszysz?'}</p>
      <div className="flex justify-center py-2">
        <AudioButton item={item} size="lg" label="Odtwórz słowo" repeat={1} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        {opts.map((o) => {
          const v = itemView(o, gender);
          const state = !answered ? 'idle' : o.id === played ? 'right' : chosen === o.id ? 'wrong' : 'idle';
          return (
            <button
              key={o.id}
              type="button"
              disabled={answered}
              onClick={() => {
                setChosen(o.id);
                finish({ correct: o.id === played, given: o.pt, expected: item.pt, itemId: played });
              }}
              className={cx(
                'focus-ring rounded-xl border-2 p-3 text-center',
                state === 'idle' && 'border-[var(--border)] bg-[var(--surface)] hover:border-atlantic-500',
                state === 'right' && 'border-laurel-600 bg-laurel-100 dark:bg-laurel-700/30',
                state === 'wrong' && 'border-coral-600 bg-coral-100 dark:bg-coral-600/20',
              )}
            >
              <span className="block text-xl font-bold" lang="pt-PT">{v.pt}</span>
              <span className="block text-sm text-[var(--muted)]">{v.pl}</span>
              {v.pron.plSlow && <Phon text={v.pron.plSlow} size="sm" />}
            </button>
          );
        })}
      </div>
      {answered && (
        <div className="flex justify-center gap-3">
          {opts.map((o) => (
            <span key={o.id} className="flex items-center gap-2 text-sm">
              <AudioButton item={o} size="sm" repeat={1} /> {o.pt}
            </span>
          ))}
        </div>
      )}
    </>
  );
}

function FillGapBody({ exercise, prompt, answered, finish }: BodyProps<'fillGap'>) {
  const [chosen, setChosen] = useState<string | null>(null);
  const options = useMemo(() => shuffle(exercise.options), [exercise.options]);
  const [before, after] = exercise.sentencePt.split('___');
  return (
    <>
      <p className="text-lg font-semibold">{prompt ?? 'Uzupełnij zdanie.'}</p>
      <div className="rounded-2xl bg-[var(--surface-2)] p-4">
        <p className="text-xl font-semibold" lang="pt-PT">
          {before}
          <span className={cx('mx-1 inline-block min-w-16 border-b-2 text-center', chosen ? (chosen === exercise.answer ? 'border-laurel-600' : 'border-coral-600') : 'border-atlantic-500')}>
            {chosen ?? ' '}
          </span>
          {after}
        </p>
        <p className="mt-1 text-sm text-[var(--muted)]">{exercise.sentencePl}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <Button
            key={o}
            variant={answered && o === exercise.answer ? 'success' : answered && o === chosen ? 'danger' : 'secondary'}
            disabled={answered}
            onClick={() => {
              setChosen(o);
              const correct = o === exercise.answer;
              finish({
                correct,
                given: o,
                expected: exercise.sentencePt.replace('___', exercise.answer),
                explanation: correct ? exercise.explanationPl : (exercise.wrongExplanations?.[o] ?? exercise.explanationPl),
              });
            }}
            lang="pt-PT"
          >
            {o}
          </Button>
        ))}
      </div>
    </>
  );
}

function BuildBody({ exercise, gender = 'm', prompt, answered, finish }: BodyProps<'buildSentence' | 'transform'>) {
  const target = getItem(exercise.targetItemId);
  const tv = itemView(target, gender);
  const pool = useMemo(
    () => shuffle([...exercise.tiles, ...(exercise.distractors ?? [])].map((t, i) => ({ t, k: `${i}-${t}` }))),
    [exercise.tiles, exercise.distractors],
  );
  const [picked, setPicked] = useState<{ t: string; k: string }[]>([]);
  const base = exercise.type === 'transform' ? getItem(exercise.baseItemId) : null;
  const accepted = [...acceptedPt(target), ...(exercise.acceptedAnswers ?? [])];
  const check = () => {
    const given = picked.map((p) => p.t).join(' ');
    const correct = accepted.map(normalizeAnswer).includes(normalizeAnswer(given));
    finish({ correct, given, expected: tv.pt });
  };
  return (
    <>
      {base ? (
        <div className="space-y-2">
          <p className="text-sm text-[var(--muted)]">Zdanie wyjściowe:</p>
          <PronunciationCard item={base} variant="row" />
          <p className="text-lg font-semibold">{exercise.type === 'transform' ? exercise.instructionPl : ''}</p>
        </div>
      ) : (
        <>
          <p className="text-lg font-semibold">{prompt ?? 'Ułóż zdanie po portugalsku:'}</p>
          <p className="rounded-2xl bg-[var(--surface-2)] p-3 text-[var(--text)]">{tv.pl}</p>
        </>
      )}
      <div
        className="flex min-h-14 flex-wrap items-center gap-2 rounded-xl border-2 border-dashed border-[var(--border)] p-2"
        aria-label="Twoja odpowiedź"
        data-testid="build-answer"
      >
        {picked.length === 0 && <span className="px-2 text-sm text-[var(--muted)]">Dotknij słów poniżej…</span>}
        {picked.map((p) => (
          <button
            key={p.k}
            type="button"
            disabled={answered}
            className="focus-ring rounded-lg bg-atlantic-600 px-3 py-2 text-white"
            onClick={() => setPicked((xs) => xs.filter((x) => x.k !== p.k))}
            lang="pt-PT"
          >
            {p.t}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2" data-testid="build-tiles">
        {pool
          .filter((p) => !picked.some((x) => x.k === p.k))
          .map((p) => (
            <button
              key={p.k}
              type="button"
              disabled={answered}
              className="focus-ring rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 font-medium hover:border-atlantic-500"
              onClick={() => setPicked((xs) => [...xs, p])}
              lang="pt-PT"
            >
              {p.t}
            </button>
          ))}
      </div>
      {!answered && (
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setPicked([])} disabled={!picked.length} aria-label="Wyczyść">
            <RotateCcw className="size-4" />
          </Button>
          <Button className="flex-1" onClick={check} disabled={!picked.length}>
            Sprawdź
          </Button>
        </div>
      )}
    </>
  );
}

function TypeBody({ exercise, gender = 'm', prompt, answered, finish }: BodyProps<'typeAnswer'>) {
  const target = getItem(exercise.targetItemId);
  const tv = itemView(target, gender);
  const [value, setValue] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const check = () => {
    const accepted = [...acceptedPt(target), ...(exercise.acceptedAnswers ?? [])];
    const verdict = judgeAnswer(value, accepted);
    if (verdict === 'accents') setNote('Dobrze — tylko uważaj na znaki diakrytyczne (np. ã, é, ç). W wymowie mają znaczenie!');
    if (verdict === 'typo') setNote('Prawie — jedna literówka. Porównaj z poprawną formą.');
    finish({ correct: verdict === 'correct' || verdict === 'accents', given: value, expected: tv.pt });
  };
  return (
    <>
      <p className="text-lg font-semibold">{prompt ?? 'Napisz po portugalsku:'}</p>
      <p className="rounded-2xl bg-[var(--surface-2)] p-3">{tv.pl}</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!answered && value.trim()) check();
        }}
        className="space-y-2"
      >
        <input
          ref={input}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={answered}
          lang="pt-PT"
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          aria-label="Odpowiedź po portugalsku"
          className="focus-ring w-full rounded-xl border-2 border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-lg"
        />
        {!answered && (
          <div className="flex flex-wrap gap-1" aria-label="Znaki portugalskie">
            {SPECIAL.map((c) => (
              <button
                key={c}
                type="button"
                className="focus-ring min-w-9 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1"
                onClick={() => {
                  setValue((v) => v + c);
                  input.current?.focus();
                }}
              >
                {c}
              </button>
            ))}
          </div>
        )}
        {!answered && (
          <Button type="submit" className="w-full" disabled={!value.trim()}>
            Sprawdź
          </Button>
        )}
      </form>
      {note && <Notice tone="info">{note}</Notice>}
    </>
  );
}

function SayBody({ exercise, gender = 'm', prompt, answered, finish }: BodyProps<'recallSay'>) {
  const target = getItem(exercise.targetItemId);
  const tv = itemView(target, gender);
  const [revealed, setRevealed] = useState(false);
  const [spoke, setSpoke] = useState(0);
  const rate = (self: SelfRating) =>
    finish({ correct: self !== 'cannot', self, given: self, expected: tv.pt, speakingSeconds: Math.max(spoke, 4) });
  return (
    <>
      <p className="text-lg font-semibold">{prompt ?? 'Powiedz po portugalsku — na głos:'}</p>
      <p className="rounded-2xl bg-[var(--surface-2)] p-4 text-xl font-semibold">{tv.pl}</p>
      <p className="text-sm text-[var(--muted)]">Najpierw spróbuj sam(a). Nagrywanie jest opcjonalne — liczy się mówienie na głos.</p>
      <Recorder label={tv.pt} itemId={target.id} compact onRecorded={(s) => setSpoke((x) => x + s)} />
      {!revealed ? (
        <Button variant="outline" className="w-full" onClick={() => setRevealed(true)}>
          <Eye className="size-4" /> Pokaż wzór
        </Button>
      ) : (
        <>
          <PronunciationCard item={target} variant="compact" />
          {!answered && (
            <div>
              <p className="mb-2 text-sm font-medium">Jak Ci poszło? (samoocena)</p>
              <div className="grid grid-cols-3 gap-2">
                <Button variant="success" onClick={() => rate('can')}>Umiem</Button>
                <Button variant="secondary" onClick={() => rate('almost')}>Prawie</Button>
                <Button variant="secondary" onClick={() => rate('cannot')}>Nie umiem</Button>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
