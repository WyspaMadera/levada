/** Zapis wyniku jednej wypowiedzi w rozmowie: harmonogram mówienia (FSRS), zeszyt błędów, dziennik mówienia. */
import type { SelfRating } from '@/db/db';
import { logSpeaking, recordResult } from '@/db/repo';
import { getItem } from './items';

export async function recordSpokenAnswer(args: { answerItemIds: string[]; self: SelfRating; seconds: number; context: 'conversation'; exerciseId: string }) {
  const first = args.answerItemIds[0];
  if (!first) return;
  await logSpeaking({ itemId: first, selfRating: args.self, seconds: args.seconds, context: args.context });
  // aktualizujemy kartę „mówienie” pierwszego wariantu; nieudana próba trafia do zeszytu błędów
  await recordResult({
    itemId: first,
    skill: 'speaking',
    correct: args.self !== 'cannot',
    self: args.self,
    context: 'review',
    exerciseId: args.exerciseId,
    mistake: args.self === 'cannot' ? { category: 'building', expected: getItem(first).pt, given: '(nie udało się odpowiedzieć samodzielnie)' } : undefined,
  });
}

export function ratingSummary(r: SelfRating[]) {
  return { can: r.filter((x) => x === 'can').length, almost: r.filter((x) => x === 'almost').length, cannot: r.filter((x) => x === 'cannot').length };
}
