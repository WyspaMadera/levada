import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { CheckCircle2, X } from 'lucide-react';
import type { Exercise } from '@/content/schema';
import { content } from '@/content/content';
import { db, type SkillCard } from '@/db/db';
import { logStudy, radarInput, recordResult } from '@/db/repo';
import { analyze } from '@/lib/radar';
import { buildQueue } from '@/lib/reviewQueue';
import { taskForCard } from '@/lib/reviewTasks';
import { newSkillCard, SKILL_LABEL_PL } from '@/lib/srs';
import { useApp } from '@/state/AppContext';
import { ExerciseView, type ExerciseOutcome } from '@/components/ExerciseView';
import { Button, Card, Notice, ProgressBar } from '@/components/ui';

type Task = { card: SkillCard; exercise: Exercise };

export default function Review() {
  const [params] = useSearchParams();
  const speakingOnly = params.get('tryb') === 'mowienie';
  const mistakesMode = params.get('bledy') === '1';
  const myMode = params.get('tryb') === 'moje';
  const requested = Number(params.get('n') ?? 0) || undefined;
  const { todayMinutes, audio } = useApp();
  const nav = useNavigate();
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [results, setResults] = useState<(ExerciseOutcome & { cardId: string })[]>([]);
  const started = useRef(Date.now());
  const speakSec = useRef(0);
  const logged = useRef(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const now = new Date();
      const [cards, input] = await Promise.all([db.cards.toArray(), radarInput(now, todayMinutes)]);
      const radar = analyze(input);
      const canListen = Boolean(audio?.choice.voice) || Object.keys(content.audio.files).length > 0;
      const known = [...new Set(cards.map((c) => c.itemId))].filter((i) => content.items.has(i));
      let queue: SkillCard[];
      if (myMode) {
        // Moje zdania: ćwiczenie mówienia; brakujące karty tworzymy (pierwsza odpowiedź ją zaplanuje)
        const mine = (await db.myPhrases.toArray()).flatMap((p) => (p.itemId && content.items.has(p.itemId) ? [p.itemId] : []));
        const byId = new Map(cards.map((c) => [c.id, c]));
        queue = mine.slice(0, 15).map((id) => byId.get(`${id}|speaking`) ?? newSkillCard(id, 'speaking', now));
      } else if (mistakesMode) {
        // ćwiczenie z zeszytu błędów: karty tych elementów i kompetencji, w których był błąd
        const open = await db.mistakes.where('resolved').equals(0).toArray();
        const wanted = new Set(open.filter((m) => m.itemId).map((m) => `${m.itemId}`));
        const catSkill: Record<string, string> = { listening: 'listening', meaning: 'recognition', vocabulary: 'recall', pronunciation: 'speaking' };
        const preferred = new Set(open.map((m) => `${m.itemId}|${catSkill[m.category] ?? 'building'}`));
        const byItem = new Map<string, SkillCard>();
        for (const c of cards) {
          if (!wanted.has(c.itemId) || !content.items.has(c.itemId) || (!canListen && c.skill === 'listening')) continue;
          const cur = byItem.get(c.itemId);
          if (!cur || preferred.has(c.id)) byItem.set(c.itemId, c);
        }
        queue = [...byItem.values()].slice(0, 15);
      } else if (speakingOnly) {
        // ćwiczenie mówienia na życzenie: najpierw zaległe, potem najdawniej ćwiczone
        queue = cards
          .filter((c) => c.skill === 'speaking' && content.items.has(c.itemId))
          .sort((a, b) => new Date(a.due).getTime() - new Date(b.due).getTime())
          .slice(0, requested ?? 5);
      } else {
        queue = buildQueue(
          cards.filter((c) => content.items.has(c.itemId)),
          { now, reviewLimit: requested ?? radar.reviewLimit, newLimit: radar.newCardLimit, weights: radar.skillWeights, canListen },
        );
      }
      if (alive) setTasks(queue.map((card) => ({ card, exercise: taskForCard(card, known) })));
    })();
    return () => {
      alive = false;
    };
    // jednorazowo przy wejściu na ekran
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finishLog = () => {
    if (logged.current) return;
    logged.current = true;
    void logStudy(speakingOnly ? 'speaking' : 'review', (Date.now() - started.current) / 1000, speakSec.current);
  };
  useEffect(() => () => finishLog(), []); // eslint-disable-line react-hooks/exhaustive-deps

  if (tasks === null) return <p className="py-10 text-center text-[var(--muted)]">Przygotowuję powtórki…</p>;

  const header = (
    <div className="flex items-center gap-2">
      <button type="button" aria-label="Zamknij" className="focus-ring rounded-full p-2 hover:bg-[var(--surface-2)]" onClick={() => nav('/')}>
        <X className="size-5" />
      </button>
      <div className="flex-1">
        <p className="text-sm font-semibold">{myMode ? 'Moje zdania' : speakingOnly ? 'Mówienie' : mistakesMode ? 'Ćwiczenie błędów' : 'Powtórki'}</p>
        {tasks.length > 0 && <ProgressBar value={idx / tasks.length} label="Postęp powtórek" />}
      </div>
    </div>
  );

  if (tasks.length === 0) {
    return (
      <div className="space-y-4">
        {header}
        <Notice tone="ok" title={speakingOnly ? 'Nie ma jeszcze czego ćwiczyć ustnie' : 'Brak powtórek na teraz'}>
          {speakingOnly
            ? 'Zadania mówienia pojawią się po ukończeniu pierwszej lekcji.'
            : 'Wszystko powtórzone. Kolejne karty pojawią się, gdy przyjdzie ich czas (algorytm FSRS dobiera odstępy).'}
        </Notice>
        <Button className="w-full" onClick={() => nav('/')}>
          Wróć do „Dzisiaj”
        </Button>
      </div>
    );
  }

  if (idx >= tasks.length) {
    finishLog();
    const bySkill = new Map<string, { ok: number; n: number }>();
    for (const r of results) {
      const s = bySkill.get(r.skill) ?? { ok: 0, n: 0 };
      s.n++;
      if (r.correct) s.ok++;
      bySkill.set(r.skill, s);
    }
    return (
      <div className="space-y-4" data-testid="review-summary">
        {header}
        <div className="flex items-center gap-3">
          <CheckCircle2 className="size-10 text-laurel-600" />
          <div>
            <h1 className="text-xl font-bold">Gotowe!</h1>
            <p className="text-sm text-[var(--muted)]">
              {results.filter((r) => r.correct).length} z {results.length} poprawnie
            </p>
          </div>
        </div>
        <Card className="space-y-1 text-sm">
          {[...bySkill.entries()].map(([skill, s]) => (
            <p key={skill}>
              {SKILL_LABEL_PL[skill as keyof typeof SKILL_LABEL_PL]}: {s.ok}/{s.n}
            </p>
          ))}
        </Card>
        <p className="text-sm text-[var(--muted)]">Każda odpowiedź zaktualizowała harmonogram — trudne elementy wrócą szybciej.</p>
        <Button size="lg" className="w-full" onClick={() => nav('/')}>
          Wróć do „Dzisiaj”
        </Button>
        <Link to="/bledy" className="block text-center text-sm underline">
          Zeszyt błędów
        </Link>
      </div>
    );
  }

  const t = tasks[idx]!;
  return (
    <div className="space-y-4" data-testid="review">
      {header}
      <p className="text-xs text-[var(--muted)]">
        {idx + 1} / {tasks.length} · {SKILL_LABEL_PL[t.card.skill]}
        {t.card.reps === 0 && ' · nowe'}
      </p>
      <ExerciseView
        key={`${t.card.id}-${idx}`}
        exercise={t.exercise}
        skillOverride={t.card.skill}
        onAnswered={(o) => {
          setResults((rs) => [...rs, { ...o, cardId: t.card.id }]);
          if (o.speakingSeconds) speakSec.current += o.speakingSeconds;
          void recordResult({
            itemId: t.card.itemId,
            skill: t.card.skill,
            correct: o.correct,
            self: o.self,
            context: 'review',
            exerciseId: t.exercise.id,
            answer: o.given,
            mistake: o.correct ? undefined : { category: o.category, expected: o.expected, given: o.given },
          });
        }}
        onNext={() => setIdx(idx + 1)}
      />
    </div>
  );
}
