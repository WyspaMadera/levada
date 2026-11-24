import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router';
import { State } from 'ts-fsrs';
import { content } from '@/content/content';
import type { Skill } from '@/content/schema';
import { db } from '@/db/db';
import { accuracy, MIN_ATTEMPTS } from '@/lib/radar';
import { SKILL_LABEL_PL } from '@/lib/srs';
import { useCourse, stopForWeek } from '@/state/course';
import { Card, Notice, PageHeader, ProgressBar } from '@/components/ui';
import { PronunciationCard } from '@/components/PronunciationCard';
import { hardestItems, mistakeTrend, weeklyStats } from '@/lib/analysis';
import { CATEGORY_PL } from './Mistakes';

const SKILLS: Skill[] = ['listening', 'recognition', 'recall', 'building', 'speaking'];

export default function Progress() {
  const course = useCourse();
  const data = useLiveQuery(async () => {
    const since = new Date(Date.now() - 14 * 86_400_000).toISOString();
    const since28 = new Date(Date.now() - 35 * 86_400_000).toISOString();
    const [cards, sessions, attempts, speaking, mistakes, attempts28] = await Promise.all([
      db.cards.toArray(),
      db.studySessions.toArray(),
      db.attempts.where('at').above(since).toArray(),
      db.speakingLogs.toArray(),
      db.mistakes.toArray(),
      db.attempts.where('at').above(since28).toArray(),
    ]);
    return { cards, sessions, attempts, speaking, mistakes, attempts28 };
  }, []);
  if (!data || !course.loaded) return <p className="py-10 text-center text-[var(--muted)]">Ładowanie…</p>;

  const now = new Date();
  const known = new Set(data.cards.map((c) => c.itemId));
  // „aktywnie opanowane”: karta przypominania lub mówienia w stanie Review, min. 2 udane powtórki bez ostatniego błędu
  const active = new Set(
    data.cards.filter((c) => (c.skill === 'recall' || c.skill === 'speaking') && c.state === State.Review && c.reps - c.lapses >= 2).map((c) => c.itemId),
  );
  const due = data.cards.filter((c) => new Date(c.due) <= now && c.state !== State.New).length;
  const totalMin = Math.round(data.sessions.reduce((a, s) => a + s.seconds, 0) / 60);
  const speakMin = Math.round(data.sessions.reduce((a, s) => a + s.speakingSeconds, 0) / 60);
  const stats = Object.fromEntries(
    SKILLS.map((s) => {
      const xs = data.attempts.filter((a) => a.skill === s);
      return [s, { correct: xs.filter((a) => a.correct).length, total: xs.length }];
    }),
  ) as Record<Skill, { correct: number; total: number }>;
  const strong = SKILLS.filter((s) => (accuracy(stats[s]) ?? 0) >= 0.85);
  const weak = SKILLS.filter((s) => accuracy(stats[s]) !== null && accuracy(stats[s])! < 0.7);
  const canDo = course.lessons.filter((l) => course.completedIds.has(l.id)).flatMap((l) => l.canDo);
  const stop = stopForWeek(course.currentWeek);

  return (
    <div className="space-y-4">
      <PageHeader title="Moje postępy" subtitle="Konkretne umiejętności — bez sztucznych wskaźników płynności" back="/wiecej" />
      <Card className="space-y-2">
        <p className="text-sm text-[var(--muted)]">Aktualny etap</p>
        <p className="text-lg font-bold">
          Tydzień {course.currentWeek} · {stop?.namePt} <span className="text-sm font-normal text-[var(--muted)]">({stop?.stagePl})</span>
        </p>
        <p className="text-sm">
          Ukończone lekcje: <strong>{course.completedIds.size}</strong> z {course.lessons.length} dostępnych (program: 26 tygodni)
        </p>
        <ProgressBar value={course.completedIds.size / Math.max(1, course.lessons.length)} label="Ukończone dostępne lekcje" />
      </Card>
      <div className="grid grid-cols-2 gap-2">
        <Card>
          <p className="text-2xl font-bold">{known.size}</p>
          <p className="text-xs text-[var(--muted)]">poznanych wyrażeń (słowa, zwroty, zdania)</p>
        </Card>
        <Card>
          <p className="text-2xl font-bold">{active.size}</p>
          <p className="text-xs text-[var(--muted)]">aktywnie opanowanych (min. 2 udane przywołania lub wypowiedzi)</p>
        </Card>
        <Card>
          <p className="text-2xl font-bold">{totalMin} min</p>
          <p className="text-xs text-[var(--muted)]">czas nauki</p>
        </Card>
        <Card>
          <p className="text-2xl font-bold">{speakMin} min</p>
          <p className="text-xs text-[var(--muted)]">mówienia (nagrania i zadania ustne; {data.speaking.length} zadań)</p>
        </Card>
      </div>
      <Card className="flex items-center justify-between">
        <p className="text-sm">Powtórki do zrobienia teraz: <strong>{due}</strong></p>
        <Link to="/powtorki" className="text-sm underline">Powtarzaj</Link>
      </Card>

      <Card className="space-y-2">
        <h2 className="font-bold">Co potrafisz</h2>
        {canDo.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Ukończ pierwszą lekcję — tu pojawią się konkretne umiejętności.</p>
        ) : (
          <ul className="list-inside list-disc space-y-1 text-sm">
            {canDo.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="space-y-2">
        <h2 className="font-bold">Kompetencje (ostatnie 14 dni)</h2>
        {SKILLS.map((s) => (
          <div key={s} className="flex items-center justify-between text-sm">
            <span>{SKILL_LABEL_PL[s]}</span>
            <span className="text-[var(--muted)]">
              {stats[s].total ? `${stats[s].correct}/${stats[s].total} poprawnie` : 'brak prób'}
              {stats[s].total > 0 && stats[s].total < MIN_ATTEMPTS && ' (za mało prób na wnioski)'}
            </span>
          </div>
        ))}
        {strong.length > 0 && <Notice tone="ok">Mocne strony: {strong.map((s) => SKILL_LABEL_PL[s].toLowerCase()).join(', ')}.</Notice>}
        {weak.length > 0 && <Notice tone="warn">Do poprawy: {weak.map((s) => SKILL_LABEL_PL[s].toLowerCase()).join(', ')}. Powtórki automatycznie dadzą tym obszarom więcej miejsca.</Notice>}
        <p className="text-xs text-[var(--muted)]">Mówienie oceniasz sam(a) — aplikacja nie mierzy automatycznie jakości akcentu.</p>
      </Card>

      <Link to="/kompetencje" className="block">
        <Card className="flex items-center justify-between">
          <span className="font-semibold">Mapa kompetencji</span>
          <span className="text-sm text-[var(--muted)]">co umiesz, obszar po obszarze →</span>
        </Card>
      </Link>

      <Card className="space-y-3" data-testid="analysis">
        <h2 className="font-bold">Analiza trudności</h2>
        {(() => {
          const trend = mistakeTrend(data.mistakes, now);
          const hard = hardestItems(data.cards).filter((h) => content.items.has(h.itemId));
          const weeks = weeklyStats(data.attempts28, data.sessions, now);
          return (
            <>
              <div>
                <p className="text-sm font-medium">Błędy wg rodzaju (ostatnie 14 dni / 14 dni wcześniej)</p>
                {trend.length === 0 ? (
                  <p className="text-sm text-[var(--muted)]">Brak błędów w ostatnich 4 tygodniach.</p>
                ) : (
                  <ul className="text-sm">
                    {trend.map((t) => (
                      <li key={t.category} className="flex justify-between">
                        <span>{CATEGORY_PL[t.category]}</span>
                        <span className="text-[var(--muted)]">
                          {t.recent} / {t.previous} {t.recent < t.previous ? '↓ mniej' : t.recent > t.previous ? '↑ więcej' : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <p className="text-sm font-medium">Najtrudniejsze zwroty (najczęściej zapominane)</p>
                {hard.length === 0 ? (
                  <p className="text-sm text-[var(--muted)]">Na razie żaden zwrot nie „uciekł” z pamięci.</p>
                ) : (
                  <div className="divide-y divide-[var(--border)]">
                    {hard.map((h) => (
                      <PronunciationCard key={h.itemId} item={content.items.get(h.itemId)!} variant="row" />
                    ))}
                  </div>
                )}
              </div>
              <div>
                <p className="text-sm font-medium">Ostatnie 4 tygodnie</p>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-[var(--muted)]">
                      <th className="py-1 font-normal">tydzień od</th>
                      <th className="font-normal">minuty</th>
                      <th className="font-normal">słuchanie</th>
                      <th className="font-normal">mówienie</th>
                      <th className="font-normal">z pamięci</th>
                    </tr>
                  </thead>
                  <tbody>
                    {weeks.map((w) => {
                      const f = (k: 'listening' | 'speaking' | 'recall') => (w.bySkill[k] ? `${w.bySkill[k]!.correct}/${w.bySkill[k]!.total}` : '—');
                      return (
                        <tr key={w.weekStart} className="border-t border-[var(--border)]">
                          <td className="py-1">{new Date(w.weekStart).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })}</td>
                          <td>{w.minutes}</td>
                          <td>{f('listening')}</td>
                          <td>{f('speaking')}</td>
                          <td>{f('recall')}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          );
        })()}
      </Card>

      <Card className="space-y-2">
        <h2 className="font-bold">Sprawdziany</h2>
        {course.testResults.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Jeszcze brak wyników.</p>
        ) : (
          course.testResults.map((t) => (
            <p key={t.id} className="text-sm">
              {content.tests.get(t.testId)?.titlePl ?? t.testId}: <strong>{Math.round(t.score * 100)}%</strong> ({new Date(t.at).toLocaleDateString('pl-PL')})
            </p>
          ))
        )}
      </Card>
    </div>
  );
}
