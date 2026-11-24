import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { content } from '@/content/content';
import type { OpenQuestion } from '@/content/schema';
import { db, type ConversationTurnLog, type SelfRating } from '@/db/db';
import { logStudy, saveConversation } from '@/db/repo';
import { shuffle } from '@/lib/answers';
import { getItem, itemView } from '@/lib/items';
import { ratingSummary, recordSpokenAnswer } from '@/lib/conversationResult';
import { useApp } from '@/state/AppContext';
import { AudioButton, useAudioAvailable, usePlayer } from '@/components/Audio';
import { AnswerAttempt } from '@/components/AnswerAttempt';
import { Button, Card, Notice, PageHeader, ProgressBar } from '@/components/ui';

/** Wybór pytań: odblokowane, najpierw te rzadziej ćwiczone (z dziennika rozmów). */
export function pickQuestions(all: OpenQuestion[], completed: Set<string>, practicedCounts: Map<string, number>, n: number, rnd = Math.random) {
  const open = all.filter((q) => completed.has(q.unlockAfterLessonId));
  return shuffle(open, rnd)
    .sort((a, b) => (practicedCounts.get(a.id) ?? 0) - (practicedCounts.get(b.id) ?? 0))
    .slice(0, n);
}

export default function QuestionsSession() {
  const [params] = useSearchParams();
  const n = Math.max(1, Math.min(10, Number(params.get('n') ?? 3) || 3));
  const nav = useNavigate();
  const { settings } = useApp();
  const done = useLiveQuery(() => db.lessonProgress.where('status').equals('completed').toArray(), []);
  const logs = useLiveQuery(() => db.conversationLogs.where('kind').equals('questions').toArray(), []);
  const [i, setI] = useState(0);
  const [ratings, setRatings] = useState<SelfRating[]>([]);
  const [showPl, setShowPl] = useState(false);
  const started = useRef(Date.now());
  const spoke = useRef(0);
  const turns = useRef<ConversationTurnLog[]>([]);
  const saved = useRef(false);
  const { play } = usePlayer();

  const questions = useMemo(() => {
    if (!done || !logs) return null;
    const counts = new Map<string, number>();
    for (const l of logs) for (const t of l.turns) if (t.speaker === 'other' && t.itemId) counts.set(t.itemId, (counts.get(t.itemId) ?? 0) + 1);
    const byQ = new Map(content.questions.map((q) => [q.id, counts.get(q.questionItemId) ?? 0]));
    return pickQuestions(content.questions, new Set(done.map((d) => d.lessonId)), byQ, n);
    // losujemy raz na wejście
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done === undefined, logs === undefined]);

  const q = questions?.[i];
  const qItem = q ? getItem(q.questionItemId) : undefined;
  const { available } = useAudioAvailable(qItem);
  useEffect(() => {
    setShowPl(false);
    if (qItem && available && settings.autoPlayAudio) void play(qItem, { repeat: 1 });
  }, [i, questions]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (questions && questions.length > 0 && i >= questions.length && !saved.current) {
      saved.current = true;
      const seconds = (Date.now() - started.current) / 1000;
      void saveConversation({ kind: 'questions', turns: turns.current, seconds, speakingSeconds: spoke.current });
      void logStudy('speaking', seconds, spoke.current);
    }
  }, [i, questions]);

  if (!questions) return <p className="py-10 text-center text-[var(--muted)]">Ładowanie…</p>;
  if (questions.length === 0)
    return (
      <div className="space-y-4">
        <PageHeader title="Pytania bez scenariusza" back="/rozmowy" />
        <Notice tone="info">Pierwsze pytania odblokujesz po lekcji 2. Na razie możesz ćwiczyć wymowę w laboratorium „Dźwięki”.</Notice>
      </div>
    );
  if (!q || !qItem) {
    const r = ratingSummary(ratings);
    return (
      <div className="space-y-4" data-testid="questions-done">
        <PageHeader title="Pytania bez scenariusza" back="/rozmowy" />
        <Notice tone="ok" title="Gotowe">
          Umiem: {r.can} · Prawie: {r.almost} · Nie umiem: {r.cannot}.
        </Notice>
        <Button className="w-full" size="lg" onClick={() => nav('/')}>
          Wróć do „Dzisiaj”
        </Button>
      </div>
    );
  }
  const v = itemView(qItem, settings.gender);
  return (
    <div className="space-y-4" data-testid="questions">
      <PageHeader title="Pytania bez scenariusza" subtitle={`${q.topicPl} · ${i + 1} z ${questions.length}`} back="/rozmowy" />
      <ProgressBar value={i / questions.length} label="Postęp" />
      <Card className="space-y-2">
        <div className="flex items-center gap-3">
          <AudioButton item={qItem} size="lg" repeat={1} />
          <div>
            <p className="text-xl font-semibold" lang="pt-PT">{v.pt}</p>
            {showPl ? (
              <p className="text-sm text-[var(--muted)]">{v.pl}</p>
            ) : (
              <button type="button" className="focus-ring text-sm underline text-[var(--muted)]" onClick={() => setShowPl(true)}>
                pokaż tłumaczenie
              </button>
            )}
          </div>
        </div>
      </Card>
      <Card>
        <AnswerAttempt
          key={q.id + i}
          taskPl={`Odpowiedz o sobie. ${q.hintPl}`}
          answerItemIds={q.exampleAnswerItemIds}
          usefulItemIds={q.usefulItemIds}
          personal={q.personal}
          revealLabel="Pokaż przykładowe odpowiedzi"
          onRated={({ self, seconds, recognized }) => {
            spoke.current += seconds;
            setRatings((r) => [...r, self]);
            turns.current.push({ speaker: 'other', itemId: q.questionItemId }, { speaker: 'learner', self, text: recognized });
            void recordSpokenAnswer({ answerItemIds: q.exampleAnswerItemIds, self, seconds, context: 'conversation', exerciseId: `question-${q.id}` });
            setI(i + 1);
          }}
        />
      </Card>
    </div>
  );
}
