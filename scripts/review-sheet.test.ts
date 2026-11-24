import { describe, expect, it } from 'vitest';

describe('arkusz recenzji — parser CSV', async () => {
  // import dynamiczny: moduł przy imporcie sprawdza argumenty CLI, więc ustawiamy tryb „test”
  process.argv = ['node', 'x', 'test'];
  const errors: string[] = [];
  const orig = console.error;
  console.error = (m: string) => errors.push(m);
  const exit = process.exit;
  (process as unknown as { exit: () => void }).exit = () => {};
  const { parseCsv } = await import('./review-sheet');
  console.error = orig;
  (process as unknown as { exit: typeof exit }).exit = exit;
  it('obsługuje BOM, średniki, cudzysłowy i nowe linie w polach', () => {
    const rows = parseCsv('﻿id;PT;uwagi\r\nsim;sim;"ok; ""dobrze""\ndruga linia"\r\nnao;não;\r\n');
    expect(rows).toEqual([
      ['id', 'PT', 'uwagi'],
      ['sim', 'sim', 'ok; "dobrze"\ndruga linia'],
      ['nao', 'não', ''],
    ]);
  });
});
