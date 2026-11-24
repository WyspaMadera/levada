import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, defaultSettings, type Settings } from '@/db/db';
import { ensureSettings, updateSettings } from '@/db/repo';
import { getAudioStatus, type AudioStatus } from '@/lib/audio';
import { todayKey } from '@/lib/planner';

type AppCtx = {
  settings: Settings;
  ready: boolean;
  update: (patch: Partial<Settings>) => Promise<void>;
  audio: AudioStatus | null;
  refreshAudio: () => Promise<void>;
  /** Minuty na dziś (z uwzględnieniem zmiany „tylko na dziś”). */
  todayMinutes: 5 | 15 | 30;
};

const Ctx = createContext<AppCtx | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [bootstrapped, setBootstrapped] = useState(false);
  useEffect(() => {
    ensureSettings().then(() => setBootstrapped(true));
  }, []);
  const stored = useLiveQuery(() => db.settings.get('settings'), []);
  const settings = useMemo<Settings>(() => ({ ...defaultSettings(), ...(stored ?? {}) }), [stored]);
  const [audio, setAudio] = useState<AudioStatus | null>(null);

  const refreshAudio = useCallback(async () => {
    setAudio(await getAudioStatus(settings.voiceURI, settings.allowBrFallback));
  }, [settings.voiceURI, settings.allowBrFallback]);

  useEffect(() => {
    void refreshAudio();
  }, [refreshAudio]);

  // motyw
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = settings.theme === 'dark' || (settings.theme === 'system' && Boolean(mq?.matches));
      document.documentElement.classList.toggle('dark', dark);
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0a1622' : '#0f2a44');
    };
    apply();
    mq?.addEventListener?.('change', apply);
    return () => mq?.removeEventListener?.('change', apply);
  }, [settings.theme]);

  const todayMinutes = settings.todayOverride?.date === todayKey() ? settings.todayOverride.minutes : settings.dailyMinutes;

  const value = useMemo<AppCtx>(
    () => ({ settings, ready: bootstrapped && stored !== undefined, update: updateSettings, audio, refreshAudio, todayMinutes }),
    [settings, bootstrapped, stored, audio, refreshAudio, todayMinutes],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useApp poza AppProvider');
  return c;
}
