import { describe, expect, it } from 'vitest';
import { checkPronunciation, describeStress, orthoNuclei, phonSyllables, predictStressFromEnd, ptTokens } from '@/content/phonetics';

describe('przewidywanie akcentu z pisowni', () => {
  it.each([
    ['obrigado', 2],
    ['Portugal', 1],
    ['café', 1],
    ['Polónia', 3],
    ['português', 1],
    ['adeus', 1],
    ['igualmente', 2],
    ['quatro', 2],
    ['têm', 2],
    ['não', 1],
    ['falar', 1],
  ])('%s → %i. sylaba od końca', (w, n) => expect(predictStressFromEnd(w)).toBe(n));

  it('rozpoznaje dyftongi i qu/gu', () => {
    expect(orthoNuclei('muito')).toHaveLength(2);
    expect(orthoNuclei('dia')).toHaveLength(2);
    expect(orthoNuclei('água')).toHaveLength(2);
    expect(orthoNuclei('mãe')).toHaveLength(1);
  });
});

describe('tokeny PT', () => {
  it('łączy klityki, rozdziela złożenia', () => {
    expect(ptTokens('Chamo-me Ana.')).toEqual(['Chamo-me', 'Ana']);
    expect(ptTokens('segunda-feira')).toEqual(['segunda', 'feira']);
    expect(ptTokens('Como se diz … em português?')).toEqual(['Como', 'se', 'diz', 'em', 'português']);
  });
});

describe('kontrola zapisu Fonetyka PL', () => {
  it('poprawny zapis nie ma uwag', () => {
    expect(checkPronunciation('obrigado', 'o-bri-GA-du')).toEqual([]);
    expect(checkPronunciation('Portugal', 'pur-tu-GAɫ')).toEqual([]);
    expect(checkPronunciation('Chamo-me Ana.', 'SZĂ-mu-my Ă-nă.')).toEqual([]);
  });
  it('wykrywa brak akcentu i błędną pozycję', () => {
    expect(checkPronunciation('obrigado', 'o-bri-ga-du').some((i) => i.code === 'stress-marking')).toBe(true);
    expect(checkPronunciation('Portugal', 'pur-TU-gaɫ').some((i) => i.code === 'stress-position')).toBe(true);
  });
  it('wykrywa „ł”, znaki pisowni i zgubioną nosowość', () => {
    expect(checkPronunciation('Portugal', 'pur-tu-GAŁ').some((i) => i.code === 'polish-l')).toBe(true);
    expect(checkPronunciation('café', 'kă-FÉ').some((i) => i.code === 'ortho-char')).toBe(true);
    expect(checkPronunciation('sim', 'SIN').some((i) => i.code === 'nasal')).toBe(true);
    expect(checkPronunciation('filho', 'FI-lu').some((i) => i.code === 'lh')).toBe(true);
    expect(checkPronunciation('carro', 'KA-ru').some((i) => i.code === 'strong-r')).toBe(true);
  });
  it('różne zapisy dla avó / avô', () => {
    expect(checkPronunciation('avó', 'ă-WO')).toEqual([]);
    expect(checkPronunciation('avô', 'ă-WÔ')).toEqual([]);
  });
  it('sylaby i opis akcentu', () => {
    expect(phonSyllables('NÔJT(y)').map((s) => s.text)).toEqual(['NÔJT', '(y)']);
    expect(describeStress('o-bri-GA-du')).toBe('akcent: GA (przedostatnia sylaba)');
    expect(describeStress('pur-tu-GAɫ')).toBe('akcent: GAɫ (ostatnia sylaba)');
  });
});

describe('sandhi', () => {
  it('s przed samogłoską → z', () => {
    expect(checkPronunciation('Quantos anos tem?', 'KUÃ-tusz Ă-nusz TÃJ?').some((i) => i.code === 'sandhi-z')).toBe(true);
    expect(checkPronunciation('Quantos anos tem?', 'KUÃ-tuz Ă-nusz TÃJ?').some((i) => i.code === 'sandhi-z')).toBe(false);
    // pauza (przecinek) blokuje łączenie
    expect(checkPronunciation('Três, olá.', 'TRÊSZ, o-LA.').some((i) => i.code === 'sandhi-z')).toBe(false);
  });
});

describe('sandhi ż', () => {
  it('s przed dźwięczną spółgłoską → ż', () => {
    expect(checkPronunciation('Às dez?', 'asz DESZ?').some((i) => i.code === 'sandhi-zh')).toBe(true);
    expect(checkPronunciation('Mais devagar.', 'MAJŻ dy-wă-GAR.').some((i) => i.code === 'sandhi-zh')).toBe(false);
  });
});
