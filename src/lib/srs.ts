/** FSRS (ts-fsrs) — harmonogram powtórek dla par (element × kompetencja). */
import { createEmptyCard, fsrs, Rating, State, type Card, type Grade } from 'ts-fsrs';
import type { Skill } from '@/content/schema';
import type { SelfRating, SkillCard } from '@/db/db';

export { Rating, State };

export const SKILL_LABEL_PL: Record<Skill, string> = {
  listening: 'Rozumienie ze słuchu',
  recognition: 'Rozpoznawanie znaczenia',
  recall: 'Przypominanie z pamięci',
  building: 'Budowanie zdań',
  speaking: 'Samodzielne mówienie',
};

export function createScheduler(opts: { fuzz?: boolean } = {}) {
  return fsrs({ request_retention: 0.9, maximum_interval: 365, enable_fuzz: opts.fuzz ?? true });
}

const scheduler = createScheduler();

export function cardId(itemId: string, skill: Skill) {
  return `${itemId}|${skill}`;
}

export function newSkillCard(itemId: string, skill: Skill, now: Date, lessonId?: string): SkillCard {
  const c = createEmptyCard(now);
  return { id: cardId(itemId, skill), itemId, skill, lessonId, createdAt: now.toISOString(), ...c };
}

function toCard(sc: SkillCard): Card {
  return {
    due: new Date(sc.due),
    stability: sc.stability,
    difficulty: sc.difficulty,
    elapsed_days: sc.elapsed_days,
    scheduled_days: sc.scheduled_days,
    learning_steps: sc.learning_steps,
    reps: sc.reps,
    lapses: sc.lapses,
    state: sc.state,
    last_review: sc.last_review ? new Date(sc.last_review) : undefined,
  };
}

/** Ocena FSRS na podstawie wyniku. Poprawna odpowiedź = Good; samoocena „prawie” = Hard; błąd = Again. */
export function gradeFrom(result: { correct: boolean; self?: SelfRating }): Grade {
  if (result.self === 'almost') return Rating.Hard;
  if (result.self === 'cannot') return Rating.Again;
  if (result.self === 'can') return Rating.Good;
  return result.correct ? Rating.Good : Rating.Again;
}

export function reviewSkillCard(sc: SkillCard, grade: Grade, now: Date, f = scheduler): SkillCard {
  const { card } = f.next(toCard(sc), now, grade);
  return { ...sc, ...card };
}

export function isDue(sc: SkillCard, now: Date) {
  return new Date(sc.due).getTime() <= now.getTime();
}

/** Karty zaległe (już po terminie powtórki) — tylko te, które były już powtarzane. */
export function isOverdue(sc: SkillCard, now: Date) {
  return sc.state !== State.New && isDue(sc, now);
}
