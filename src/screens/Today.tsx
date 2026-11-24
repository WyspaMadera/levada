import { Link, useNavigate } from 'react-router';
import { CheckCircle2, Circle, Headphones, Mic, Play, Waves } from 'lucide-react';
import { useApp } from '@/state/AppContext';
import { useDaily } from '@/state/daily';
import { stopForWeek } from '@/state/course';
import { content } from '@/content/content';
import { todayKey } from '@/lib/planner';
import { Badge, Button, Card, Notice, cx } from '@/components/ui';
import type { DailyMinutes } from '@/db/db';

const MODES: { v: DailyMinutes; label: string }[] = [
  { v: 5, label: '5 min' },
  { v: 15, label: '15 min' },
  { v: 30, label: '30 min' },
];

export default function Today() {
  const { todayMinutes, update, audio } = useApp();
  const { loaded, plan, course, doneToday, dueCount, href } = useDaily();
  const nav = useNavigate();
  const stop = stopForWeek(course.currentWeek);
  const next = plan?.segments.find((s) => !doneToday(s));
  const allDone = plan && plan.segments.length > 0 && !next;
  const weekInfo = content.weeks.find((w) => w.week === course.currentWeek);

  return (
    <div className="space-y-4">
      <header>
        <p className="text-sm font-medium text-[var(--muted)]">
          Tydzień {course.currentWeek} · {stop?.namePt ?? 'Madera'}
        </p>
        <h1 className="text-2xl font-bold">Dzisiaj</h1>
        {weekInfo && <p className="text-sm text-[var(--muted)]">{weekInfo.titlePl}</p>}
      </header>

      <div className="flex items-center gap-2" role="radiogroup" aria-label="Ile masz dziś czasu?">
        <span className="text-sm text-[var(--muted)]">Dziś mam:</span>
        {MODES.map((m) => (
          <button
            key={m.v}
            role="radio"
            aria-checked={todayMinutes === m.v}
            onClick={() => update({ todayOverride: { date: todayKey(), minutes: m.v } })}
            className={cx(
              'focus-ring rounded-full border px-3 py-1.5 text-sm font-medium',
              todayMinutes === m.v ? 'border-atlantic-600 bg-atlantic-600 text-white' : 'border-[var(--border)] bg-[var(--surface)]',
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      {audio && audio.choice.status === 'none' && Object.keys(content.audio.files).length === 0 && (
        <Notice tone="warn" title="Brak głosu portugalskiego (Portugalia)">
          Nauka działa, ale bez odsłuchu. <Link className="underline" to="/ustawienia#audio">Jak dodać głos pt-PT?</Link>
        </Notice>
      )}

      {plan?.notesPl.map((n) => (
        <Notice key={n} tone="info">
          {n}
        </Notice>
      ))}

      <Card className="space-y-4 bg-gradient-to-br from-navy-800 to-atlantic-700 text-white">
        {!loaded ? (
          <p>Przygotowuję plan…</p>
        ) : allDone ? (
          <div className="space-y-2">
            <p className="text-lg font-semibold">Plan na dziś wykonany. Parabéns! 🎉</p>
            <p className="text-sm text-white/80">Możesz zrobić dodatkowe powtórki, poćwiczyć dźwięki albo odpocząć — odpoczynek też jest częścią nauki.</p>
          </div>
        ) : (
          <>
            <div>
              <p className="text-sm text-white/80">Plan na ok. {plan?.minutes} min</p>
              <p className="text-lg font-semibold">{next?.labelPl}</p>
              {next?.kind === 'lesson' && <p className="text-sm text-white/80">{content.lessonById.get(next.lessonId)?.titlePl}</p>}
            </div>
            <Button size="lg" variant="secondary" className="w-full border-0 bg-white text-navy-800 hover:bg-white/90" onClick={() => next && nav(href(next))} data-testid="start-today">
              <Play className="size-5" /> Rozpocznij dzisiejszą naukę
            </Button>
          </>
        )}
        {plan && plan.segments.length > 0 && (
          <ol className="space-y-1.5 text-sm">
            {plan.segments.map((s, i) => {
              const done = doneToday(s);
              return (
                <li key={i}>
                  <Link to={href(s)} className="flex items-center gap-2 rounded-lg px-1 py-1 hover:bg-white/10">
                    {done ? <CheckCircle2 className="size-4 text-laurel-100" /> : <Circle className="size-4 text-white/60" />}
                    <span className={cx('flex-1', done && 'line-through opacity-70')}>
                      {s.labelPl}
                      {s.kind === 'review' && ` (${s.cards})`}
                    </span>
                    <span className="text-white/70">~{s.minutes} min</span>
                  </Link>
                </li>
              );
            })}
          </ol>
        )}
      </Card>

      <div className="grid grid-cols-3 gap-2">
        <Link to="/rozmowy" className="focus-ring flex flex-col items-center gap-1 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 text-center text-sm font-medium">
          <Mic className="size-6 text-atlantic-600" /> Mówienie
        </Link>
        <Link to="/sluchanie" className="focus-ring flex flex-col items-center gap-1 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 text-center text-sm font-medium">
          <Headphones className="size-6 text-atlantic-600" /> Tryb Auto
        </Link>
        <Link to="/dzwieki" className="focus-ring flex flex-col items-center gap-1 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 text-center text-sm font-medium">
          <Waves className="size-6 text-atlantic-600" /> Dźwięki
        </Link>
      </div>

      <Card className="flex items-center justify-between">
        <div>
          <p className="font-semibold">Powtórki</p>
          <p className="text-sm text-[var(--muted)]">{dueCount > 0 ? `${dueCount} do powtórzenia teraz` : 'Nic zaległego'}</p>
        </div>
        <Link to="/powtorki" className="focus-ring rounded-xl border border-[var(--border)] px-3 py-2 text-sm font-semibold">
          Powtarzaj
        </Link>
      </Card>

      {course.nextLesson && (
        <Card>
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs text-[var(--muted)]">
                Następna lekcja · tydzień {course.nextLesson.week}, dzień {course.nextLesson.day}
              </p>
              <p className="font-semibold">{course.nextLesson.titlePl}</p>
              <p className="text-sm text-[var(--muted)]">~{course.nextLesson.estimatedMinutes} min</p>
            </div>
            {course.nextLesson.status !== 'published' && <Badge tone="warn">treść w weryfikacji</Badge>}
          </div>
        </Card>
      )}
    </div>
  );
}
