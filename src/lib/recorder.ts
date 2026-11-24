/** Nagrywanie własnego głosu (MediaRecorder). Nagrania zostają na urządzeniu. */

export function recordingSupported(): boolean {
  return typeof window !== 'undefined' && typeof MediaRecorder !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);
}

export function pickMime(): string {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
  for (const c of candidates) if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(c)) return c;
  return '';
}

export type RecordingHandle = { stop: () => Promise<{ blob: Blob; mime: string; durationMs: number }>; cancel: () => void };

export async function startRecording(maxMs = 30_000): Promise<RecordingHandle> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  const mime = pickMime();
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  const chunks: Blob[] = [];
  const started = performance.now();
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const stopTracks = () => stream.getTracks().forEach((t) => t.stop());
  const stopped = new Promise<{ blob: Blob; mime: string; durationMs: number }>((resolve) => {
    rec.onstop = () => {
      stopTracks();
      const type = rec.mimeType || mime || 'audio/webm';
      resolve({ blob: new Blob(chunks, { type }), mime: type, durationMs: performance.now() - started });
    };
  });
  rec.start();
  const timer = setTimeout(() => rec.state === 'recording' && rec.stop(), maxMs);
  return {
    stop: () => {
      clearTimeout(timer);
      if (rec.state === 'recording') rec.stop();
      return stopped;
    },
    cancel: () => {
      clearTimeout(timer);
      if (rec.state === 'recording') rec.stop();
      stopTracks();
    },
  };
}

/** Opcjonalne rozpoznawanie mowy pt-PT (Chrome/Edge/Safari — nie wszędzie). Wynik tylko orientacyjny. */
type SR = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

export function speechRecognitionSupported(): boolean {
  const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
  return Boolean(w.SpeechRecognition ?? w.webkitSpeechRecognition);
}

export function recognizeOnce(lang = 'pt-PT'): { promise: Promise<string[]>; stop: () => void } {
  const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!Ctor) return { promise: Promise.reject(new Error('unsupported')), stop: () => {} };
  const r = new Ctor();
  r.lang = lang;
  r.interimResults = false;
  r.maxAlternatives = 3;
  const promise = new Promise<string[]>((resolve, reject) => {
    let got: string[] = [];
    r.onresult = (e) => {
      const first = e.results[0];
      got = first ? Array.from({ length: first.length }, (_, i) => first[i]!.transcript) : [];
    };
    r.onerror = (e) => reject(new Error(e.error));
    r.onend = () => resolve(got);
  });
  r.start();
  return { promise, stop: () => r.stop() };
}
