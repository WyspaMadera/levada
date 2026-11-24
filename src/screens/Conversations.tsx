import { Link } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { Bot, ChevronRight, Lock, MessageCircleQuestion, MessagesSquare, Theater } from 'lucide-react';
import { content } from '@/content/content';
import { db } from '@/db/db';
import { useApp } from '@/state/AppContext';
import { useCourse } from '@/state/course';
import { Badge, Card, Notice, PageHeader } from '@/components/ui';

export default function Conversations() {
  const course = useCourse();
  const { settings } = useApp();
  const logs = useLiveQuery(() => db.conversationLogs.toArray(), []) ?? [];
  const done = course.completedIds;
  const scenarios = content.scenarios;
  const unlocked = scenarios.filter((s) => done.has(s.unlockAfterLessonId));
  const questions = content.questions.filter((q) => done.has(q.unlockAfterLessonId));
  const dialogues = course.lessons
    .filter((l) => done.has(l.id))
    .flatMap((l) => l.dialogueIds.map((d) => ({ d: content.dialogues.get(d)!, week: l.week })))
    .filter((x) => x.d && x.d.lines.some((ln) => ln.isLearner));
  const timesDone = (refId: string) => logs.filter((l) => l.refId === refId).length;

  return (
    <div className="space-y-4">
      <PageHeader title="Rozmowy bez stresu" subtitle="Słyszysz pytanie — odpowiadasz sam(a) — porównujesz z wzorami" />

      <Link to={`/rozmowy/pytania?n=${Math.min(5, Math.max(2, questions.length))}`} className={questions.length ? 'block' : 'pointer-events-none block opacity-60'} aria-disabled={!questions.length}>
        <Card className="flex items-center gap-3">
          <MessageCircleQuestion className="size-7 text-atlantic-600" />
          <div className="flex-1">
            <p className="font-semibold">Pytania bez scenariusza</p>
            <p className="text-sm text-[var(--muted)]">
              {questions.length ? `Losowe pytania o Ciebie i Twój dzień (${questions.length} dostępnych)` : 'Odblokujesz po lekcji 2 (powitania).'}
            </p>
          </div>
          <ChevronRight className="size-5 text-[var(--muted)]" />
        </Card>
      </Link>

      <section className="space-y-2" aria-label="Scenariusze">
        <h2 className="flex items-center gap-2 font-bold">
          <Theater className="size-5" /> Scenariusze z wariantami odpowiedzi
        </h2>
        {scenarios.map((s) => {
          const open = done.has(s.unlockAfterLessonId);
          const lesson = content.lessonById.get(s.unlockAfterLessonId);
          const n = timesDone(s.id);
          return open ? (
            <Link key={s.id} to={`/rozmowy/scenariusz/${s.id}`} className="block">
              <Card className="flex items-center gap-3">
                <div className="flex-1">
                  <p className="font-semibold">{s.titlePl}</p>
                  <p className="text-xs text-[var(--muted)]">
                    {s.topicPl} · {s.turns.length} wymiany{n ? ` · ćwiczone ${n}×` : ''}
                  </p>
                </div>
                <Badge>{s.level}</Badge>
              </Card>
            </Link>
          ) : (
            <Card key={s.id} className="flex items-center gap-3 opacity-60">
              <Lock className="size-4" />
              <div className="flex-1">
                <p className="font-semibold">{s.titlePl}</p>
                <p className="text-xs text-[var(--muted)]">Po lekcji: {lesson?.titlePl}</p>
              </div>
            </Card>
          );
        })}
        {unlocked.length === 0 && <p className="text-sm text-[var(--muted)]">Pierwszy scenariusz odblokujesz po lekcji 3.</p>}
      </section>

      <section className="space-y-2" aria-label="Dialogi z lekcji">
        <h2 className="flex items-center gap-2 font-bold">
          <MessagesSquare className="size-5" /> Dialogi z lekcji — Twoje kwestie
        </h2>
        {dialogues.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Ukończ lekcję z dialogiem, aby ćwiczyć swoje kwestie.</p>
        ) : (
          dialogues.map(({ d, week }) => (
            <Link key={d.id} to={`/rozmowy/dialog/${d.id}`} className="block">
              <Card className="flex items-center gap-3 py-3">
                <div className="flex-1">
                  <p className="font-medium">{d.titlePl}</p>
                  <p className="text-xs text-[var(--muted)]">Tydzień {week}</p>
                </div>
                <ChevronRight className="size-4 text-[var(--muted)]" />
              </Card>
            </Link>
          ))
        )}
      </section>

      <Link to="/rozmowy/ai" className="block">
        <Card className="flex items-center gap-3">
          <Bot className="size-7 text-atlantic-600" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Trener rozmów AI (opcjonalny)</p>
            {!settings.aiEndpoint && <Badge tone="warn">nieskonfigurowany</Badge>}
            <p className="text-sm text-[var(--muted)]">
              {settings.aiEndpoint ? 'Swobodna rozmowa dopasowana do Twojego poziomu.' : 'Wymaga własnego serwera pośredniczącego — zobacz, jak skonfigurować.'}
            </p>
          </div>
        </Card>
      </Link>
      <Notice tone="info">Podstawowe rozmowy działają bez AI i bez internetu. Mówienie oceniasz sam(a) — aplikacja nie ocenia automatycznie akcentu.</Notice>
    </div>
  );
}
