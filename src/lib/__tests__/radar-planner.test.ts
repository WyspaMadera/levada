import { describe, expect, it } from 'vitest';
import { analyze, type RadarInput } from '@/lib/radar';
import { daysBetween, planDay } from '@/lib/planner';

const base: RadarInput = { recent: {}, overdue: 0, openMistakes: {}, lastLessonScore: null, lastLessonId: null, daysSinceLastActivity: 0, dailyMinutes: 15 };

describe('radar słabości', () => {
  it('bez danych — brak flag, wagi równe, nowa lekcja dozwolona', () => {
    const r = analyze(base);
    expect(r.flags).toEqual([]);
    expect(r.allowNewLesson).toBe(true);
    expect(r.skillWeights.listening).toBeCloseTo(0.2);
  });
  it('słabe słuchanie → więcej słuchania', () => {
    const r = analyze({ ...base, recent: { listening: { correct: 4, total: 10 } } });
    expect(r.flags).toContain('weak-listening');
    expect(r.skillWeights.listening).toBeGreaterThan(r.skillWeights.recognition);
  });
  it('rozpoznaję, ale nie mówię → więcej przypominania i mówienia', () => {
    const r = analyze({ ...base, recent: { recognition: { correct: 9, total: 10 }, recall: { correct: 4, total: 10 } } });
    expect(r.flags).toContain('passive-only');
    expect(r.skillWeights.recall).toBeGreaterThan(r.skillWeights.recognition);
  });
  it('mało prób → bez wniosków', () => {
    expect(analyze({ ...base, recent: { listening: { correct: 0, total: 3 } } }).flags).toEqual([]);
  });
  it('dużo zaległości → bez nowego materiału', () => {
    const r = analyze({ ...base, overdue: 80 });
    expect(r.allowNewLesson).toBe(false);
    expect(r.newCardLimit).toBe(0);
  });
  it('powrót po przerwie → łagodnie, bez kar, powtórzenie ostatniej lekcji', () => {
    const r = analyze({ ...base, daysSinceLastActivity: 6, lastLessonId: 'w01-l03', lastLessonScore: 0.9 });
    expect(r.flags).toContain('comeback');
    expect(r.repeatLessonId).toBe('w01-l03');
    expect(r.messagesPl[0]).toMatch(/Witaj z powrotem/);
  });
  it('błędy w odmianie → ograniczenie nowych', () => {
    expect(analyze({ ...base, openMistakes: { conjugation: 4 } }).newCardLimit).toBeLessThanOrEqual(5);
  });
});

describe('plan dnia', () => {
  const radar = analyze(base);
  const input = { minutes: 15 as const, radar, dueCount: 5, newAvailable: 20, nextLessonId: 'w01-l02', focusSoundId: 'stress', pendingTestId: null, hasLearnedSomething: true };
  it('15 minut: powtórki + nowa lekcja', () => {
    expect(planDay(input).segments.map((s) => s.kind)).toEqual(['review', 'lesson']);
  });
  it('5 minut: powtórka, wymowa, mówienie — bez nowej lekcji', () => {
    expect(planDay({ ...input, minutes: 5 }).segments.map((s) => s.kind)).toEqual(['review', 'pronunciation', 'speaking']);
  });
  it('30 minut: także słuchanie i mówienie', () => {
    expect(planDay({ ...input, minutes: 30 }).segments.map((s) => s.kind)).toEqual(['review', 'lesson', 'listening', 'speaking']);
  });
  it('zaległy sprawdzian ma pierwszeństwo przed nową lekcją', () => {
    expect(planDay({ ...input, pendingTestId: 'w01-test' }).segments.map((s) => s.kind)).toEqual(['review', 'test']);
  });
  it('pierwszy dzień: lekcja bez powtórek', () => {
    expect(planDay({ ...input, dueCount: 0, newAvailable: 0, hasLearnedSomething: false }).segments.map((s) => s.kind)).toEqual(['lesson']);
  });
  it('liczy dni między datami', () => {
    expect(daysBetween('2026-03-28', '2026-04-02')).toBe(5);
  });
});
