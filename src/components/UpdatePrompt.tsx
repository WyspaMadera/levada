import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from './ui';

/** Informacja o nowej wersji aplikacji (Service Worker) i gotowości do pracy offline. */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW();
  // komunikat „offline” znika sam po kilku sekundach — nie może zasłaniać nauki
  useEffect(() => {
    if (!offlineReady) return;
    const t = setTimeout(() => setOfflineReady(false), 5000);
    return () => clearTimeout(t);
  }, [offlineReady, setOfflineReady]);
  if (!needRefresh && !offlineReady) return null;
  return (
    <div role="status" className="fixed inset-x-3 top-[max(0.75rem,env(safe-area-inset-top))] z-30 mx-auto max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-lg">
      <p className="text-sm">{needRefresh ? 'Dostępna jest nowa wersja Levady.' : 'Levada działa teraz także offline (podstawowe funkcje).'}</p>
      <div className="mt-2 flex justify-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setNeedRefresh(false);
            setOfflineReady(false);
          }}
        >
          Zamknij
        </Button>
        {needRefresh && (
          <Button size="sm" onClick={() => updateServiceWorker(true)}>
            Odśwież
          </Button>
        )}
      </div>
    </div>
  );
}
