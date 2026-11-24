import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Mic, ShieldCheck, Volume2 } from 'lucide-react';
import { useApp } from '@/state/AppContext';
import { saveProfile, getProfile } from '@/db/repo';
import { Button, Card, Notice, cx } from '@/components/ui';
import { AudioButton } from '@/components/Audio';
import { maybeItem } from '@/lib/items';
import { VOICE_HELP_PL } from '@/lib/voices';
import { LevadaLogo } from '@/components/MadeiraMap';

export default function Onboarding() {
  const { update, audio, settings } = useApp();
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [gender, setGender] = useState<'m' | 'f'>(settings.gender);
  const [name, setName] = useState('');
  const [minutes, setMinutes] = useState<5 | 15 | 30>(settings.dailyMinutes);
  const sample = maybeItem('ola-bom-dia');
  const [target, setTarget] = useState<string | null>(null);

  // Przejście dopiero, gdy kontekst „widzi” zapisane ustawienia — inaczej strażnik trasy cofnąłby do /start.
  useEffect(() => {
    if (target && settings.onboardingDone) nav(target, { replace: true });
  }, [target, settings.onboardingDone, nav]);

  const finish = async (goToLesson: boolean) => {
    if (name.trim()) await saveProfile({ ...(await getProfile()), name: name.trim() });
    await update({ gender, dailyMinutes: minutes, onboardingDone: true });
    setTarget(goToLesson ? '/lekcja/w01-l01' : '/');
  };

  const steps = [
    <div key="0" className="space-y-4">
      <LevadaLogo className="mx-auto h-24 w-24" />
      <h1 className="text-center text-3xl font-bold">Levada</h1>
      <p className="text-center text-lg text-[var(--muted)]">Krok po kroku do portugalskiego</p>
      <Card className="space-y-2">
        <p>Uczysz się <strong>portugalskiego europejskiego</strong> (z Portugalii — nie brazylijskiego) od absolutnego zera.</p>
        <p>Każde słowo ma tłumaczenie, <strong>zapis wymowy dla Polaka</strong> i odsłuch. Najważniejsze są mówienie i rozumienie ze słuchu.</p>
        <p className="flex items-start gap-2 text-sm text-[var(--muted)]">
          <ShieldCheck className="mt-0.5 size-4 shrink-0" /> Bez konta. Postępy zapisują się tylko na tym urządzeniu (możesz je wyeksportować).
        </p>
      </Card>
      <Button size="lg" className="w-full" onClick={() => setStep(1)}>
        Zaczynamy
      </Button>
    </div>,
    <div key="1" className="space-y-4">
      <h2 className="text-2xl font-bold">Jak mówisz o sobie?</h2>
      <p className="text-[var(--muted)]">
        W portugalskim niektóre zwroty zależą od tego, kto mówi: mężczyzna mówi <em>obrigado</em>, kobieta — <em>obrigada</em>. Pokażemy Ci właściwą formę.
      </p>
      <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Forma wypowiedzi">
        {(
          [
            ['m', 'Formy męskie', 'obrigado, cansado'],
            ['f', 'Formy żeńskie', 'obrigada, cansada'],
          ] as const
        ).map(([v, t, ex]) => (
          <button
            key={v}
            role="radio"
            aria-checked={gender === v}
            onClick={() => setGender(v)}
            className={cx('focus-ring rounded-2xl border-2 p-4 text-left', gender === v ? 'border-atlantic-600 bg-atlantic-100/60 dark:bg-atlantic-700/30' : 'border-[var(--border)] bg-[var(--surface)]')}
          >
            <span className="block font-semibold">{t}</span>
            <span className="text-sm text-[var(--muted)]" lang="pt-PT">{ex}</span>
          </button>
        ))}
      </div>
      <label className="block">
        <span className="text-sm font-medium">Twoje imię (opcjonalnie — do ćwiczeń „przedstaw się”)</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="focus-ring mt-1 w-full rounded-xl border-2 border-[var(--border)] bg-[var(--surface)] px-4 py-3"
          autoComplete="given-name"
        />
        <span className="mt-1 block text-xs text-[var(--muted)]">Zapisane tylko lokalnie. Wymowy imienia nie „zgadujemy” — mówisz je po swojemu.</span>
      </label>
      <Button size="lg" className="w-full" onClick={() => setStep(2)}>
        Dalej
      </Button>
    </div>,
    <div key="2" className="space-y-4">
      <h2 className="text-2xl font-bold">Ile masz zwykle czasu?</h2>
      <p className="text-[var(--muted)]">Możesz to zmienić każdego dnia na ekranie „Dzisiaj”. Przerwy nie są karane.</p>
      <div className="grid gap-3" role="radiogroup" aria-label="Czas nauki dziennie">
        {(
          [
            [5, 'Minimum — 5 minut', 'krótka powtórka, wymowa, dwa pytania ustne'],
            [15, 'Standard — 15 minut', 'powtórki, nowa lekcja z mówieniem'],
            [30, 'Pełna nauka — 30 minut', 'powtórki, lekcja, słuchanie, rozmowa'],
          ] as const
        ).map(([v, t, d]) => (
          <button
            key={v}
            role="radio"
            aria-checked={minutes === v}
            onClick={() => setMinutes(v)}
            className={cx('focus-ring rounded-2xl border-2 p-4 text-left', minutes === v ? 'border-atlantic-600 bg-atlantic-100/60 dark:bg-atlantic-700/30' : 'border-[var(--border)] bg-[var(--surface)]')}
          >
            <span className="block font-semibold">{t}</span>
            <span className="text-sm text-[var(--muted)]">{d}</span>
          </button>
        ))}
      </div>
      <Button size="lg" className="w-full" onClick={() => setStep(3)}>
        Dalej
      </Button>
    </div>,
    <div key="3" className="space-y-4">
      <h2 className="text-2xl font-bold">Dźwięk i mikrofon</h2>
      <Card className="space-y-3">
        <p className="flex items-center gap-2 font-semibold">
          <Volume2 className="size-5" /> Głos portugalski (Portugalia)
        </p>
        {audio === null ? (
          <p className="text-sm">Sprawdzam dostępne głosy…</p>
        ) : audio.choice.status === 'pt-PT' ? (
          <div className="flex items-center gap-3">
            {sample && <AudioButton item={sample} />}
            <p className="text-sm">
              Znaleziono głos <strong>{audio.choice.voice.name}</strong> (pt-PT). Dotknij, aby posłuchać.
            </p>
          </div>
        ) : (
          <Notice tone="warn" title="Brak europejskiego głosu portugalskiego">
            <p>Nauka działa, ale bez odsłuchu będzie trudniej. Nie używamy po cichu głosu brazylijskiego — brzmi inaczej.</p>
            <details className="mt-2">
              <summary className="cursor-pointer font-medium">Jak dodać głos pt-PT?</summary>
              <ul className="mt-2 space-y-2">
                {VOICE_HELP_PL.map((h) => (
                  <li key={h.platform}>
                    <strong>{h.platform}:</strong> {h.steps}
                  </li>
                ))}
              </ul>
            </details>
          </Notice>
        )}
        <p className="text-xs text-[var(--muted)]">Głos syntetyczny (TTS) to pomoc, nie wzorzec — bywa niedokładny. Nagrania lektora będą dodawane stopniowo.</p>
      </Card>
      <Card className="space-y-2">
        <p className="flex items-center gap-2 font-semibold">
          <Mic className="size-5" /> Mikrofon
        </p>
        <p className="text-sm">Mikrofon włącza się tylko, gdy sam(a) klikniesz „Nagraj siebie”. Nagrania zostają na tym urządzeniu i nigdzie nie są wysyłane. Możesz je usunąć w każdej chwili.</p>
      </Card>
      <Button size="lg" className="w-full" onClick={() => finish(true)}>
        Rozpocznij pierwszą lekcję
      </Button>
      <Button variant="ghost" className="w-full" onClick={() => finish(false)}>
        Przejdź do ekranu głównego
      </Button>
    </div>,
  ];

  return (
    <div className="mx-auto min-h-dvh max-w-xl px-4 py-8">
      <div className="mb-6 flex justify-center gap-1.5" aria-label={`Krok ${step + 1} z ${steps.length}`}>
        {steps.map((_, i) => (
          <span key={i} className={cx('h-1.5 w-8 rounded-full', i <= step ? 'bg-atlantic-600' : 'bg-[var(--border)]')} />
        ))}
      </div>
      {steps[step]}
    </div>
  );
}
