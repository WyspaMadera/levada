import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { CheckCircle2, ChevronRight, CircleDashed, PlayCircle } from 'lucide-react';
import { content } from '@/content/content';
import { db } from '@/db/db';
import { useCourse } from '@/state/course';
import { MadeiraMap, type StopStatus } from '@/components/MadeiraMap';
import { Badge, Button, Card, PageHeader, cx } from '@/components/ui';

export default function Trail() {
  const course = useCourse();
  const mistakesQ = useLiveQuery(() => db.mistakes.where('resolved').equals(0).toArray(), []);
  const [selected, setSelected] = useState<string | null>(null);

  const status = useMemo(() => {
    const st: Record<string, StopStatus> = {};
    const weakLessons = new Set((mistakesQ ?? []).map((m) => m.lessonId).filter(Boolean));
    for (const s of content.stops) {
      const lessons = course.lessons.filter((l) => l.mapStopId === s.id);
      const done = lessons.length > 0 && lessons.every((l) => course.completedIds.has(l.id));
      const started = lessons.some((l) => course.completedIds.has(l.id)) || course.nextLesson?.mapStopId === s.id;
      const weak = lessons.some((l) => (course.progress.get(l.id)?.score ?? 1) < 0.6 || weakLessons.has(l.id));
      st[s.id] = done ? (weak ? 'needs-review' : 'done') : started ? 'current' : 'locked';
    }
    return st;
  }, [course, mistakesQ]);

  const sel = content.stops.find((s) => s.id === (selected ?? course.nextLesson?.mapStopId ?? content.stops[0]?.id));
  const weeks = content.weeks;

  return (
    <div className="space-y-4">
      <PageHeader title="Szlak" subtitle="Twoja wędrówka po Maderze — od Funchal do Porto Santo" />
      {course.nextLesson && (
        <Link to={`/lekcja/${course.nextLesson.id}`} className="block">
          <Button size="lg" className="w-full" data-testid="trail-continue">
            <PlayCircle className="size-5" /> Kontynuuj: {course.nextLesson.titlePl}
          </Button>
        </Link>
      )}
      <Card className="p-2">
        <MadeiraMap stops={content.stops} status={status} selected={sel?.id} onSelect={setSelected} />
        <div className="mt-1 flex flex-wrap justify-center gap-3 px-2 pb-1 text-xs text-[var(--muted)]">
          <span className="flex items-center gap-1"><span className="size-2.5 rounded-full bg-laurel-600" /> ukończone</span>
          <span className="flex items-center gap-1"><span className="size-2.5 rounded-full bg-atlantic-600" /> teraz</span>
          <span className="flex items-center gap-1"><span className="size-2.5 rounded-full bg-[#d18f1f]" /> warto powtórzyć</span>
          <span className="flex items-center gap-1"><span className="size-2.5 rounded-full border border-[var(--muted)] bg-white" /> przed Tobą</span>
        </div>
      </Card>

      {sel && (
        <Card className="space-y-2" aria-live="polite">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">{sel.namePt}</h2>
            <Badge tone="info">
              tydz. {sel.weeks[0]}
              {sel.weeks[1] !== sel.weeks[0] ? `–${sel.weeks[1]}` : ''}
            </Badge>
          </div>
          <p className="text-sm font-medium">{sel.stagePl}</p>
          <p className="text-sm text-[var(--muted)]">{sel.factPl}</p>
        </Card>
      )}

      <section className="space-y-3" aria-label="Tygodnie kursu">
        {weeks.map((w) => {
          const lessons = course.lessons.filter((l) => l.week === w.week);
          const doneN = lessons.filter((l) => course.completedIds.has(l.id)).length;
          const open = lessons.length > 0 && (selected ? w.mapStopId === sel?.id : w.week <= course.currentWeek + 1);
          return (
            <details key={w.week} open={open} className="group rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
              <summary className="focus-ring flex cursor-pointer list-none items-center gap-3 rounded-2xl p-4">
                <div className={cx('grid size-9 shrink-0 place-items-center rounded-full text-sm font-bold', doneN === lessons.length && lessons.length ? 'bg-laurel-600 text-white' : 'bg-[var(--surface-2)]')}>
                  {w.week}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{w.titlePl}</p>
                  <p className="text-xs text-[var(--muted)]">
                    {lessons.length ? `${doneN}/${lessons.length} lekcji · ${w.targetLevel}` : `Planowane · ${w.targetLevel}`}
                  </p>
                </div>
                <ChevronRight className="size-5 transition group-open:rotate-90" />
              </summary>
              <div className="px-4 pb-4">
                {lessons.length === 0 ? (
                  <p className="text-sm text-[var(--muted)]">
                    Treść tego tygodnia jest w przygotowaniu (cele: {w.goals.slice(0, 2).join('; ')}). Nie generujemy jej „na zapas” bez kontroli jakości.
                  </p>
                ) : (
                  <ul className="divide-y divide-[var(--border)]">
                    {lessons.map((l) => {
                      const p = course.progress.get(l.id);
                      const done = course.completedIds.has(l.id);
                      return (
                        <li key={l.id}>
                          <Link to={`/lekcja/${l.id}`} className="focus-ring flex items-center gap-3 py-3">
                            {done ? <CheckCircle2 className="size-5 text-laurel-600" /> : <CircleDashed className="size-5 text-[var(--muted)]" />}
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium">
                                {l.day}. {l.titlePl}
                              </p>
                              <p className="text-xs text-[var(--muted)]">
                                ~{l.estimatedMinutes} min
                                {p?.score !== undefined && ` · wynik ${Math.round(p.score * 100)}%`}
                                {l.testId && ' · ze sprawdzianem'}
                              </p>
                            </div>
                            {course.nextLesson?.id === l.id && <Badge tone="info">teraz</Badge>}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </details>
          );
        })}
      </section>
    </div>
  );
}
