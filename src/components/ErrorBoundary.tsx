import { Component, type ReactNode } from 'react';

/** Błąd w jednym ekranie nie wyłącza całej aplikacji — dane w IndexedDB pozostają nietknięte. */
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidUpdate(prev: { resetKey?: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="space-y-3 rounded-2xl border border-coral-600/40 bg-coral-100/60 p-4 dark:bg-coral-600/15">
        <p className="font-semibold">Ten ekran napotkał błąd.</p>
        <p className="text-sm">Twoje postępy są bezpieczne (zapisane na urządzeniu). Wróć do ekranu głównego albo odśwież stronę.</p>
        <p className="text-xs text-[var(--muted)]">Szczegóły: {this.state.error.message}</p>
        <div className="flex gap-2">
          <a href="#/" className="rounded-xl bg-atlantic-600 px-4 py-2 text-sm font-semibold text-white">Ekran główny</a>
          <button type="button" className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm" onClick={() => location.reload()}>
            Odśwież
          </button>
        </div>
      </div>
    );
  }
}
