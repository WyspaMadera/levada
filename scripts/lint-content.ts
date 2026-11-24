/**
 * npm run lint:content            — walidacja treści + raport reports/content-report.md
 * npm run content:status          — jw. + aktualizacja statusów draft ↔ automatedChecked w plikach items/*.json
 *
 * Linter NIE ocenia w pełni poprawności gramatyki ani fonetyki — wykrywa niespójności i podejrzane formy.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { lintContent, type Finding } from './content-lint-core';

const ROOT = process.cwd();
const CONTENT = join(ROOT, 'content');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.json') ? [p] : [];
  });
}

const raw: Record<string, unknown> = {};
for (const file of walk(CONTENT)) {
  const rel = relative(ROOT, file).replace(/\\/g, '/');
  try {
    raw[rel] = JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    console.error(`✖ Niepoprawny JSON: ${rel}: ${(e as Error).message}`);
    process.exit(1);
  }
}

const result = lintContent(raw, { fileExists: (p) => existsSync(join(ROOT, 'public', p)) });
const { findings, stats, autoPass, index } = result;

if (process.argv.includes('--update-status')) {
  let promoted = 0;
  let demoted = 0;
  for (const [rel, data] of Object.entries(raw)) {
    if (!rel.startsWith('content/items/') || !Array.isArray(data)) continue;
    let changed = false;
    for (const item of data as { id: string; reviewStatus: string }[]) {
      const pass = autoPass.get(item.id);
      if (item.reviewStatus === 'draft' && pass) {
        item.reviewStatus = 'automatedChecked';
        promoted++;
        changed = true;
      } else if (item.reviewStatus === 'automatedChecked' && pass === false) {
        item.reviewStatus = 'draft';
        demoted++;
        changed = true;
      }
    }
    if (changed) writeFileSync(join(ROOT, rel), JSON.stringify(data, null, 2) + '\n');
  }
  console.log(`Statusy: ${promoted} → automatedChecked, ${demoted} → draft (humanVerified nigdy nie jest nadawany automatycznie).`);
  // przelicz statystyki po zmianie
  stats.byStatus = {};
  for (const [rel, data] of Object.entries(raw))
    if (rel.startsWith('content/items/') && Array.isArray(data))
      for (const it of data as { reviewStatus: string }[]) stats.byStatus[it.reviewStatus] = (stats.byStatus[it.reviewStatus] ?? 0) + 1;
}

const crit = findings.filter((f) => f.severity === 'critical');
const warn = findings.filter((f) => f.severity === 'warning');
const info = findings.filter((f) => f.severity === 'info');

const section = (title: string, list: Finding[]) =>
  `## ${title} (${list.length})\n\n` +
  (list.length ? list.map((f) => `- **[${f.category}]** \`${f.where}\` — ${f.message.replace(/\n/g, ' ')}`).join('\n') : '_brak_') +
  '\n';

const unverified = [...index.items.values()].filter((i) => i.pronunciation.needsReview);
const missingAudio = [...index.items.values()].filter((i) => !i.audio?.normal && !index.audio.files[i.id]);

const report = `# Raport treści LEVADY

Wygenerowano: ${new Date().toISOString()}

> Automatyczna walidacja sprawdza strukturę, odwołania i SPÓJNOŚĆ zapisu wymowy z pisownią.
> **Nie potwierdza poprawności fonetycznej ani gramatycznej.** Zielony wynik ≠ weryfikacja przez native speakera.

## Podsumowanie
- Elementy językowe: ${stats.items}
- Lekcje: ${stats.lessons}
- Statusy: ${Object.entries(stats.byStatus).map(([k, v]) => `${k}: ${v}`).join(', ')}
- Wymowa do weryfikacji przez człowieka (needsReview): ${stats.needsReview}
- Elementy bez nagrania (korzystają z TTS urządzenia, jeśli dostępny głos pt-PT): ${missingAudio.length}
- Błędy krytyczne: ${crit.length} · Ostrzeżenia: ${warn.length} · Informacje: ${info.length}

${section('Błędy krytyczne', crit)}
${section('Ostrzeżenia — wymowa', warn.filter((f) => f.category === 'pronunciation'))}
${section('Ostrzeżenia — podejrzane konstrukcje (pt-BR)', [...warn, ...info].filter((f) => f.category === 'brazil'))}
${section('Ostrzeżenia — pozostałe', warn.filter((f) => f.category !== 'pronunciation' && f.category !== 'brazil'))}
${section('Informacje — progresja słownictwa', info.filter((f) => f.category === 'progression'))}
## Niezweryfikowane wymowy (${unverified.length})

| ID | PT | Fonetyka PL | Status |
|---|---|---|---|
${unverified.map((i) => `| ${i.id} | ${i.pt}${i.ptFem ? ` / ${i.ptFem}` : ''} | ${i.pronunciation.plSlow ?? '—'}${i.pronunciationFem?.plSlow ? ` / ${i.pronunciationFem.plSlow}` : ''} | ${i.reviewStatus} |`).join('\n')}
`;

mkdirSync(join(ROOT, 'reports'), { recursive: true });
writeFileSync(join(ROOT, 'reports', 'content-report.md'), report);

const print = (f: Finding) => `  [${f.category}] ${f.where}: ${f.message.split('\n')[0]}`;
if (crit.length) {
  console.error(`✖ Błędy krytyczne (${crit.length}):`);
  crit.slice(0, 60).forEach((f) => console.error(print(f)));
}
if (warn.length) {
  console.warn(`⚠ Ostrzeżenia (${warn.length}):`);
  warn.slice(0, 40).forEach((f) => console.warn(print(f)));
  if (warn.length > 40) console.warn(`  … i ${warn.length - 40} więcej (zob. raport)`);
}
console.log(
  `\nElementy: ${stats.items}, lekcje: ${stats.lessons}, statusy: ${JSON.stringify(stats.byStatus)}, do weryfikacji: ${stats.needsReview}`,
);
console.log(`Raport: reports/content-report.md — krytyczne: ${crit.length}, ostrzeżenia: ${warn.length}, info: ${info.length}`);
process.exit(crit.length ? 1 : 0);
