import { describe, expect, it } from 'vitest';
import { judgeAnswer, normalizeAnswer } from '@/lib/answers';

describe('ocena wpisanej odpowiedzi', () => {
  it('ignoruje wielkość liter i interpunkcję', () => {
    expect(normalizeAnswer('  Não percebo! ')).toBe('não percebo');
    expect(judgeAnswer('não percebo', ['Não percebo.'])).toBe('correct');
  });
  it('rozróżnia błąd akcentu, literówkę i błąd', () => {
    expect(judgeAnswer('nao percebo', ['Não percebo.'])).toBe('accents');
    expect(judgeAnswer('não percbo', ['Não percebo.'])).toBe('typo');
    expect(judgeAnswer('sim', ['Não percebo.'])).toBe('wrong');
    expect(judgeAnswer('', ['olá'])).toBe('wrong');
  });
});
