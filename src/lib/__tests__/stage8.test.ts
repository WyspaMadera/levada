import { describe, expect, it } from 'vitest';
import { content } from '@/content/content';
import { assessArea, competenceRecommendations } from '@/lib/competence';
import { hardestItems, mistakeTrend, weeklyStats } from '@/lib/analysis';
import { createScheduler, newSkillCard, Rating, reviewSkillCard } from '@/lib/srs';
import type { Mistake } from '@/db/db';

const f = createScheduler({ fuzz: false });
const t0 = new Date('2026-01-01T10:00:00Z');
function mastered(itemId: string) {
  let c = newSkillCard(itemId, 'recall', t0);
  let now = t0;
  for (let i = 0; i < 4; i++) {
    c = reviewSkillCard(c, Rating.Good, now, f);
    now = new Date(c.due);
  }
  return c;
}
const area = content.competences.find((a) => a.id === 'powitania')!;

describe('mapa kompetencji', () => {
  it('bez lekcji i kart: przed Tobą', () => {
    expect(assessArea(area, content.items, new Set(), [], []).status).toBe('locked');
  });
  it('poznane → utrwalane → umiesz, zależnie od dowodów', () => {
    const ids = ['bom-dia', 'boa-tarde', 'boa-noite', 'adeus'];
    const fresh = ids.map((id) => newSkillCard(id, 'recall', t0));
    expect(assessArea(area, content.items, new Set(['w01-l02']), fresh, []).status).toBe('introduced');
    const half = [mastered('bom-dia'), mastered('boa-tarde'), ...fresh.slice(2)];
    expect(assessArea(area, content.items, new Set(['w01-l02']), half, []).status).toBe('practicing');
    const all = ids.map(mastered);
    const r = assessArea(area, content.items, new Set(['w01-l02', 'w01-l03']), all, []);
    expect(r.status).toBe('confident');
    expect(r.evidencePl).toMatch(/4 z 4/);
    const errs = Array.from({ length: 3 }, () => ({ itemId: 'bom-dia', category: 'vocabulary', resolved: 0 }) as Mistake);
    expect(assessArea(area, content.items, new Set(['w01-l02']), all, errs).status).toBe('practicing');
  });
  it('rekomenduje obszary z błędami', () => {
    const a = assessArea(area, content.items, new Set(['w01-l02']), [newSkillCard('bom-dia', 'recall', t0)], [{ itemId: 'bom-dia', category: 'meaning', resolved: 0 } as Mistake]);
    expect(competenceRecommendations([a]).map((r) => r.area.id)).toEqual(['powitania']);
  });
  it('każdy obszar ma elementy z jego tagów', () => {
    for (const ar of content.competences) {
      expect([...content.items.values()].some((i) => i.tags.some((t) => ar.tags.includes(t))), ar.id).toBe(true);
    }
  });
});

describe('analiza trudności', () => {
  const now = new Date('2026-03-30T12:00:00Z');
  it('trend błędów: ostatnie 14 dni vs poprzednie', () => {
    const m = (days: number, category: Mistake['category']) => ({ at: new Date(now.getTime() - days * 86_400_000).toISOString(), category }) as Mistake;
    const t = mistakeTrend([m(1, 'ser-estar'), m(3, 'ser-estar'), m(20, 'ser-estar'), m(40, 'listening')], now);
    expect(t).toEqual([{ category: 'ser-estar', recent: 2, previous: 1 }]);
  });
  it('najtrudniejsze elementy wg zapomnień', () => {
    const a = { ...newSkillCard('a', 'recall', t0), lapses: 3 };
    const b = { ...newSkillCard('b', 'recall', t0), lapses: 1 };
    expect(hardestItems([b, a, newSkillCard('c', 'recall', t0)]).map((x) => x.itemId)).toEqual(['a', 'b']);
  });
  it('tygodnie: trafność i minuty', () => {
    const w = weeklyStats(
      [{ exerciseId: 'x', skill: 'listening', correct: true, at: now.toISOString(), context: 'review' }],
      [{ date: '2026-03-30', seconds: 600, speakingSeconds: 0, kind: 'review' }],
      now,
    );
    expect(w).toHaveLength(4);
    expect(w[3]!.bySkill.listening).toEqual({ correct: 1, total: 1 });
    expect(w[3]!.minutes).toBe(10);
  });
});
