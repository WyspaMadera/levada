import { describe, expect, it } from 'vitest';
import { findBrazilianSuspects } from '@/content/brazil';

describe('podejrzane formy pt-BR', () => {
  it('wykrywa słownictwo i progresyw BR', () => {
    expect(findBrazilianSuspects('Vou de ônibus.').map((f) => f.pattern)).toContain('ônibus');
    expect(findBrazilianSuspects('Estou fazendo o jantar.').map((f) => f.pattern)).toContain('estar+gerúndio');
    expect(findBrazilianSuspects('Me chamo Ana.').map((f) => f.pattern)).toContain('proclisis-start');
    expect(findBrazilianSuspects('Sou da Polônia.').map((f) => f.pattern)).toContain('circumflex-BR');
  });
  it('nie zgłasza poprawnych form PT-PT', () => {
    expect(findBrazilianSuspects('Chamo-me Ana. Estou a fazer o jantar. A ação. O facto. Sou da Polónia.')).toEqual([]);
  });
  it('„fato” tylko jako informacja (w PT-PT = garnitur)', () => {
    expect(findBrazilianSuspects('O fato é azul.')[0]?.severity).toBe('info');
  });
});
