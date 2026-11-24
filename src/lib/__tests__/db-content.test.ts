import { beforeEach, describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { db } from '@/db/db';
import { completeLesson, ensureSettings, recordResult, radarInput } from '@/db/repo';
import { exportData, importData } from '@/db/backup';
import { lintContent } from '../../../scripts/content-lint-core';
import { scoreOutcomes } from '@/lib/lessonResult';

describe('IndexedDB: lekcja → karty → wynik → eksport/import', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });
  it('ukończenie lekcji tworzy karty dla osobnych kompetencji', async () => {
    await ensureSettings();
    await completeLesson({ lessonId: 'w01-l01', score: 0.8, newItemIds: ['sim'], studyItemIds: ['sim', 'cafe-q'], sentenceItemIds: ['cafe-q'] });
    const skills = (await db.cards.where('itemId').equals('sim').toArray()).map((c) => c.skill).sort();
    expect(skills).toEqual(['listening', 'recall', 'recognition', 'speaking']);
    expect(await db.cards.get('cafe-q|building')).toBeTruthy();
    expect((await db.lessonProgress.get('w01-l01'))?.status).toBe('completed');
  });
  it('błąd trafia do zeszytu, dwie poprawne odpowiedzi go zamykają', async () => {
    await recordResult({ itemId: 'sim', skill: 'recall', correct: false, context: 'review', mistake: { category: 'vocabulary', expected: 'sim', given: 'não' } });
    expect(await db.mistakes.where('resolved').equals(0).count()).toBe(1);
    await recordResult({ itemId: 'sim', skill: 'recall', correct: true, context: 'review' });
    await recordResult({ itemId: 'sim', skill: 'recall', correct: true, context: 'review' });
    expect(await db.mistakes.where('resolved').equals(0).count()).toBe(0);
    const input = await radarInput(new Date(), 15);
    expect(input.recent.recall).toEqual({ correct: 2, total: 3 });
  });
  it('eksport i import zachowują dane (z datami kart)', async () => {
    await completeLesson({ lessonId: 'w01-l01', score: 1, newItemIds: ['sim'], studyItemIds: ['sim'], sentenceItemIds: [] });
    const dump = JSON.parse(JSON.stringify(await exportData()));
    await db.cards.clear();
    const s = await importData(dump);
    expect(s.cards).toBe(4);
    expect((await db.cards.get('sim|recall'))?.due).toBeInstanceOf(Date);
    await expect(importData({ foo: 1 })).rejects.toThrow(/kopii zapasowej/);
  });
});

describe('treść kursu przechodzi walidację', () => {
  it('brak błędów krytycznych w content/', () => {
    const root = join(__dirname, '../../..');
    const walk = (d: string): string[] => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : f.endsWith('.json') ? [join(d, f)] : []));
    const raw: Record<string, unknown> = {};
    for (const f of walk(join(root, 'content'))) raw[relative(root, f)] = JSON.parse(readFileSync(f, 'utf8'));
    const r = lintContent(raw);
    expect(r.findings.filter((f) => f.severity === 'critical')).toEqual([]);
    expect(r.stats.lessons).toBeGreaterThanOrEqual(12);
    // żaden element nie udaje weryfikacji przez człowieka
    expect(r.stats.byStatus.humanVerified ?? 0).toBe(0);
  });
});

describe('wynik lekcji', () => {
  it('samoocena „prawie” = pół punktu', () => {
    expect(scoreOutcomes([
      { kind: 'auto', correct: true, skill: 'recall', exerciseId: 'a', expected: '', given: '' },
      { kind: 'self', correct: true, self: 'almost', skill: 'speaking', exerciseId: 'b', expected: '', given: '' },
    ])).toBeCloseTo(0.75);
  });
});
