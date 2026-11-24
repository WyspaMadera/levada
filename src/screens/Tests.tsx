import { Link } from 'react-router';
import { content } from '@/content/content';
import { useCourse } from '@/state/course';
import { Badge, Card, Notice, PageHeader } from '@/components/ui';

export default function Tests() {
  const course = useCourse();
  const tests = [...content.tests.values()].sort((a, b) => a.week - b.week);
  return (
    <div className="space-y-3">
      <PageHeader title="Sprawdziany" subtitle="Pokazują, co umiesz i co powtórzyć. Nie blokują nauki." back="/wiecej" />
      {tests.map((t) => {
        const results = course.testResults.filter((r) => r.testId === t.id);
        const best = results.length ? Math.max(...results.map((r) => r.score)) : null;
        return (
          <Link key={t.id} to={`/sprawdzian/${t.id}`} className="block">
            <Card className="flex items-center justify-between gap-2">
              <div>
                <p className="font-semibold">{t.titlePl}</p>
                <p className="text-xs text-[var(--muted)]">
                  Tydzień {t.week} · {t.kind === 'stage' ? 'etapowy' : t.kind === 'weekly' ? 'tygodniowy' : t.kind}
                </p>
              </div>
              {best !== null ? <Badge tone="ok">najlepszy: {Math.round(best * 100)}%</Badge> : <Badge>jeszcze nie</Badge>}
            </Card>
          </Link>
        );
      })}
      <Notice tone="info">Egzamin końcowy (Porto Santo, tydzień 26) pojawi się wraz z kolejnymi etapami kursu. Nie przyznajemy oficjalnych certyfikatów.</Notice>
    </div>
  );
}
