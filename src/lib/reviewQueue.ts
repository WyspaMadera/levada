/** Dobór kart do sesji powtórek (czysta funkcja). */
import type { Skill } from '@/content/schema';
import type { SkillCard } from '@/db/db';
import { State } from 'ts-fsrs';

export type QueueOptions = {
  now: Date;
  reviewLimit: number;
  newLimit: number;
  weights: Record<Skill, number>;
  /** Bez audio (brak głosu pt-PT i nagrań) — karty „listening” pomijamy. */
  canListen: boolean;
  /** Ogranicz do wybranych kompetencji (np. tylko mówienie). */
  onlySkills?: Skill[];
};

export function buildQueue(cards: SkillCard[], o: QueueOptions): SkillCard[] {
  const allowed = (c: SkillCard) => (o.canListen || c.skill !== 'listening') && (!o.onlySkills || o.onlySkills.includes(c.skill));
  const t = o.now.getTime();
  const due = cards
    .filter((c) => c.state !== State.New && new Date(c.due).getTime() <= t && allowed(c))
    .sort((a, b) => new Date(a.due).getTime() - new Date(b.due).getTime());
  const fresh = cards.filter((c) => c.state === State.New && allowed(c)).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));

  // kwoty wg wag radaru; reszta uzupełniana najstarszymi zaległymi
  const picked: SkillCard[] = [];
  const used = new Set<string>();
  const skills = Object.keys(o.weights) as Skill[];
  for (const s of skills) {
    const quota = Math.round(o.reviewLimit * o.weights[s]);
    for (const c of due.filter((x) => x.skill === s).slice(0, quota)) {
      picked.push(c);
      used.add(c.id);
    }
  }
  for (const c of due) {
    if (picked.length >= o.reviewLimit) break;
    if (!used.has(c.id)) {
      picked.push(c);
      used.add(c.id);
    }
  }
  const trimmed = picked.slice(0, o.reviewLimit);
  const room = Math.max(0, Math.min(o.newLimit, o.reviewLimit - trimmed.length));
  // nowe: najpierw rozpoznawanie/słuchanie, potem aktywne kompetencje tego samego elementu
  const order: Record<Skill, number> = { recognition: 0, listening: 1, recall: 2, building: 3, speaking: 4 };
  const newPicked = fresh.slice(0, room * 3).sort((a, b) => order[a.skill] - order[b.skill]).slice(0, room);
  return spreadSameItem([...trimmed, ...newPicked]);
}

/** Rozsuwa karty tego samego elementu, by nie występowały jedna po drugiej. */
export function spreadSameItem(cards: SkillCard[]): SkillCard[] {
  const out: SkillCard[] = [];
  const rest = [...cards];
  while (rest.length) {
    const lastItem = out[out.length - 1]?.itemId;
    const idx = rest.findIndex((c) => c.itemId !== lastItem);
    out.push(...rest.splice(idx === -1 ? 0 : idx, 1));
  }
  return out;
}
