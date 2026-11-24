import { describe, expect, it } from 'vitest';
import { buildQueue, spreadSameItem } from '@/lib/reviewQueue';
import { newSkillCard, reviewSkillCard, Rating, createScheduler } from '@/lib/srs';
import { classifyVoice, pickVoice } from '@/lib/voices';
import { backchainFragments, blockStarts, buildAutoSteps, itemsForMinutes, loadProgress, saveProgress } from '@/lib/autoSession';
import type { SkillCard } from '@/db/db';
import type { Skill } from '@/content/schema';

const W: Record<Skill, number> = { listening: 0.2, recognition: 0.2, recall: 0.2, building: 0.2, speaking: 0.2 };

describe('kolejka powtórek', () => {
  const f = createScheduler({ fuzz: false });
  const t0 = new Date('2026-01-01T10:00:00Z');
  const reviewed = (id: string, skill: Skill): SkillCard => reviewSkillCard(newSkillCard(id, skill, t0), Rating.Good, t0, f);
  it('zaległe przed nowymi, z limitami', () => {
    const later = new Date('2026-02-01T10:00:00Z');
    const cards = [reviewed('a', 'recall'), reviewed('b', 'recognition'), newSkillCard('c', 'recognition', t0), newSkillCard('d', 'recognition', t0)];
    const q = buildQueue(cards, { now: later, reviewLimit: 3, newLimit: 1, weights: W, canListen: true });
    expect(q).toHaveLength(3);
    expect(q.filter((c) => c.reps === 0)).toHaveLength(1);
  });
  it('bez audio pomija słuchanie', () => {
    const q = buildQueue([newSkillCard('a', 'listening', t0), newSkillCard('b', 'recognition', t0)], { now: t0, reviewLimit: 5, newLimit: 5, weights: W, canListen: false });
    expect(q.map((c) => c.skill)).toEqual(['recognition']);
  });
  it('rozsuwa ten sam element', () => {
    const s = spreadSameItem([newSkillCard('a', 'recall', t0), newSkillCard('a', 'speaking', t0), newSkillCard('b', 'recall', t0)]);
    expect(s.map((c) => c.itemId)).toEqual(['a', 'b', 'a']);
  });
});

describe('wybór głosu — nigdy po cichu pt-BR', () => {
  const pt = { name: 'Joana', lang: 'pt-PT', voiceURI: 'joana', localService: true };
  const br = { name: 'Luciana', lang: 'pt-BR', voiceURI: 'luciana', localService: true };
  it('klasyfikuje głosy', () => {
    expect(classifyVoice(pt)).toBe('pt-PT');
    expect(classifyVoice({ ...pt, lang: 'pt_PT' })).toBe('pt-PT');
    expect(classifyVoice(br)).toBe('pt-BR');
    expect(classifyVoice({ name: 'Google português', lang: 'pt', voiceURI: 'x', localService: false })).toBe('pt-unknown');
  });
  it('preferuje pt-PT, bez zgody nie używa pt-BR', () => {
    expect(pickVoice([br, pt], null, false).status).toBe('pt-PT');
    expect(pickVoice([br], null, false)).toEqual({ status: 'none', voice: null, brAvailable: true });
    expect(pickVoice([br], null, true).status).toBe('pt-BR-fallback');
  });
});

describe('Tryb Auto', () => {
  it('schemat: PL → pauza → PT → pauza → PT', () => {
    const s = buildAutoSteps([{ id: 'sim', pl: 'tak', pt: 'sim' }], { polishPrompts: 'full', answerPauseMs: 3000, repeatPauseMs: 2000 });
    expect(s.map((x) => x.kind)).toEqual(['pl', 'pause', 'pt', 'pause', 'pt', 'pause']);
  });
  it('ograniczanie podpowiedzi po polsku', () => {
    const items = [1, 2, 3, 4].map((i) => ({ id: `x${i}`, pl: 'p', pt: 'olá', knownWell: i > 2 }));
    expect(buildAutoSteps(items, { polishPrompts: 'reduced', answerPauseMs: 1, repeatPauseMs: 1 }).filter((s) => s.kind === 'pl')).toHaveLength(2);
    expect(buildAutoSteps(items, { polishPrompts: 'none', answerPauseMs: 1, repeatPauseMs: 1 }).filter((s) => s.kind === 'pl')).toHaveLength(0);
  });
  it('„tylko trudne”: polska podpowiedź tylko dla słabo znanych', () => {
    const items = [1, 2, 3, 4].map((i) => ({ id: `x${i}`, pl: 'p', pt: 'olá', knownWell: i > 2 }));
    const pl = buildAutoSteps(items, { polishPrompts: 'auto', answerPauseMs: 1, repeatPauseMs: 1 }).filter((s) => s.kind === 'pl');
    expect(pl.map((s) => s.itemId)).toEqual(['x1', 'x2']);
  });
  it('budowanie od końca dla długich zdań', () => {
    expect(backchainFragments('Não falo bem português.')).toEqual([]);
    expect(backchainFragments('Eu também falo um pouco de polaco!')).toEqual(['de polaco', 'um pouco de polaco', 'também falo um pouco de polaco']);
    const s = buildAutoSteps([{ id: 'a', pl: 'p', pt: 'Eu também falo um pouco de polaco!' }], { polishPrompts: 'none', answerPauseMs: 1, repeatPauseMs: 1, backchain: true });
    expect(s.filter((x) => x.kind === 'pt-text')).toHaveLength(3);
    expect(blockStarts(s)).toEqual([0]);
  });
  it('bloki = początki kolejnych elementów', () => {
    const s = buildAutoSteps(['a', 'b', 'c'].map((id) => ({ id, pl: 'p', pt: 'olá' })), { polishPrompts: 'full', answerPauseMs: 1, repeatPauseMs: 1 });
    expect(blockStarts(s).map((i) => (s[i] as { itemId: string }).itemId)).toEqual(['a', 'b', 'c']);
  });
  it('zapamiętuje pozycję tylko dla tej samej sesji', () => {
    saveProgress('sesja-1', 7);
    expect(loadProgress('sesja-1')).toBe(7);
    expect(loadProgress('inna')).toBe(0);
  });
  it('dłuższa sesja = więcej elementów', () => {
    const o = { polishPrompts: 'full' as const, answerPauseMs: 3500, repeatPauseMs: 2500 };
    expect(itemsForMinutes(10, o)).toBeGreaterThan(itemsForMinutes(5, o));
  });
});
