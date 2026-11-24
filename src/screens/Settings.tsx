import { useEffect, useRef, useState } from 'react';
import { Download, RefreshCw, Trash2, Upload } from 'lucide-react';
import { useApp } from '@/state/AppContext';
import { classifyVoice, VOICE_HELP_PL } from '@/lib/voices';
import { checkHealth } from '@/lib/aiTutor';
import { exportData, importData, backupFileName } from '@/db/backup';
import { deleteAllRecordings, resetAllData } from '@/db/repo';
import { maybeItem } from '@/lib/items';
import { content } from '@/content/content';
import { AudioButton } from '@/components/Audio';
import { Button, Card, Notice, PageHeader, cx } from '@/components/ui';
import type { DailyMinutes, PlaybackRate } from '@/db/db';

function Seg<T extends string | number>({ value, options, onChange, label }: { value: T; options: { v: T; l: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={String(o.v)}
          role="radio"
          aria-checked={value === o.v}
          onClick={() => onChange(o.v)}
          className={cx('focus-ring rounded-full border px-3 py-1.5 text-sm', value === o.v ? 'border-atlantic-600 bg-atlantic-600 text-white' : 'border-[var(--border)] bg-[var(--surface)]')}
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}

function Toggle({ checked, onChange, label, desc }: { checked: boolean; onChange: (v: boolean) => void; label: string; desc?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 py-2">
      <input type="checkbox" className="mt-1 size-5 accent-[#1f6fb2]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        <span className="block font-medium">{label}</span>
        {desc && <span className="block text-sm text-[var(--muted)]">{desc}</span>}
      </span>
    </label>
  );
}

export default function Settings() {
  const { settings, update, audio, refreshAudio } = useApp();
  const [msg, setMsg] = useState<{ tone: 'ok' | 'warn'; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const sample = maybeItem('ola-bom-dia');

  const [aiUrl, setAiUrl] = useState(settings.aiEndpoint ?? '');
  const [aiToken, setAiToken] = useState(settings.aiToken ?? '');
  const [aiStatus, setAiStatus] = useState<string | null>(null);
  useEffect(() => {
    if (location.hash.includes('audio')) document.getElementById('audio')?.scrollIntoView();
    if (location.hash.includes('ai')) document.getElementById('ai')?.scrollIntoView();
  }, []);
  const saveAi = async () => {
    const url = aiUrl.trim();
    if (url && !/^https?:\/\//.test(url)) {
      setAiStatus('Adres musi zaczynać się od https:// (lub http:// dla serwera lokalnego).');
      return;
    }
    const endpoint = url ? (url.endsWith('/') ? url : `${url}/`) : null;
    await update({ aiEndpoint: endpoint, aiToken: aiToken.trim() || null });
    if (!endpoint) return setAiStatus('Trener AI wyłączony.');
    try {
      const h = await checkHealth(endpoint);
      setAiStatus(h.mock ? 'Połączono — serwer działa w TRYBIE TESTOWYM (mock, bez prawdziwego AI).' : `Połączono z serwerem (model: ${h.model}).`);
    } catch (e) {
      setAiStatus(`Zapisano, ale nie udało się połączyć: ${(e as Error).message}`);
    }
  };

  const doExport = async () => {
    const data = await exportData();
    const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = backupFileName();
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    setMsg({ tone: 'ok', text: 'Wyeksportowano postępy do pliku JSON (bez nagrań głosu).' });
  };
  const doImport = async (f: File) => {
    try {
      const json = JSON.parse(await f.text());
      if (!confirm('Import zastąpi obecne postępy na tym urządzeniu. Kontynuować?')) return;
      const s = await importData(json);
      setMsg({ tone: 'ok', text: `Zaimportowano: ${s.lessonProgress} lekcji, ${s.cards} kart powtórek, ${s.mistakes} wpisów w zeszycie błędów.` });
    } catch (e) {
      setMsg({ tone: 'warn', text: (e as Error).message || 'Nie udało się wczytać pliku.' });
    }
  };

  const ptVoices = audio?.voices.filter((v) => classifyVoice(v) === 'pt-PT') ?? [];
  const brVoices = audio?.voices.filter((v) => classifyVoice(v) === 'pt-BR') ?? [];

  return (
    <div className="space-y-4">
      <PageHeader title="Ustawienia" back="/wiecej" />
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}

      <Card className="space-y-3">
        <h2 className="font-bold">Nauka</h2>
        <div>
          <p className="mb-1 text-sm font-medium">Domyślny czas dziennie</p>
          <Seg<DailyMinutes>
            label="Domyślny czas dziennie"
            value={settings.dailyMinutes}
            onChange={(v) => update({ dailyMinutes: v })}
            options={[
              { v: 5, l: '5 min' },
              { v: 15, l: '15 min' },
              { v: 30, l: '30 min' },
            ]}
          />
        </div>
        <div>
          <p className="mb-1 text-sm font-medium">Formy wypowiedzi</p>
          <Seg
            label="Formy wypowiedzi"
            value={settings.gender}
            onChange={(v) => update({ gender: v })}
            options={[
              { v: 'm', l: 'męskie (obrigado)' },
              { v: 'f', l: 'żeńskie (obrigada)' },
            ]}
          />
        </div>
        <Toggle checked={settings.showPronunciation} onChange={(v) => update({ showPronunciation: v })} label="Pokazuj zapis wymowy dla Polaka" desc="Wyłącz, gdy chcesz ćwiczyć czytanie samodzielnie. Zawsze możesz go odsłonić przy słowie." />
        <Toggle checked={settings.showIpa} onChange={(v) => update({ showIpa: v })} label="Pokazuj IPA" desc="Międzynarodowy alfabet fonetyczny — dla zainteresowanych." />
      </Card>

      <Card className="space-y-3" id="audio">
        <h2 className="font-bold">Audio</h2>
        {audio === null ? (
          <p className="text-sm">Sprawdzam głosy…</p>
        ) : (
          <>
            {audio.choice.status === 'pt-PT' && (
              <Notice tone="ok">
                Używany głos: <strong>{audio.choice.voice.name}</strong> ({audio.choice.voice.lang}){!audio.choice.voice.localService && ' — głos sieciowy (wymaga internetu)'}.
              </Notice>
            )}
            {audio.choice.status === 'pt-BR-fallback' && (
              <Notice tone="warn">Używasz głosu brazylijskiego ({audio.choice.voice.name}). Wymowa różni się od PT-PT — traktuj go tylko jako awaryjną pomoc.</Notice>
            )}
            {audio.choice.status === 'none' && (
              <Notice tone="warn" title="Brak głosu portugalskiego (Portugalia)">
                {!audio.ttsSupported ? 'Ta przeglądarka nie obsługuje syntezy mowy.' : 'Na tym urządzeniu nie znaleziono głosu pt-PT.'} Odsłuch działa tylko dla elementów z nagraniem
                ({audio.recordedCount}).
              </Notice>
            )}
            {sample && (
              <div className="flex items-center gap-3">
                <AudioButton item={sample} />
                <span className="text-sm">Test: „{sample.pt}”</span>
              </div>
            )}
            {ptVoices.length > 1 && (
              <label className="block text-sm">
                <span className="font-medium">Głos pt-PT</span>
                <select
                  className="focus-ring mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2"
                  value={settings.voiceURI ?? ''}
                  onChange={(e) => update({ voiceURI: e.target.value || null })}
                >
                  <option value="">automatycznie</option>
                  {ptVoices.map((v) => (
                    <option key={v.voiceURI} value={v.voiceURI}>
                      {v.name} {v.localService ? '' : '(online)'}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div>
              <p className="mb-1 text-sm font-medium">Tempo odtwarzania</p>
              <Seg<PlaybackRate>
                label="Tempo"
                value={settings.playbackRate}
                onChange={(v) => update({ playbackRate: v })}
                options={[
                  { v: 0.75, l: '0,75×' },
                  { v: 1, l: '1,0×' },
                  { v: 1.15, l: '1,15×' },
                ]}
              />
              <p className="mt-1 text-xs text-[var(--muted)]">Spowolniony głos syntetyczny nie brzmi tak naturalnie jak nagranie wolniejszej wymowy.</p>
            </div>
            <div>
              <p className="mb-1 text-sm font-medium">Powtórz każde odtworzenie</p>
              <Seg<1 | 2 | 3>
                label="Liczba powtórzeń"
                value={settings.repeatCount}
                onChange={(v) => update({ repeatCount: v })}
                options={[
                  { v: 1, l: '1×' },
                  { v: 2, l: '2×' },
                  { v: 3, l: '3×' },
                ]}
              />
            </div>
            <Toggle checked={settings.autoPlayAudio} onChange={(v) => update({ autoPlayAudio: v })} label="Automatycznie odtwarzaj w ćwiczeniach ze słuchu" />
            {brVoices.length > 0 && audio.choice.status !== 'pt-PT' && (
              <Toggle
                checked={settings.allowBrFallback}
                onChange={(v) => update({ allowBrFallback: v })}
                label="Awaryjnie używaj głosu brazylijskiego (niezalecane)"
                desc="Brazylijska wymowa wyraźnie różni się od europejskiej. Przy przyciskach pojawi się znacznik BR."
              />
            )}
            <Button variant="secondary" size="sm" onClick={() => refreshAudio()}>
              <RefreshCw className="size-4" /> Sprawdź głosy ponownie
            </Button>
            <details>
              <summary className="cursor-pointer text-sm font-medium">Jak dodać głos portugalski (Portugalia)?</summary>
              <ul className="mt-2 space-y-2 text-sm">
                {VOICE_HELP_PL.map((h) => (
                  <li key={h.platform}>
                    <strong>{h.platform}:</strong> {h.steps}
                  </li>
                ))}
              </ul>
            </details>
            <p className="text-xs text-[var(--muted)]">
              Nagrania lektora w bibliotece: {Object.keys(content.audio.files).length}. Pozostałe elementy korzystają z głosu urządzenia.
            </p>
          </>
        )}
      </Card>

      <Card className="space-y-3" id="ai">
        <h2 className="font-bold">Trener AI (opcjonalnie)</h2>
        <p className="text-sm text-[var(--muted)]">
          Wymaga Twojego serwera pośredniczącego (<code>npm run ai:proxy</code>), który przechowuje klucz API. W aplikacji nie wpisuje się klucza API.
        </p>
        <label className="block text-sm">
          <span className="font-medium">Adres serwera</span>
          <input
            value={aiUrl}
            onChange={(e) => setAiUrl(e.target.value)}
            placeholder="np. http://localhost:8787/"
            inputMode="url"
            className="focus-ring mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">Token dostępu do serwera (jeśli ustawiony LEVADA_PROXY_TOKEN)</span>
          <input
            value={aiToken}
            onChange={(e) => setAiToken(e.target.value)}
            type="password"
            autoComplete="off"
            className="focus-ring mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2"
          />
          <span className="text-xs text-[var(--muted)]">Token nie jest eksportowany w kopii zapasowej.</span>
        </label>
        <Button variant="secondary" size="sm" onClick={saveAi}>
          Zapisz i sprawdź połączenie
        </Button>
        {aiStatus && <p className="text-sm" role="status">{aiStatus}</p>}
        {settings.aiEndpoint && (
          <>
            <Toggle
              checked={settings.aiConsent}
              onChange={(v) => update({ aiConsent: v })}
              label="Zgoda na wysyłanie moich wypowiedzi (tekstu) do serwera AI"
              desc="Bez zgody trener AI się nie uruchomi. Nagrań głosu nie wysyłamy."
            />
            <Toggle
              checked={settings.aiShareProfile}
              onChange={(v) => update({ aiShareProfile: v })}
              label="Dołączaj dane z życiorysu (imię, miasto, praca, zainteresowania)"
              desc="Domyślnie wyłączone. Informacji o dziecku nigdy nie wysyłamy."
            />
          </>
        )}
      </Card>

      <Card className="space-y-3">
        <h2 className="font-bold">Wygląd</h2>
        <Seg
          label="Motyw"
          value={settings.theme}
          onChange={(v) => update({ theme: v })}
          options={[
            { v: 'system', l: 'jak system' },
            { v: 'light', l: 'jasny' },
            { v: 'dark', l: 'ciemny' },
          ]}
        />
      </Card>

      <Card className="space-y-3">
        <h2 className="font-bold">Twoje dane</h2>
        <p className="text-sm text-[var(--muted)]">Wszystko jest zapisane tylko na tym urządzeniu (IndexedDB). Bez konta, bez serwera.</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={doExport} data-testid="export">
            <Download className="size-4" /> Eksportuj postępy
          </Button>
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>
            <Upload className="size-4" /> Importuj
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            data-testid="import-input"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void doImport(f);
              e.target.value = '';
            }}
          />
        </div>
        <div className="flex flex-wrap gap-2 border-t border-[var(--border)] pt-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              if (confirm('Usunąć wszystkie zapisane nagrania głosu?')) {
                await deleteAllRecordings();
                setMsg({ tone: 'ok', text: 'Usunięto nagrania.' });
              }
            }}
          >
            <Trash2 className="size-4" /> Usuń nagrania
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-coral-600"
            onClick={async () => {
              if (confirm('Usunąć WSZYSTKIE dane (postępy, życiorys, nagrania)? Tej operacji nie można cofnąć.')) {
                await resetAllData();
                location.reload();
              }
            }}
          >
            <Trash2 className="size-4" /> Usuń wszystkie dane
          </Button>
        </div>
      </Card>
    </div>
  );
}
