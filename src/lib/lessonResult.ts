import type { Skill } from '@/content/schema';
import type { SelfRating } from '@/db/db';

export type ScoredOutcome = {
  kind: 'auto' | 'self';
  correct: boolean;
  self?: SelfRating;
  skill: Skill;
  exerciseId: string;
  itemId?: string;
  expected: string;
  given: string;
};

/** Wynik lekcji 0–1: ćwiczenia automatyczne 1/0; samoocena: umiem 1, prawie 0,5, nie umiem 0. */
export function scoreOutcomes(outcomes: ScoredOutcome[]): number {
  if (!outcomes.length) return 1;
  const pts = outcomes.map((o) => (o.kind === 'auto' ? (o.correct ? 1 : 0) : o.self === 'can' ? 1 : o.self === 'almost' ? 0.5 : 0));
  return pts.reduce<number>((a, b) => a + b, 0) / pts.length;
}
