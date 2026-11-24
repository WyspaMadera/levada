/**
 * Mapa kompetencji — status obszaru oparty na DOWODACH (ukończone lekcje, samodzielne przywołania, błędy),
 * bez „procentów płynności”. Czysta funkcja.
 */
import type { CompetenceArea, LearningItem } from '@/content/schema';
import type { Mistake, SkillCard } from '@/db/db';
import { State } from 'ts-fsrs';

export type CompetenceStatus = 'locked' | 'introduced' | 'practicing' | 'confident';

export type CompetenceResult = {
  area: CompetenceArea;
  status: CompetenceStatus;
  lessonsDone: number;
  lessonsTotal: number;
  /** Poznane elementy obszaru (mają karty powtórek). */
  known: number;
  /** Elementy przywołane lub wypowiedziane samodzielnie co najmniej 2 razy (karta przypominania/mówienia w stanie Review). */
  active: number;
  openMistakes: number;
  evidencePl: string;
};

export const STATUS_PL: Record<CompetenceStatus, string> = {
  locked: 'jeszcze przed Tobą',
  introduced: 'poznane',
  practicing: 'w trakcie utrwalania',
  confident: 'umiesz (potwierdzone powtórkami)',
};

export function isActiveCard(c: SkillCard) {
  return (c.skill === 'recall' || c.skill === 'speaking') && c.state === State.Review && c.reps - c.lapses >= 2;
}

export function assessArea(
  area: CompetenceArea,
  items: Map<string, LearningItem>,
  completed: Set<string>,
  cards: SkillCard[],
  openMistakes: Mistake[],
): CompetenceResult {
  const lessonsDone = area.lessonIds.filter((l) => completed.has(l)).length;
  const tagSet = new Set(area.tags);
  const inArea = (id: string) => items.get(id)?.tags.some((t) => tagSet.has(t)) ?? false;
  const areaCards = cards.filter((c) => inArea(c.itemId));
  const knownIds = new Set(areaCards.map((c) => c.itemId));
  const activeIds = new Set(areaCards.filter(isActiveCard).map((c) => c.itemId));
  const mistakes = openMistakes.filter((m) => m.itemId && knownIds.has(m.itemId)).length;
  const known = knownIds.size;
  const active = activeIds.size;
  let status: CompetenceStatus;
  if (lessonsDone === 0 && known === 0) status = 'locked';
  else if (known > 0 && active / known >= 0.6 && mistakes <= 2) status = 'confident';
  else if (known > 0 && active / known >= 0.25) status = 'practicing';
  else status = 'introduced';
  const evidencePl =
    status === 'locked'
      ? `Lekcje tego obszaru: 0 z ${area.lessonIds.length}.`
      : `Lekcje: ${lessonsDone} z ${area.lessonIds.length} · samodzielnie przywołane (2+ razy): ${active} z ${known} poznanych zwrotów` +
        (mistakes ? ` · otwarte błędy: ${mistakes}` : '');
  return { area, status, lessonsDone, lessonsTotal: area.lessonIds.length, known, active, openMistakes: mistakes, evidencePl };
}

/** Rekomendacje: obszary rozpoczęte, ale najsłabiej utrwalone (najpierw te z błędami). */
export function competenceRecommendations(results: CompetenceResult[], max = 3) {
  return results
    .filter((r) => r.status === 'introduced' || r.status === 'practicing')
    .sort((a, b) => b.openMistakes - a.openMistakes || a.active / Math.max(1, a.known) - b.active / Math.max(1, b.known))
    .slice(0, max);
}
