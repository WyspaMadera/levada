/** Zamiana karty FSRS (element × kompetencja) na konkretne zadanie. */
import type { Exercise, LearningItem } from '@/content/schema';
import type { SkillCard } from '@/db/db';
import { distractors, getItem, tilesFor } from './items';
import { shuffle } from './answers';

export function taskForCard(card: SkillCard, knownItemIds: string[], rnd = Math.random): Exercise {
  const item = getItem(card.itemId);
  const base = `rev-${card.id}`.replace(/[^a-z0-9-]/g, '-');
  const opts = (n: number) => shuffle([item.id, ...distractors(item, knownItemIds, n, rnd).map((d) => d.id)], rnd);
  switch (card.skill) {
    case 'recognition':
      return { id: base, type: 'readChoose', targetItemId: item.id, optionItemIds: opts(3) };
    case 'listening':
      return { id: base, type: 'listenChoose', targetItemId: item.id, optionItemIds: opts(3) };
    case 'recall':
      if (item.kind === 'sentence') return { id: base, type: 'recallSay', targetItemId: item.id, promptPl: 'Przypomnij sobie i powiedz po portugalsku:' };
      return card.reps >= 2 && item.pt.split(/\s+/).length <= 4
        ? { id: base, type: 'typeAnswer', targetItemId: item.id }
        : { id: base, type: 'recallChoose', targetItemId: item.id, optionItemIds: opts(2) };
    case 'building': {
      const tiles = tilesFor(item.pt);
      if (tiles.length < 2) return { id: base, type: 'recallSay', targetItemId: item.id };
      const extra = distractors(item, knownItemIds, 4, rnd)
        .flatMap((d: LearningItem) => tilesFor(d.pt))
        .filter((t) => !tiles.map((x) => x.toLowerCase()).includes(t.toLowerCase()));
      return { id: base, type: 'buildSentence', targetItemId: item.id, tiles, distractors: shuffle(extra, rnd).slice(0, 2) };
    }
    case 'speaking':
      return { id: base, type: 'recallSay', targetItemId: item.id };
  }
}
