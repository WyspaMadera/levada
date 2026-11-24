/**
 * Arkusz do weryfikacji treści przez native speakera / recenzenta.
 *
 *   npm run review:export [-- --only w01,w02] [--all]
 *       → reports/review-sheet.csv (UTF-8 z BOM, separator „;” — otwiera się w Excelu i Arkuszach Google)
 *         Domyślnie tylko pozycje niezweryfikowane.
 *
 *   npm run review:apply -- --file reports/review-sheet.csv --reviewer "Imię Nazwisko"
 *       Kolumna „decyzja”: OK → humanVerified (z verifiedBy/verifiedAt, needsReview=false)
 *                          POPRAW → zastosuj „poprawiony PT” / „poprawiona wymowa” / „poprawione PL”, status draft (do ponownej kontroli)
 *                          puste / ? → bez zmian (uwagi trafiają do raportu)
 *       Po zastosowaniu uruchom `npm run lint:content`.
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

type Pron = { plSlow?: string; plNatural?: string; ipa?: string; notePl?: string; needsReview: boolean };
type Item = {
  id: string;
  pt: string;
  ptFem?: string;
  pl: string;
  pronunciation: Pron;
  pronunciationFem?: Pron;
  tags: string[];
  reviewStatus: string;
  verifiedBy?: string;
  verifiedAt?: string;
};

const ROOT = process.cwd();
const DIR = join(ROOT, 'content', 'items');
const args = process.argv.slice(2);
const opt = (n: string) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const mode = args[0];

const HEAD = ['id', 'plik', 'PT', 'PL', 'Fonetyka PL (wolno)', 'Fonetyka PL (naturalnie)', 'IPA', 'PT (forma żeńska)', 'Fonetyka PL (forma żeńska)', 'uwaga autora', 'decyzja (OK / POPRAW / ?)', 'poprawiony PT', 'poprawione PL', 'poprawiona wymowa', 'uwagi recenzenta'];

const esc = (v: string | undefined) => {
  const s = v ?? '';
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Prosty parser CSV (separator ;, cudzysłowy, nowe linie w polach). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let q = false;
  const t = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < t.length; i++) {
    const c = t[i]!;
    if (q) {
      if (c === '"' && t[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ';' || c === ',') {
      // akceptujemy też przecinek, jeśli arkusz zapisano z innym separatorem
      if (c === ',' && t.slice(0, t.indexOf('\n')).includes(';')) cur += c;
      else {
        row.push(cur);
        cur = '';
      }
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++;
      row.push(cur);
      rows.push(row);
      row = [];
      cur = '';
    } else cur += c;
  }
  if (cur || row.length) {
    row.push(cur);
    rows.push(row);
  }
  return rows.filter((r) => r.some((x) => x.trim()));
}

function load(): { file: string; items: Item[] }[] {
  return readdirSync(DIR)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => ({ file: f, items: JSON.parse(readFileSync(join(DIR, f), 'utf8')) as Item[] }));
}

if (mode === 'export') {
  const only = opt('only')?.split(',');
  const all = args.includes('--all');
  const lines = [HEAD.map(esc).join(';')];
  let n = 0;
  for (const { file, items } of load()) {
    if (only && !only.some((o) => file.startsWith(o))) continue;
    for (const it of items) {
      if (!all && it.reviewStatus === 'humanVerified') continue;
      n++;
      lines.push(
        [it.id, file, it.pt, it.pl, it.pronunciation.plSlow, it.pronunciation.plNatural, it.pronunciation.ipa, it.ptFem, it.pronunciationFem?.plSlow, it.pronunciation.notePl, '', '', '', '', '']
          .map(esc)
          .join(';'),
      );
    }
  }
  mkdirSync(join(ROOT, 'reports'), { recursive: true });
  writeFileSync(join(ROOT, 'reports', 'review-sheet.csv'), '\uFEFF' + lines.join('\r\n') + '\r\n');
  console.log(`Zapisano reports/review-sheet.csv — ${n} pozycji do przeglądu.`);
} else if (mode === 'apply') {
  const file = opt('file');
  const reviewer = opt('reviewer');
  if (!file || !reviewer) {
    console.error('Użycie: npm run review:apply -- --file reports/review-sheet.csv --reviewer "Imię Nazwisko"');
    process.exit(2);
  }
  const rows = parseCsv(readFileSync(join(ROOT, file), 'utf8'));
  const head = rows[0]!.map((h) => h.trim());
  const col = (name: string) => head.findIndex((h) => h.startsWith(name));
  const [cId, cDec, cPt, cPl, cPron, cNote] = ['id', 'decyzja', 'poprawiony PT', 'poprawione PL', 'poprawiona wymowa', 'uwagi recenzenta'].map(col);
  const decisions = new Map(rows.slice(1).map((r) => [r[cId!]!.trim(), r]));
  const today = new Date().toISOString().slice(0, 10);
  let ok = 0;
  let fixed = 0;
  const notes: string[] = [];
  for (const { file: f, items } of load()) {
    let changed = false;
    for (const it of items) {
      const r = decisions.get(it.id);
      if (!r) continue;
      const dec = (r[cDec!] ?? '').trim().toUpperCase();
      const note = (r[cNote!] ?? '').trim();
      if (note) notes.push(`- ${it.id} (${it.pt}): ${note}`);
      if (dec === 'OK') {
        it.reviewStatus = 'humanVerified';
        it.verifiedBy = reviewer;
        it.verifiedAt = today;
        it.pronunciation.needsReview = false;
        if (it.pronunciationFem) it.pronunciationFem.needsReview = false;
        ok++;
        changed = true;
      } else if (dec === 'POPRAW') {
        const pt = (r[cPt!] ?? '').trim();
        const pl = (r[cPl!] ?? '').trim();
        const pron = (r[cPron!] ?? '').trim();
        if (pt) it.pt = pt;
        if (pl) it.pl = pl;
        if (pron) it.pronunciation.plSlow = pron;
        it.reviewStatus = 'draft';
        it.pronunciation.needsReview = true;
        it.pronunciation.notePl = [it.pronunciation.notePl, `Poprawka recenzenta (${reviewer}, ${today})${note ? `: ${note}` : ''}`].filter(Boolean).join(' ');
        fixed++;
        changed = true;
      }
    }
    if (changed) writeFileSync(join(DIR, f), JSON.stringify(items, null, 2) + '\n');
  }
  mkdirSync(join(ROOT, 'reports'), { recursive: true });
  writeFileSync(join(ROOT, 'reports', 'review-notes.md'), `# Uwagi recenzenta: ${reviewer} (${today})\n\nZatwierdzone: ${ok} · Poprawione: ${fixed}\n\n${notes.join('\n')}\n`);
  console.log(`Zatwierdzone (humanVerified): ${ok}, poprawione (do ponownej kontroli): ${fixed}. Uwagi: reports/review-notes.md. Uruchom teraz: npm run lint:content`);
} else {
  console.error('Użycie: review:export | review:apply (zob. komentarz w scripts/review-sheet.ts)');
  process.exit(2);
}
