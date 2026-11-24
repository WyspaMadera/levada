import { Link } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { CheckCircle2, Circle, CircleDot, Lock } from 'lucide-react';
import { content } from '@/content/content';
import { db } from '@/db/db';
import { assessArea, competenceRecommendations, STATUS_PL, type CompetenceResult } from '@/lib/competence';
import { useCourse } from '@/state/course';
import { Badge, Card, Notice, PageHeader } from '@/components/ui';

const ICON = { locked: Lock, introduced: Circle, practicing: CircleDot, confident: CheckCircle2 } as const;
const TONE = { locked: 'neutral', introduced: 'info', practicing: 'warn', confident: 'ok' } as const;

export function useCompetences(): CompetenceResult[] | null {
  const course = useCourse();
  const data = useLiveQuery(async () => ({ cards: await db.cards.toArray(), mistakes: await db.mistakes.where('resolved').equals(0).toArray() }), []);
  if (!data || !course.loaded) return null;
  return content.competences.map((a) => assessArea(a, content.items, course.completedIds, data.cards, data.mistakes));
}

/** Pierwsza nieukończona lekcja obszaru (albo ostatnia) — tam kierujemy „Przećwicz”. */
function practiceHref(r: CompetenceResult, completed: Set<string>) {
  if (r.openMistakes > 0) return '/powtorki?bledy=1';
  const next = r.area.lessonIds.find((l) => !completed.has(l));
  return next ? `/lekcja/${next}` : '/powtorki';
}

export default function Competences() {
  const results = useCompetences();
  const course = useCourse();
  if (!results) return <p className="py-10 text-center text-[var(--muted)]">Ładowanie…</p>;
  const recs = competenceRecommendations(results);
  return (
    <div className="space-y-4">
      <PageHeader title="Mapa kompetencji" subtitle="Co umiesz — na podstawie powtórek, lekcji i błędów, a nie zgadywania" back="/postepy" />
      <Notice tone="info">
        „Umiesz” = większość zwrotów z obszaru przywołałeś/aś lub powiedziałeś/aś samodzielnie co najmniej 2 razy (w odstępach wyznaczonych przez powtórki) i masz mało
        otwartych błędów. To nie jest ocena poziomu CEFR ani certyfikat.
      </Notice>
      {recs.length > 0 && (
        <Card className="space-y-2">
          <h2 className="font-bold">Warto teraz przećwiczyć</h2>
          {recs.map((r) => (
            <Link key={r.area.id} to={practiceHref(r, course.completedIds)} className="flex items-center justify-between rounded-lg px-1 py-1 text-sm underline">
              {r.area.titlePl}
              <span className="text-xs text-[var(--muted)] no-underline">{r.openMistakes ? `${r.openMistakes} błędów` : `${r.active}/${r.known}`}</span>
            </Link>
          ))}
        </Card>
      )}
      {results.map((r) => {
        const Icon = ICON[r.status];
        return (
          <Card key={r.area.id} className="space-y-2" data-testid={`competence-${r.area.id}`}>
            <div className="flex items-start justify-between gap-2">
              <p className="flex items-center gap-2 font-semibold">
                <Icon className="size-5 shrink-0" /> {r.area.titlePl}
              </p>
              <Badge tone={TONE[r.status]}>{STATUS_PL[r.status]}</Badge>
            </div>
            <ul className="list-inside list-disc text-sm">
              {r.area.canDoPl.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            <p className="text-xs text-[var(--muted)]">{r.evidencePl}</p>
            {r.status !== 'locked' && r.status !== 'confident' && (
              <Link to={practiceHref(r, course.completedIds)} className="text-sm underline">
                Przećwicz
              </Link>
            )}
          </Card>
        );
      })}
    </div>
  );
}
