/** Ładowanie treści w aplikacji (Vite): wszystkie pliki JSON z content/ trafiają do bundla (działają offline). */
import { buildIndex, type ContentIndex, type LoadProblem } from './index';

const modules = import.meta.glob('../../content/**/*.json', { eager: true, import: 'default' });

const raw: Record<string, unknown> = {};
for (const [path, data] of Object.entries(modules)) {
  raw[path.replace(/^(\.\.\/)+/, '')] = data;
}

const built = buildIndex(raw);

export const content: ContentIndex = built.index;
export const contentProblems: LoadProblem[] = built.problems;

if (contentProblems.length && import.meta.env.DEV) {
  console.error('[Levada] Problemy z treścią:', contentProblems);
}
