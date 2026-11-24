/** Plan dnia: z czasu użytkownika (5/15/30 min), radaru słabości i stanu kursu. Czysta funkcja — testowana. */
import type { RadarOutput } from './radar';

export type PlanSegment =
  | { kind: 'review'; minutes: number; cards: number; labelPl: string }
  | { kind: 'lesson'; minutes: number; lessonId: string; repeat: boolean; labelPl: string }
  | { kind: 'pronunciation'; minutes: number; soundId: string; labelPl: string }
  | { kind: 'speaking'; minutes: number; prompts: number; labelPl: string }
  | { kind: 'listening'; minutes: number; labelPl: string }
  | { kind: 'test'; minutes: number; testId: string; labelPl: string };

export type DailyPlan = { minutes: 5 | 15 | 30; segments: PlanSegment[]; notesPl: string[] };

export type PlannerInput = {
  minutes: 5 | 15 | 30;
  radar: RadarOutput;
  /** Kart do powtórki dziś (zaległe + nowe dopuszczone limitem). */
  dueCount: number;
  newAvailable: number;
  nextLessonId: string | null;
  /** Dźwięk z rozgrzewki następnej (lub ostatniej) lekcji. */
  focusSoundId: string;
  /** Test tygodnia czekający na wykonanie (lekcja z testem ukończona, test nie). */
  pendingTestId: string | null;
  hasLearnedSomething: boolean;
};

export function planDay(p: PlannerInput): DailyPlan {
  const segments: PlanSegment[] = [];
  const notesPl = [...p.radar.messagesPl];
  const reviewCards = Math.min(p.dueCount + Math.min(p.newAvailable, p.radar.newCardLimit), p.radar.reviewLimit);

  const lessonId = p.radar.repeatLessonId ?? (p.radar.allowNewLesson ? p.nextLessonId : null);
  const isRepeat = Boolean(p.radar.repeatLessonId);

  if (p.minutes === 5) {
    if (reviewCards > 0) segments.push({ kind: 'review', minutes: 2, cards: Math.min(reviewCards, 8), labelPl: 'Krótka powtórka' });
    segments.push({ kind: 'pronunciation', minutes: 1, soundId: p.focusSoundId, labelPl: 'Jedno ćwiczenie wymowy' });
    if (p.hasLearnedSomething) segments.push({ kind: 'speaking', minutes: 2, prompts: 2, labelPl: 'Dwa krótkie pytania ustne' });
    else if (p.nextLessonId) segments.push({ kind: 'lesson', minutes: 10, lessonId: p.nextLessonId, repeat: false, labelPl: 'Pierwsza lekcja (jeśli znajdziesz chwilę)' });
    if (!p.hasLearnedSomething) notesPl.push('Na start najlepiej znaleźć 10–15 minut na pierwszą lekcję.');
    return { minutes: 5, segments, notesPl };
  }

  if (reviewCards > 0)
    segments.push({ kind: 'review', minutes: p.minutes === 15 ? 3 : 5, cards: reviewCards, labelPl: 'Powtórki' });

  if (p.pendingTestId && !isRepeat) {
    segments.push({ kind: 'test', minutes: 8, testId: p.pendingTestId, labelPl: 'Sprawdzian tygodnia' });
  } else if (lessonId) {
    segments.push({
      kind: 'lesson',
      minutes: p.minutes === 15 ? 12 : 15,
      lessonId,
      repeat: isRepeat,
      labelPl: isRepeat ? 'Powtórzenie lekcji' : 'Nowa lekcja',
    });
  } else if (!p.nextLessonId) {
    notesPl.push('Ukończyłeś wszystkie dostępne lekcje. Kolejne tygodnie są w przygotowaniu — powtórki i mówienie nadal działają.');
  }

  if (p.minutes === 30) {
    if (p.hasLearnedSomething) {
      segments.push({ kind: 'listening', minutes: 5, labelPl: 'Słuchanie dialogów' });
      segments.push({ kind: 'speaking', minutes: 5, prompts: 5, labelPl: 'Mówienie i budowanie zdań' });
    }
  } else if (!lessonId && p.hasLearnedSomething) {
    segments.push({ kind: 'speaking', minutes: 4, prompts: 4, labelPl: 'Mówienie' });
  }

  return { minutes: p.minutes, segments, notesPl };
}

export function todayKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function daysBetween(a: string, b: string): number {
  const [ya, ma, da] = a.split('-').map(Number) as [number, number, number];
  const [yb, mb, db] = b.split('-').map(Number) as [number, number, number];
  return Math.round((Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / 86_400_000);
}
