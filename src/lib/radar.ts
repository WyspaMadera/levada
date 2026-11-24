/**
 * Radar słabości — prosty, testowalny silnik rekomendacji (reguły z CURRICULUM.md).
 * Nie tworzy żadnych „wskaźników inteligencji” ani procentów płynności — tylko reguły na faktach.
 */
import type { MistakeCategory, Skill } from '@/content/schema';

export type SkillStat = { correct: number; total: number };

export type RadarInput = {
  /** Wyniki z ostatnich 14 dni wg kompetencji. */
  recent: Partial<Record<Skill, SkillStat>>;
  /** Liczba kart po terminie (powtarzanych już wcześniej). */
  overdue: number;
  /** Otwarte wpisy w zeszycie błędów wg kategorii. */
  openMistakes: Partial<Record<MistakeCategory, number>>;
  /** Wynik ostatnio ukończonej lekcji (0–1). */
  lastLessonScore: number | null;
  lastLessonId: string | null;
  /** Dni od ostatniej aktywności (null = pierwszy dzień). */
  daysSinceLastActivity: number | null;
  dailyMinutes: 5 | 15 | 30;
};

export type RadarFlag = 'many-overdue' | 'comeback' | 'weak-listening' | 'passive-only' | 'low-lesson-score' | 'ser-estar' | 'conjugation';

export type RadarOutput = {
  flags: RadarFlag[];
  weakSkills: Skill[];
  strongSkills: Skill[];
  /** Wagi doboru kart w powtórkach (sumują się do 1). */
  skillWeights: Record<Skill, number>;
  allowNewLesson: boolean;
  repeatLessonId: string | null;
  reviewLimit: number;
  newCardLimit: number;
  /** Komunikaty po polsku — konkretne, bez ocen „inteligencji”. */
  messagesPl: string[];
};

export const MIN_ATTEMPTS = 8;
const SKILLS: Skill[] = ['listening', 'recognition', 'recall', 'building', 'speaking'];

export function accuracy(s: SkillStat | undefined): number | null {
  if (!s || s.total < MIN_ATTEMPTS) return null;
  return s.correct / s.total;
}

export function baseReviewLimit(minutes: 5 | 15 | 30) {
  return minutes === 5 ? 10 : minutes === 15 ? 15 : 25;
}

export function analyze(input: RadarInput): RadarOutput {
  const flags: RadarFlag[] = [];
  const messagesPl: string[] = [];
  const weights: Record<Skill, number> = { listening: 1, recognition: 1, recall: 1, building: 1, speaking: 1 };
  let reviewLimit = baseReviewLimit(input.dailyMinutes);
  let newCardLimit = input.dailyMinutes === 5 ? 4 : input.dailyMinutes === 15 ? 10 : 16;
  let allowNewLesson = input.dailyMinutes !== 5;
  let repeatLessonId: string | null = null;

  const acc = Object.fromEntries(SKILLS.map((s) => [s, accuracy(input.recent[s])])) as Record<Skill, number | null>;
  const weakSkills = SKILLS.filter((s) => acc[s] !== null && acc[s]! < 0.7);
  const strongSkills = SKILLS.filter((s) => acc[s] !== null && acc[s]! >= 0.85);

  // 2. Powrót po przerwie — bez kar, łagodniej.
  if (input.daysSinceLastActivity !== null && input.daysSinceLastActivity >= 3) {
    flags.push('comeback');
    reviewLimit = Math.max(6, Math.round(reviewLimit * 0.6));
    newCardLimit = Math.round(newCardLimit / 2);
    allowNewLesson = false;
    repeatLessonId = input.lastLessonId;
    messagesPl.push(
      `Witaj z powrotem! Minęło ${input.daysSinceLastActivity} dni — to nic złego. Dziś spokojnie: krótkie powtórki i odświeżenie ostatniej lekcji.`,
    );
  }

  // 1. Dużo zaległych powtórek.
  if (input.overdue > Math.max(40, 2 * baseReviewLimit(input.dailyMinutes))) {
    flags.push('many-overdue');
    allowNewLesson = false;
    newCardLimit = 0;
    messagesPl.push(`Masz ${input.overdue} zaległych powtórek. Dziś bez nowego materiału — utrwalamy to, co już znasz.`);
  }

  // 3. Słabe słuchanie.
  if (acc.listening !== null && acc.listening < 0.7) {
    flags.push('weak-listening');
    weights.listening = 2.5;
    messagesPl.push('Słuchanie sprawia Ci trudność — w powtórkach będzie więcej ćwiczeń ze słuchu. Pomaga też wolniejsze tempo (0,75×).');
  }

  // 4. Rozpoznaję, ale nie mówię.
  const passiveGood = acc.recognition !== null && acc.recognition >= 0.8;
  const activeWeak = (acc.recall !== null && acc.recall < 0.6) || (acc.speaking !== null && acc.speaking < 0.6);
  if (passiveGood && activeWeak) {
    flags.push('passive-only');
    weights.recall = 2.5;
    weights.speaking = 2.5;
    weights.recognition = 0.5;
    messagesPl.push('Dobrze rozpoznajesz słowa, ale trudniej Ci je przywołać. Więcej przypominania i mówienia na głos.');
  }

  // 5. Słaby wynik ostatniej lekcji.
  if (input.lastLessonScore !== null && input.lastLessonScore < 0.6 && input.lastLessonId) {
    flags.push('low-lesson-score');
    repeatLessonId = input.lastLessonId;
    allowNewLesson = false;
    messagesPl.push('Ostatnia lekcja poszła słabiej — proponujemy ją powtórzyć przed nową. (Nic nie jest zablokowane.)');
  }

  const serEstar = input.openMistakes['ser-estar'] ?? 0;
  if (serEstar >= 3) {
    flags.push('ser-estar');
    weights.building += 1;
    messagesPl.push(`W zeszycie błędów jest ${serEstar}× „ser czy estar”. Warto przejrzeć lekcję o estar.`);
  }
  const conj = input.openMistakes.conjugation ?? 0;
  if (conj >= 3) {
    flags.push('conjugation');
    newCardLimit = Math.min(newCardLimit, 5);
    messagesPl.push('Odmiana czasowników wymaga utrwalenia — mniej nowych słów, więcej powtórek.');
  }

  const sum = SKILLS.reduce((a, s) => a + weights[s], 0);
  const skillWeights = Object.fromEntries(SKILLS.map((s) => [s, weights[s] / sum])) as Record<Skill, number>;
  return { flags, weakSkills, strongSkills, skillWeights, allowNewLesson, repeatLessonId, reviewLimit, newCardLimit, messagesPl };
}
