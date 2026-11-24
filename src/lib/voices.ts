/** Wybór głosu TTS. Zasada: nigdy po cichu pt-BR. Czysta logika — testowana. */

export type VoiceLike = { name: string; lang: string; voiceURI: string; localService: boolean; default?: boolean };

export type VoiceVariant = 'pt-PT' | 'pt-BR' | 'pt-unknown' | 'other';

/** Nazwy głosów pt-PT spotykane w systemach (gdy `lang` = samo „pt”). Lista pomocnicza, niepełna. */
const PT_PT_NAME_HINTS = /portugal|portugu[eê]s \(portugal\)|joana|catarina|raquel|duarte|ines|inês|fernanda|cristiano|helia|hélia/i;
const PT_BR_NAME_HINTS = /brasil|brazil|luciana|felipe|francisca|antonio|antônio|thalita|daniel \(br|maria \(br/i;

export function classifyVoice(v: VoiceLike): VoiceVariant {
  const lang = v.lang.replace('_', '-').toLowerCase();
  if (lang === 'pt-pt' || lang.startsWith('pt-pt-')) return 'pt-PT';
  if (lang === 'pt-br' || lang.startsWith('pt-br-')) return 'pt-BR';
  if (lang === 'pt' || lang.startsWith('pt-')) {
    if (PT_PT_NAME_HINTS.test(v.name)) return 'pt-PT';
    if (PT_BR_NAME_HINTS.test(v.name)) return 'pt-BR';
    return 'pt-unknown';
  }
  return 'other';
}

export type VoiceChoice =
  | { status: 'pt-PT'; voice: VoiceLike }
  | { status: 'pt-BR-fallback'; voice: VoiceLike }
  | { status: 'none'; voice: null; brAvailable: boolean };

/** Kolejność: wybrany przez użytkownika pt-PT → lokalny pt-PT → dowolny pt-PT → (tylko za zgodą) pt-BR → brak. */
export function pickVoice(voices: VoiceLike[], preferredURI: string | null, allowBrFallback: boolean): VoiceChoice {
  const pt = voices.filter((v) => classifyVoice(v) === 'pt-PT');
  const preferred = preferredURI ? pt.find((v) => v.voiceURI === preferredURI) : undefined;
  if (preferred) return { status: 'pt-PT', voice: preferred };
  const best = pt.find((v) => v.localService) ?? pt[0];
  if (best) return { status: 'pt-PT', voice: best };
  const br = voices.filter((v) => classifyVoice(v) === 'pt-BR');
  if (allowBrFallback && br[0]) return { status: 'pt-BR-fallback', voice: br[0] };
  return { status: 'none', voice: null, brAvailable: br.length > 0 };
}

export function polishVoice(voices: VoiceLike[]): VoiceLike | null {
  return voices.find((v) => v.lang.replace('_', '-').toLowerCase().startsWith('pl')) ?? null;
}

export const VOICE_HELP_PL: { platform: string; steps: string }[] = [
  {
    platform: 'Android (Chrome)',
    steps:
      'Ustawienia → System → Języki → Zamiana tekstu na mowę (nazwa może się różnić) → silnik Google → Zainstaluj dane głosowe → Portugalski (Portugalia). Potem uruchom aplikację ponownie.',
  },
  {
    platform: 'iPhone / iPad (Safari)',
    steps:
      'Ustawienia → Dostępność → Treść mówiona → Głosy → Portugalski → wybierz głos „Portugalia” (np. Joana) i pobierz go. Potem odśwież aplikację.',
  },
  {
    platform: 'Windows (Edge / Chrome)',
    steps:
      'Ustawienia → Czas i język → Mowa → Dodaj głosy → Portugalski (Portugalia). W przeglądarce Edge dostępne bywają też głosy online pt-PT.',
  },
  { platform: 'macOS', steps: 'Ustawienia systemowe → Dostępność → Treść mówiona → Głos systemowy → Zarządzaj głosami → Portugalski (Portugalia).' },
];
