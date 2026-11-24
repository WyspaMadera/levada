/**
 * Automatyczna kontrola SPÓJNOŚCI zapisu „Fonetyka PL” z pisownią portugalską.
 * UWAGA: to NIE jest weryfikacja poprawności fonetycznej. Wykrywa typowe pomyłki
 * (brak akcentu, brak nosowości, zgubione dwuznaki, końcowe l zapisane jako ł itd.).
 */

export type PhonIssue = { level: 'error' | 'warning'; code: string; message: string };

const UPPER_EXTRA = 'ĂÃẼĨÕŨÊÔŃŻⱢ';
const LOWER_EXTRA = 'ăãẽĩõũêôńżɫ';
export const ALLOWED_LETTERS = new Set([...'abdefgijklmnoprstuwyz', ...LOWER_EXTRA, ...'ABDEFGIJKLMNOPRSTUWYZ', ...UPPER_EXTRA]);
const ALLOWED_OTHER = new Set([...' -()‿?!,.…;:']);
const NASAL_MARKS = /[ãẽĩõũÃẼĨÕŨ]/;
const FORBIDDEN_ORTHO = /[çáéíóúàÇÁÉÍÓÚÀ]/;

const CLITICS = new Set(['me', 'te', 'se', 'lhe', 'lhes', 'nos', 'vos', 'o', 'a', 'os', 'as', 'lo', 'la', 'los', 'las', 'no', 'na']);

/** Wyjątki: słowo PT → oczekiwana pozycja akcentu od końca w zapisie dydaktycznym. */
export const STRESS_EXCEPTIONS: Record<string, number> = {
  têm: 2, // [ˈtɐ̃j̃ɐ̃j̃] — dwie sylaby w wymowie, jedna samogłoska w pisowni
  vêm: 2,
  contêm: 2,
};

/** Symbole bez wielkości liter (zawsze małe), np. ciemne ɫ — nie wpływają na wykrywanie akcentu. */
const CASELESS = new Set(['ɫ', 'Ɫ']);
const casedLetters = (s: string) => [...s].filter((c) => ALLOWED_LETTERS.has(c) && !CASELESS.has(c));

function isUpperLetter(ch: string) {
  return ch !== ch.toLowerCase() && ch === ch.toUpperCase();
}
function isLowerLetter(ch: string) {
  return ch !== ch.toUpperCase() && ch === ch.toLowerCase();
}

export function normalize(s: string) {
  return s.normalize('NFC');
}

/** Rozbija zapis PL na wyrazy (ignorując interpunkcję). „‿” w wersji naturalnej łączy wyrazy — zostawiamy je razem. */
export function phonWords(pl: string): string[] {
  return normalize(pl)
    .replace(/[?!,.…;:]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

export type PhonSyllable = { text: string; stressed: boolean };

/** Sylaby wyrazu w zapisie PL. „(y)” liczy się jako osobna (zanikająca) sylaba. */
export function phonSyllables(word: string): PhonSyllable[] {
  const parts = word.split('-').filter(Boolean);
  const out: PhonSyllable[] = [];
  for (const p of parts) {
    const elided = p.endsWith('(y)') && p.length > 3;
    const core = elided ? p.slice(0, -3) : p;
    const letters = casedLetters(core);
    const stressed = letters.length > 0 && letters.every(isUpperLetter);
    out.push({ text: core, stressed });
    if (elided) out.push({ text: '(y)', stressed: false });
  }
  return out;
}

const STRONG = new Set([...'aeoáéíóúâêôãõà']);
const WEAK = new Set(['i', 'u', 'ü']);
const ACCENTED = new Set([...'áéíóúâêô']);
const TILDE = new Set([...'ãõ']);

type Nucleus = { start: number; accented: boolean; tilde: boolean };

/** Jądra sylab w pisowni PT (heurystyka: dyftongi opadające = 1 jądro; „ia, ua, io…” = rozziew). */
export function orthoNuclei(wordRaw: string): Nucleus[] {
  const w = normalize(wordRaw.toLowerCase());
  const chars = [...w];
  const nuclei: Nucleus[] = [];
  let i = 0;
  while (i < chars.length) {
    const c = chars[i]!;
    const prev = chars[i - 1];
    const next = chars[i + 1];
    const isVowel = STRONG.has(c) || WEAK.has(c) || c === 'í' || c === 'ú';
    if (!isVowel) {
      i++;
      continue;
    }
    // qu / gu + samogłoska → u nie jest jądrem
    if ((c === 'u' || c === 'ü') && (prev === 'q' || prev === 'g') && next && (STRONG.has(next) || next === 'i' || next === 'í')) {
      i++;
      continue;
    }
    const lastNucleus = nuclei[nuclei.length - 1];
    const prevIsVowelInSameCluster =
      lastNucleus !== undefined && prev !== undefined && (STRONG.has(prev) || WEAK.has(prev) || prev === 'í' || prev === 'ú');
    if (prevIsVowelInSameCluster) {
      const prevCh = prev!;
      // ã/õ + o/e → dyftong nosowy
      if (TILDE.has(prevCh) && (c === 'o' || c === 'e')) {
        i++;
        continue;
      }
      // samogłoska + nieakcentowane i/u → półsamogłoska (dyftong opadający),
      // chyba że po i/u stoi kolejna samogłoska (np. „saia”) — wtedy i tak traktujemy jako półsamogłoskę
      if (WEAK.has(c) && (STRONG.has(prevCh) || WEAK.has(prevCh))) {
        // wyjątek: i/u przed m/n/nh na końcu sylaby (np. „ainda”) — liczymy jako dyftong (uproszczenie)
        i++;
        continue;
      }
    }
    nuclei.push({ start: i, accented: ACCENTED.has(c) || c === 'í' || c === 'ú', tilde: TILDE.has(c) });
    i++;
  }
  return nuclei;
}

/** Przewidywana pozycja akcentu od końca (1 = ostatnia sylaba) dla pojedynczego wyrazu PT. */
export function predictStressFromEnd(wordRaw: string): number | null {
  const w = normalize(wordRaw.toLowerCase()).replace(/[^a-zçáéíóúâêôãõàü]/g, '');
  if (!w) return null;
  if (STRESS_EXCEPTIONS[w] !== undefined) return STRESS_EXCEPTIONS[w]!;
  const nuc = orthoNuclei(w);
  if (nuc.length === 0) return null;
  if (nuc.length === 1) return 1;
  const accIdx = nuc.findIndex((n) => n.accented);
  if (accIdx >= 0) return nuc.length - accIdx;
  const tilIdx = nuc.findIndex((n) => n.tilde);
  if (tilIdx >= 0) return nuc.length - tilIdx;
  if (/(a|e|o|as|es|os|am|em|ens)$/.test(w)) return 2;
  return 1;
}

/** Tokeny PT do porównania z zapisem: łączy klityki (chamo-me), rozdziela złożenia (segunda-feira). */
export function ptTokens(pt: string): string[] {
  const cleaned = normalize(pt)
    .replace(/_{2,}|\.{3}|…/g, ' ')
    .replace(/[?!,.;:«»"“”¿¡()]/g, ' ');
  const out: string[] = [];
  for (const raw of cleaned.split(/\s+/).filter(Boolean)) {
    const parts = raw.split('-').filter(Boolean);
    if (parts.length === 1) {
      out.push(raw);
      continue;
    }
    let current = parts[0]!;
    for (const p of parts.slice(1)) {
      if (CLITICS.has(p.toLowerCase())) current += '-' + p;
      else {
        out.push(current);
        current = p;
      }
    }
    out.push(current);
  }
  return out;
}

function stressFromEndForToken(token: string): number | null {
  const parts = token.split('-');
  const base = predictStressFromEnd(parts[0]!);
  if (base === null) return null;
  // każdy klityk = 1 sylaba (me, te, se, lhe, o, a, nos…)
  return base + (parts.length - 1);
}

function phonStressFromEnd(word: string): number | null {
  const syl = phonSyllables(word);
  const idx = syl.findIndex((s) => s.stressed);
  if (idx < 0) return null;
  return syl.length - idx;
}

/** Główna kontrola jednego zapisu (wersja dydaktyczna) względem tekstu PT. */
export function checkPronunciation(pt: string, plSlow: string | undefined, opts: { natural?: string } = {}): PhonIssue[] {
  const issues: PhonIssue[] = [];
  if (!plSlow) {
    issues.push({ level: 'error', code: 'missing', message: 'Brak zapisu wymowy (plSlow).' });
    return issues;
  }
  const slow = normalize(plSlow);
  for (const [label, text] of [
    ['plSlow', slow],
    ['plNatural', opts.natural ? normalize(opts.natural) : ''],
  ] as const) {
    if (!text) continue;
    for (const ch of text) {
      if (ALLOWED_LETTERS.has(ch) || ALLOWED_OTHER.has(ch)) continue;
      if (ch === 'ł' || ch === 'Ł') {
        issues.push({ level: 'error', code: 'polish-l', message: `${label}: „ł” jest niedozwolone — końcowe l to „ɫ” (ciemne l), półsamogłoska to „u”.` });
      } else if (FORBIDDEN_ORTHO.test(ch)) {
        issues.push({ level: 'error', code: 'ortho-char', message: `${label}: znak pisowni portugalskiej „${ch}” w zapisie wymowy.` });
      } else {
        issues.push({ level: 'warning', code: 'unknown-char', message: `${label}: nieznany znak „${ch}” (dozwolone: zob. PRONUNCIATION.md).` });
      }
    }
  }

  // sandhi: końcowe s/z przed samogłoską następnego wyrazu (bez pauzy) brzmi jak „z”
  const vowelStart = /^[aeiouyăãẽĩõũêôAEIOUYĂÃẼĨÕŨÊÔ]/;
  const rawWords = slow.split(/\s+/);
  for (let i = 0; i < rawWords.length - 1; i++) {
    const a = rawWords[i]!;
    const b = rawWords[i + 1]!;
    if (/sz$/i.test(a) && /^(b|d|g|l|m|n|w|ż|z|rr)/i.test(b)) {
      issues.push({ level: 'warning', code: 'sandhi-zh', message: `„${a} ${b}”: s przed dźwięczną spółgłoską (bez pauzy) brzmi jak ż — zapisz „${a.slice(0, -2)}${a.endsWith('SZ') ? 'Ż' : 'ż'} ${b}”.` });
    }
    if (/sz$/i.test(a) && vowelStart.test(b)) {
      issues.push({ level: 'warning', code: 'sandhi-z', message: `„${a} ${b}”: s przed samogłoską (bez pauzy) brzmi jak z — zapisz „${a.slice(0, -2)}${a.endsWith('SZ') ? 'Z' : 'z'} ${b}”.` });
    }
  }

  const tokens = ptTokens(pt);
  const words = phonWords(slow);
  if (tokens.length !== words.length) {
    issues.push({
      level: 'warning',
      code: 'word-count',
      message: `Liczba wyrazów w zapisie (${words.length}) różni się od PT (${tokens.length}).`,
    });
  }

  words.forEach((word) => {
    const syl = phonSyllables(word);
    const stressedCount = syl.filter((s) => s.stressed).length;
    if (syl.length > 1 && stressedCount !== 1) {
      issues.push({
        level: 'error',
        code: 'stress-marking',
        message: `„${word}”: wyraz wielosylabowy musi mieć dokładnie jedną sylabę WIELKIMI literami (jest ${stressedCount}).`,
      });
    }
    for (const s of syl) {
      const letters = casedLetters(s.text);
      if (letters.some(isUpperLetter) && letters.some(isLowerLetter)) {
        issues.push({ level: 'error', code: 'mixed-case', message: `„${word}”: sylaba „${s.text}” ma mieszane wielkości liter.` });
      }
    }
  });

  if (tokens.length === words.length) {
    tokens.forEach((tok, i) => {
      const word = words[i]!;
      const lower = normalize(tok.toLowerCase());
      const syl = phonSyllables(word);
      const expected = stressFromEndForToken(lower);
      const actual = phonStressFromEnd(word);
      if (syl.length > 1 && expected !== null && actual !== null && expected !== actual) {
        issues.push({
          level: 'warning',
          code: 'stress-position',
          message: `„${tok}” → „${word}”: akcent w zapisie na ${actual}. sylabie od końca, reguła pisowni wskazuje ${expected}. — sprawdź.`,
        });
      }
      const wl = word.toLowerCase();
      const nasalInPt = /[ãõ]/.test(lower) || /[aeiouáéíóúâêô][mn](?=[^aeiouáéíóúâêôãõh]|$)/.test(lower);
      if (nasalInPt && !NASAL_MARKS.test(word)) {
        issues.push({ level: 'warning', code: 'nasal', message: `„${tok}”: pisownia sugeruje samogłoskę nosową, a zapis „${word}” nie ma tyldy.` });
      }
      if (lower.includes('lh') && !wl.includes('lj')) {
        issues.push({ level: 'warning', code: 'lh', message: `„${tok}”: „lh” powinno być zapisane jako „lj”.` });
      }
      if (lower.includes('nh') && !wl.includes('ń')) {
        issues.push({ level: 'warning', code: 'nh', message: `„${tok}”: „nh” powinno być zapisane jako „ń”.` });
      }
      if (lower.includes('ch') && !wl.includes('sz')) {
        issues.push({ level: 'warning', code: 'ch', message: `„${tok}”: „ch” zwykle = „sz”.` });
      }
      if ((lower.includes('rr') || /^r/.test(lower)) && !wl.includes('rr')) {
        issues.push({ level: 'warning', code: 'strong-r', message: `„${tok}”: mocne r (rr / r- na początku) zapisujemy „rr”.` });
      }
      if (/l(?=[^aeiouáéíóúâêôãõh]|$)/.test(lower.replace(/-.*/, '')) && !wl.includes('ɫ')) {
        issues.push({ level: 'warning', code: 'dark-l', message: `„${tok}”: l na końcu sylaby to ciemne „ɫ”.` });
      }
      if (/j/.test(lower) && !wl.includes('ż')) {
        issues.push({ level: 'warning', code: 'j', message: `„${tok}”: „j” = „ż”.` });
      }
    });
  }
  return issues;
}

/** Sylaba akcentowana do wyświetlenia (np. „GA” w „o-bri-GA-du”). */
export function stressedSyllables(plSlow: string): string[] {
  return phonWords(plSlow)
    .map((w) => phonSyllables(w))
    .filter((syl) => syl.length > 1)
    .map((syl) => syl.find((s) => s.stressed)?.text)
    .filter((s): s is string => Boolean(s));
}

/** Opis akcentu po polsku, np. „akcent: GA (przedostatnia sylaba)”. */
export function describeStress(plSlow: string): string | null {
  const words = phonWords(plSlow);
  if (words.length !== 1) {
    const st = stressedSyllables(plSlow);
    return st.length ? `akcentowane sylaby: ${st.join(', ')}` : null;
  }
  const syl = phonSyllables(words[0]!);
  if (syl.length <= 1) return 'jedna sylaba';
  const idx = syl.findIndex((s) => s.stressed);
  if (idx < 0) return null;
  const fromEnd = syl.length - idx;
  const pos = fromEnd === 1 ? 'ostatnia sylaba' : fromEnd === 2 ? 'przedostatnia sylaba' : `${fromEnd}. sylaba od końca`;
  return `akcent: ${syl[idx]!.text} (${pos})`;
}
