import { useLiveQuery } from 'dexie-react-hooks';
import { State } from 'ts-fsrs';
import { content } from '@/content/content';
import { db } from '@/db/db';
import { radarInput } from '@/db/repo';
import { analyze, type RadarOutput } from '@/lib/radar';
import { planDay, todayKey, type DailyPlan, type PlanSegment } from '@/lib/planner';
import { useApp } from './AppContext';
import { useCourse, type CourseState } from './course';

export type DailyState = {
  loaded: boolean;
  plan: DailyPlan | null;
  radar: RadarOutput | null;
  course: CourseState;
  doneToday: (seg: PlanSegment) => boolean;
  href: (seg: PlanSegment) => string;
  dueCount: number;
  newCount: number;
};

export function segmentHref(seg: PlanSegment, opts: { questionsAvailable?: boolean } = {}): string {
  switch (seg.kind) {
    case 'review':
      return `/powtorki?n=${seg.cards}`;
    case 'lesson':
      return `/lekcja/${seg.lessonId}`;
    case 'pronunciation':
      return `/dzwieki/${seg.soundId}?trening=1`;
    case 'speaking':
      // pytania bez scenariusza (spontaniczne mówienie), a gdy jeszcze niedostępne — powtórki mówienia
      return opts.questionsAvailable ? `/rozmowy/pytania?n=${seg.prompts}` : `/powtorki?tryb=mowienie&n=${seg.prompts}`;
    case 'listening':
      return '/sluchanie';
    case 'test':
      return `/sprawdzian/${seg.testId}`;
  }
}

export function useDaily(): DailyState {
  const { todayMinutes, audio } = useApp();
  const course = useCourse();
  const today = todayKey();
  const data = useLiveQuery(async () => {
    const now = new Date();
    const [input, cards, sessions] = await Promise.all([
      radarInput(now, todayMinutes),
      db.cards.toArray(),
      db.studySessions.where('date').equals(today).toArray(),
    ]);
    return { input, cards, sessions, now };
  }, [todayMinutes, today]);

  if (!data || !course.loaded) {
    return { loaded: false, plan: null, radar: null, course, doneToday: () => false, href: (s) => segmentHref(s), dueCount: 0, newCount: 0 };
  }
  const canListen = Boolean(audio?.choice.voice) || Object.keys(content.audio.files).length > 0;
  const radar = analyze(data.input);
  const usable = data.cards.filter((c) => canListen || c.skill !== 'listening');
  const dueCount = usable.filter((c) => c.state !== State.New && new Date(c.due) <= data.now).length;
  const newCount = usable.filter((c) => c.state === State.New).length;
  const focus = course.nextLesson ?? course.lessons[course.lessons.length - 1];
  const plan = planDay({
    minutes: todayMinutes,
    radar,
    dueCount,
    newAvailable: newCount,
    nextLessonId: course.nextLesson?.id ?? null,
    focusSoundId: focus?.warmup.soundId ?? 'stress',
    pendingTestId: course.pendingTestId,
    hasLearnedSomething: course.completedIds.size > 0,
  });
  const kinds = new Set(data.sessions.map((s) => s.kind));
  const doneToday = (seg: PlanSegment) => {
    switch (seg.kind) {
      case 'review':
        return kinds.has('review');
      case 'lesson':
        return course.progress.get(seg.lessonId)?.completedAt?.slice(0, 10) === new Date().toISOString().slice(0, 10) || (kinds.has('lesson') && seg.repeat);
      case 'pronunciation':
        return kinds.has('lab');
      case 'speaking':
        return kinds.has('speaking');
      case 'listening':
        return kinds.has('listening');
      case 'test':
        return course.testResults.some((t) => t.testId === seg.testId);
    }
  };
  const questionsAvailable = content.questions.some((q) => course.completedIds.has(q.unlockAfterLessonId));
  return { loaded: true, plan, radar, course, doneToday, href: (s) => segmentHref(s, { questionsAvailable }), dueCount, newCount };
}
