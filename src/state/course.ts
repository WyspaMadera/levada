import { useLiveQuery } from 'dexie-react-hooks';
import { content } from '@/content/content';
import { visibleLessons } from '@/content/index';
import type { Lesson } from '@/content/schema';
import { db, type LessonProgress, type TestResult } from '@/db/db';

export type CourseState = {
  loaded: boolean;
  lessons: Lesson[];
  progress: Map<string, LessonProgress>;
  completedIds: Set<string>;
  nextLesson: Lesson | null;
  currentWeek: number;
  /** Test tygodnia, którego lekcja jest ukończona, ale test jeszcze nie był pisany. */
  pendingTestId: string | null;
  testResults: TestResult[];
};

export function computeCourse(lessons: Lesson[], progressRows: LessonProgress[], tests: TestResult[]): Omit<CourseState, 'loaded'> {
  const progress = new Map(progressRows.map((p) => [p.lessonId, p]));
  const completedIds = new Set(progressRows.filter((p) => p.status === 'completed').map((p) => p.lessonId));
  const nextLesson = lessons.find((l) => !completedIds.has(l.id)) ?? null;
  const lastDone = [...lessons].reverse().find((l) => completedIds.has(l.id));
  const currentWeek = nextLesson?.week ?? lastDone?.week ?? 1;
  const doneTests = new Set(tests.map((t) => t.testId));
  const pending = lessons.find((l) => l.testId && completedIds.has(l.id) && !doneTests.has(l.testId));
  return { lessons, progress, completedIds, nextLesson, currentWeek, pendingTestId: pending?.testId ?? null, testResults: tests };
}

export function useCourse(): CourseState {
  const lessons = visibleLessons(content);
  const rows = useLiveQuery(() => db.lessonProgress.toArray(), []);
  const tests = useLiveQuery(() => db.testResults.toArray(), []);
  const base = computeCourse(lessons, rows ?? [], tests ?? []);
  return { ...base, loaded: rows !== undefined && tests !== undefined };
}

export function stopForWeek(week: number) {
  return content.stops.find((s) => week >= s.weeks[0] && week <= s.weeks[1]);
}
