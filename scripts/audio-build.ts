/**
 * npm run audio:build [-- --only id1,id2] [--provider azure|google] [--slow] [--dry-run] [--force]
 *
 * Generuje nagrania pt-PT dla elementów treści przez skonfigurowanego dostawcę TTS i wpisuje je do
 * content/audio/manifest.json (tylko pliki, które fizycznie powstały). Klucze — WYŁĄCZNIE w zmiennych
 * środowiskowych / pliku .env poza repozytorium, nigdy we frontendzie.
 *
 *   Azure AI Speech: AZURE_SPEECH_KEY, AZURE_SPEECH_REGION, opcjonalnie AZURE_VOICE (domyślnie pt-PT-RaquelNeural)
 *   Google Cloud TTS: GOOGLE_TTS_API_KEY, opcjonalnie GOOGLE_VOICE (domyślnie pt-PT-Wavenet-A)
 *
 * Przed użyciem sprawdź aktualne warunki licencji dostawcy (czy wolno dystrybuować wygenerowane pliki
 * w aplikacji) i wpisz je do pola `license` manifestu. Każde nagranie trafia jako `checked: false` —
 * człowiek musi je odsłuchać (akcent, samogłoski otwarte/zamknięte) i dopiero wtedy ustawić `checked: true`.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

type Item = { id: string; pt: string; tts?: string };
type Manifest = {
  provider: string | null;
  voice: string | null;
  license: string | null;
  generatedAt: string | null;
  files: Record<string, { normal?: string; slow?: string; checked: boolean }>;
};

const ROOT = process.cwd();
const args = process.argv.slice(2);
const flag = (n: string) => args.includes(`--${n}`);
const opt = (n: string) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : undefined;
};

function loadEnv() {
  const p = join(ROOT, '.env');
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, '');
  }
}

const escapeXml = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!);

type Provider = { name: string; voice: string; synth: (text: string, slow: boolean) => Promise<Buffer> };

function azure(): Provider | null {
  const key = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION;
  if (!key || !region) return null;
  const voice = process.env.AZURE_VOICE ?? 'pt-PT-RaquelNeural';
  if (!voice.startsWith('pt-PT')) throw new Error(`AZURE_VOICE musi być głosem pt-PT (jest: ${voice})`);
  return {
    name: 'azure',
    voice,
    synth: async (text, slow) => {
      const ssml = `<speak version="1.0" xml:lang="pt-PT"><voice name="${voice}"><prosody rate="${slow ? '-25%' : '0%'}">${escapeXml(text)}</prosody></voice></speak>`;
      const r = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': key,
          'Content-Type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
          'User-Agent': 'levada-audio-build',
        },
        body: ssml,
      });
      if (!r.ok) throw new Error(`Azure TTS: HTTP ${r.status} ${await r.text()}`);
      return Buffer.from(await r.arrayBuffer());
    },
  };
}

function google(): Provider | null {
  const key = process.env.GOOGLE_TTS_API_KEY;
  if (!key) return null;
  const voice = process.env.GOOGLE_VOICE ?? 'pt-PT-Wavenet-A';
  if (!voice.startsWith('pt-PT')) throw new Error(`GOOGLE_VOICE musi być głosem pt-PT (jest: ${voice})`);
  return {
    name: 'google',
    voice,
    synth: async (text, slow) => {
      const r = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(key)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: { text },
          voice: { languageCode: 'pt-PT', name: voice },
          audioConfig: { audioEncoding: 'MP3', speakingRate: slow ? 0.78 : 1 },
        }),
      });
      if (!r.ok) throw new Error(`Google TTS: HTTP ${r.status} ${await r.text()}`);
      const j = (await r.json()) as { audioContent: string };
      return Buffer.from(j.audioContent, 'base64');
    },
  };
}

async function main() {
  loadEnv();
  const itemsDir = join(ROOT, 'content', 'items');
  const items: Item[] = readdirSync(itemsDir)
    .filter((f) => f.endsWith('.json'))
    .flatMap((f) => JSON.parse(readFileSync(join(itemsDir, f), 'utf8')) as Item[]);
  const only = opt('only')?.split(',');
  const selected = only ? items.filter((i) => only.includes(i.id)) : items;
  const manifestPath = join(ROOT, 'content', 'audio', 'manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Manifest;
  const todo = selected.filter((i) => flag('force') || !manifest.files[i.id]?.normal);

  const wanted = opt('provider');
  const provider = (wanted === 'google' ? google() : wanted === 'azure' ? azure() : (azure() ?? google())) ?? null;
  console.log(`Elementy: ${items.length}, wybrane: ${selected.length}, do wygenerowania: ${todo.length}`);
  if (!provider) {
    console.error(
      '\n✖ Brak skonfigurowanego dostawcy TTS pt-PT. Nic nie zostało wygenerowane.\n' +
        '  Ustaw w pliku .env (poza repozytorium) jedną z konfiguracji:\n' +
        '    AZURE_SPEECH_KEY=…  AZURE_SPEECH_REGION=westeurope  [AZURE_VOICE=pt-PT-RaquelNeural]\n' +
        '    GOOGLE_TTS_API_KEY=…  [GOOGLE_VOICE=pt-PT-Wavenet-A]\n' +
        '  i sprawdź warunki licencji dostawcy przed publikacją nagrań.',
    );
    process.exit(2);
  }
  if (flag('dry-run')) {
    console.log(`(dry-run) Dostawca: ${provider.name}, głos: ${provider.voice}. Przykłady: ${todo.slice(0, 5).map((i) => i.id).join(', ')}`);
    return;
  }
  const outDir = join(ROOT, 'public', 'audio', 'pt-PT');
  mkdirSync(outDir, { recursive: true });
  let ok = 0;
  for (const it of todo) {
    const text = (it.tts ?? it.pt).replace(/…|\.\.\./g, '').trim();
    try {
      const normal = await provider.synth(text, false);
      writeFileSync(join(outDir, `${it.id}.mp3`), normal);
      const entry: Manifest['files'][string] = { normal: `audio/pt-PT/${it.id}.mp3`, checked: false };
      if (flag('slow')) {
        writeFileSync(join(outDir, `${it.id}.slow.mp3`), await provider.synth(text, true));
        entry.slow = `audio/pt-PT/${it.id}.slow.mp3`;
      }
      manifest.files[it.id] = entry;
      ok++;
      process.stdout.write('.');
    } catch (e) {
      console.error(`\n✖ ${it.id}: ${(e as Error).message}`);
    }
  }
  manifest.provider = provider.name;
  manifest.voice = provider.voice;
  manifest.generatedAt = new Date().toISOString();
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`\nWygenerowano ${ok}/${todo.length} plików. Wszystkie mają checked:false — wymagają odsłuchu przez człowieka.`);
  if (!manifest.license) console.warn('⚠ Uzupełnij pole „license” w content/audio/manifest.json (warunki dostawcy).');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
