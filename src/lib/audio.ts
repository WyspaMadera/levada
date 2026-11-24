/**
 * Odtwarzanie PT-PT: 1) nagranie z biblioteki (content/audio/manifest.json, jeśli plik istnieje),
 * 2) Web Speech API z głosem pt-PT. Bez głosu pt-PT — jasny komunikat (bez cichego pt-BR).
 */
import { content } from '@/content/content';
import type { LearningItem } from '@/content/schema';
import { pickVoice, polishVoice, type VoiceChoice, type VoiceLike } from './voices';

export type AudioStatus = {
  ttsSupported: boolean;
  voices: VoiceLike[];
  choice: VoiceChoice;
  polish: VoiceLike | null;
  recordedCount: number;
};

let voicesCache: SpeechSynthesisVoice[] = [];

export function ttsSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
}

export function loadVoices(timeoutMs = 2500): Promise<SpeechSynthesisVoice[]> {
  if (!ttsSupported()) return Promise.resolve([]);
  const synth = window.speechSynthesis;
  const now = synth.getVoices();
  if (now.length) {
    voicesCache = now;
    return Promise.resolve(now);
  }
  return new Promise((resolve) => {
    const done = () => {
      voicesCache = synth.getVoices();
      resolve(voicesCache);
    };
    synth.addEventListener('voiceschanged', done, { once: true });
    setTimeout(done, timeoutMs);
  });
}

export async function getAudioStatus(preferredURI: string | null, allowBr: boolean): Promise<AudioStatus> {
  const voices = await loadVoices();
  const like = voices.map((v) => ({ name: v.name, lang: v.lang, voiceURI: v.voiceURI, localService: v.localService, default: v.default }));
  return {
    ttsSupported: ttsSupported(),
    voices: like,
    choice: pickVoice(like, preferredURI, allowBr),
    polish: polishVoice(like),
    recordedCount: Object.keys(content.audio.files).length,
  };
}

function findVoice(uri: string): SpeechSynthesisVoice | undefined {
  return voicesCache.find((v) => v.voiceURI === uri);
}

let currentAudio: HTMLAudioElement | null = null;
let playToken = 0;

export function stopAll() {
  playToken++;
  if (ttsSupported()) window.speechSynthesis.cancel();
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function speakOnce(text: string, voiceURI: string, lang: string, rate: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const u = new SpeechSynthesisUtterance(text);
    const v = findVoice(voiceURI);
    if (v) u.voice = v;
    u.lang = lang;
    u.rate = rate;
    u.onend = () => resolve();
    u.onerror = (e) => (e.error === 'interrupted' || e.error === 'canceled' ? resolve() : reject(new Error(e.error)));
    window.speechSynthesis.speak(u);
  });
}

function playFile(src: string, rate: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const a = new Audio(src);
    a.playbackRate = rate;
    // zachowaj wysokość dźwięku przy zmianie tempa (gdzie obsługiwane)
    (a as HTMLAudioElement & { preservesPitch?: boolean }).preservesPitch = true;
    currentAudio = a;
    a.onended = () => resolve();
    a.onerror = () => reject(new Error('audio-file-error'));
    a.play().catch(reject);
  });
}

export type PlayOptions = { rate: number; repeat?: number; pauseMs?: number; fem?: boolean; slow?: boolean };
export type PlayResult = { ok: true; source: 'recording' | 'tts' } | { ok: false; reason: 'no-voice' | 'unsupported' | 'error' };

/** Tekst do odczytania dla elementu (forma żeńska, jeśli dotyczy). */
export function speechText(item: LearningItem, fem = false): string {
  if (fem && item.ptFem) return item.ttsFem ?? item.ptFem.replace(/…|\.\.\./g, '').trim();
  return item.tts ?? item.pt.replace(/…|\.\.\./g, '').trim();
}

export async function playItem(item: LearningItem, choice: VoiceChoice, opts: PlayOptions): Promise<PlayResult> {
  stopAll();
  const token = ++playToken;
  const repeat = opts.repeat ?? 1;
  const rec = !opts.fem ? content.audio.files[item.id] : undefined;
  const file = rec ? (opts.slow && rec.slow ? rec.slow : rec.normal) : undefined;
  try {
    for (let i = 0; i < repeat; i++) {
      if (token !== playToken) return { ok: true, source: file ? 'recording' : 'tts' };
      if (file) {
        await playFile(`./${file}`, opts.slow && !rec?.slow ? Math.min(opts.rate, 0.85) : opts.rate);
      } else {
        if (!ttsSupported()) return { ok: false, reason: 'unsupported' };
        if (!choice.voice) return { ok: false, reason: 'no-voice' };
        await speakOnce(speechText(item, opts.fem), choice.voice.voiceURI, choice.voice.lang, opts.slow ? Math.min(opts.rate, 0.75) : opts.rate);
      }
      if (i < repeat - 1) await sleep(opts.pauseMs ?? 1200);
    }
    return { ok: true, source: file ? 'recording' : 'tts' };
  } catch {
    return { ok: false, reason: 'error' };
  }
}

/** Odczyt dowolnego tekstu PT (np. kafelki) lub PL (Tryb Auto: polskie znaczenie). */
export async function speakText(text: string, voice: VoiceLike | null, rate = 1): Promise<boolean> {
  if (!ttsSupported() || !voice) return false;
  try {
    await speakOnce(text, voice.voiceURI, voice.lang, rate);
    return true;
  } catch {
    return false;
  }
}
