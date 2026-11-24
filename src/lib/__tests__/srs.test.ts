import { describe, expect, it } from 'vitest';
import { createScheduler, gradeFrom, newSkillCard, Rating, reviewSkillCard, State } from '@/lib/srs';

describe('FSRS', () => {
  const f = createScheduler({ fuzz: false });
  const t0 = new Date('2026-01-01T10:00:00Z');
  it('mapuje wynik na ocenę', () => {
    expect(gradeFrom({ correct: true })).toBe(Rating.Good);
    expect(gradeFrom({ correct: false })).toBe(Rating.Again);
    expect(gradeFrom({ correct: true, self: 'almost' })).toBe(Rating.Hard);
  });
  it('poprawne odpowiedzi wydłużają odstępy, błąd je skraca', () => {
    let c = newSkillCard('sim', 'recall', t0);
    expect(c.state).toBe(State.New);
    let now = t0;
    const intervals: number[] = [];
    for (let i = 0; i < 4; i++) {
      c = reviewSkillCard(c, Rating.Good, now, f);
      intervals.push(new Date(c.due).getTime() - now.getTime());
      now = new Date(c.due);
    }
    expect(intervals[3]!).toBeGreaterThan(intervals[1]!);
    expect(c.state).toBe(State.Review);
    const lapsed = reviewSkillCard(c, Rating.Again, now, f);
    expect(lapsed.lapses).toBe(1);
    expect(new Date(lapsed.due).getTime() - now.getTime()).toBeLessThan(intervals[3]!);
  });
});
