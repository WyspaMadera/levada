/**
 * Wykrywanie PODEJRZANYCH form brazylijskich (pt-BR) w tekstach pt-PT.
 * To nie jest lista zakazów: każde trafienie trafia do weryfikacji człowieka.
 * Część słów jest poprawna w PT-PT w innym znaczeniu (np. „fato” = garnitur).
 */

export type BrazilFinding = { pattern: string; match: string; suggestionPl: string; severity: 'suspect' | 'info' };

type Rule = { name: string; re: RegExp; suggestionPl: string; severity: 'suspect' | 'info' };

const w = (word: string) => new RegExp(`(^|[^\\p{L}])(${word})(?=$|[^\\p{L}])`, 'giu');

const RULES: Rule[] = [
  { name: 'ônibus', re: w('ônibus'), suggestionPl: 'PT-PT: „autocarro”.', severity: 'suspect' },
  { name: 'celular', re: w('celular'), suggestionPl: 'PT-PT: „telemóvel” (celular = komórkowy w biologii).', severity: 'suspect' },
  { name: 'trem', re: w('trem'), suggestionPl: 'PT-PT: „comboio”.', severity: 'suspect' },
  { name: 'café da manhã', re: /café da manhã/giu, suggestionPl: 'PT-PT: „pequeno-almoço”.', severity: 'suspect' },
  { name: 'banheiro', re: w('banheiro'), suggestionPl: 'PT-PT: „casa de banho”.', severity: 'suspect' },
  { name: 'geladeira', re: w('geladeira'), suggestionPl: 'PT-PT: „frigorífico”.', severity: 'suspect' },
  { name: 'suco', re: w('sucos?'), suggestionPl: 'PT-PT: „sumo”.', severity: 'suspect' },
  { name: 'sorvete', re: w('sorvetes?'), suggestionPl: 'PT-PT: „gelado”.', severity: 'suspect' },
  { name: 'tela', re: w('tela'), suggestionPl: 'Ekran w PT-PT: „ecrã” (tela = płótno).', severity: 'info' },
  { name: 'time', re: w('time'), suggestionPl: 'Drużyna w PT-PT: „equipa”.', severity: 'info' },
  { name: 'equipe', re: w('equipe'), suggestionPl: 'PT-PT: „equipa”.', severity: 'suspect' },
  { name: 'moça', re: w('moça'), suggestionPl: 'W PT-PT częściej „rapariga”.', severity: 'info' },
  { name: 'cadê', re: w('cadê'), suggestionPl: 'Kolokwializm BR. PT-PT: „onde está”.', severity: 'suspect' },
  { name: 'registro', re: w('registros?'), suggestionPl: 'PT-PT: „registo”.', severity: 'suspect' },
  { name: 'contato', re: w('contatos?'), suggestionPl: 'PT-PT: „contacto”.', severity: 'suspect' },
  { name: 'recepção', re: w('recepção'), suggestionPl: 'PT-PT (AO1990): „receção”.', severity: 'suspect' },
  { name: 'fato', re: w('fato'), suggestionPl: 'W PT-PT „fato” = garnitur; „fakt” = „facto”. Sprawdź znaczenie.', severity: 'info' },
  {
    name: 'circumflex-BR',
    re: /[\p{L}]*(ônia|ômic|ômet|ênio|ênia|ômo|ônic|êmic)[\p{L}]*/giu,
    suggestionPl: 'Pisownia BR z daszkiem; PT-PT zwykle z akcentem ostrym (Polónia, económico, género, cómodo).',
    severity: 'suspect',
  },
  {
    name: 'estar+gerúndio',
    re: /\b(estou|estás|está|estamos|estão|estava|estavas|estávamos|estavam)\s+([\p{L}]+(ando|endo|indo))\b/giu,
    suggestionPl: 'Możliwy progresyw BR. PT-PT: „estar a + bezokolicznik” (estou a fazer). Gerúndio bywa poprawne w innych funkcjach — sprawdź.',
    severity: 'suspect',
  },
  {
    name: 'proclisis-start',
    re: /(^|[.!?]\s+)(Me|Te|Se|Lhe|Nos)\s+[\p{L}]+/gu,
    suggestionPl: 'Zaimek na początku zdania (typowe dla BR). PT-PT: „Chamo-me…”, „Sente-se…”.',
    severity: 'suspect',
  },
  { name: 'a gente', re: /\ba gente\b/giu, suggestionPl: '„a gente” = „my” (potoczne, też w PT) — w materiałach A0/A1 preferuj „nós”.', severity: 'info' },
  { name: 'você', re: w('você'), suggestionPl: '„você” w PT-PT bywa zbyt bezpośrednie — sprawdź rejestr (o senhor / a senhora / tu).', severity: 'info' },
];

export function findBrazilianSuspects(text: string): BrazilFinding[] {
  const out: BrazilFinding[] = [];
  for (const rule of RULES) {
    rule.re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = rule.re.exec(text)) !== null) {
      const match = (m[2] ?? m[0]).trim();
      out.push({ pattern: rule.name, match, suggestionPl: rule.suggestionPl, severity: rule.severity });
      if (m[0].length === 0) rule.re.lastIndex++;
    }
  }
  return out;
}
