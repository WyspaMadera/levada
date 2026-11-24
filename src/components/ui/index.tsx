import { clsx } from 'clsx';
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { ChevronLeft } from 'lucide-react';

export const cx = clsx;

type Variant = 'primary' | 'secondary' | 'ghost' | 'success' | 'danger' | 'outline';
const variants: Record<Variant, string> = {
  primary: 'bg-atlantic-600 text-white hover:bg-atlantic-700 dark:bg-atlantic-500 dark:hover:bg-atlantic-600',
  secondary: 'bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border)] hover:brightness-95',
  outline: 'border-2 border-atlantic-600 text-atlantic-700 dark:text-atlantic-100 dark:border-atlantic-500 bg-transparent hover:bg-atlantic-100/50 dark:hover:bg-atlantic-700/30',
  ghost: 'bg-transparent text-[var(--text)] hover:bg-[var(--surface-2)]',
  success: 'bg-laurel-600 text-white hover:bg-laurel-700',
  danger: 'bg-coral-600 text-white hover:brightness-95',
};

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <button
      type="button"
      {...rest}
      className={cx(
        'focus-ring inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition select-none disabled:opacity-50 disabled:pointer-events-none',
        size === 'sm' && 'min-h-9 px-3 text-sm',
        size === 'md' && 'min-h-11 px-4 text-[15px]',
        size === 'lg' && 'min-h-14 px-5 text-base',
        variants[variant],
        className,
      )}
    />
  );
}

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div {...rest} className={cx('rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm', className)} />;
}

export function Badge({ tone = 'neutral', children, className, title }: { tone?: 'neutral' | 'info' | 'warn' | 'ok' | 'danger'; children: ReactNode; className?: string; title?: string }) {
  const tones = {
    neutral: 'bg-[var(--surface-2)] text-[var(--muted)] border-[var(--border)]',
    info: 'bg-atlantic-100 text-atlantic-700 border-atlantic-100 dark:bg-atlantic-700/30 dark:text-atlantic-100 dark:border-atlantic-700',
    warn: 'bg-amber-100 text-amber-700 border-amber-100 dark:bg-amber-700/30 dark:text-amber-100 dark:border-amber-700',
    ok: 'bg-laurel-100 text-laurel-700 border-laurel-100 dark:bg-laurel-700/30 dark:text-laurel-100 dark:border-laurel-700',
    danger: 'bg-coral-100 text-coral-600 border-coral-100 dark:bg-coral-600/20 dark:text-coral-100 dark:border-coral-600',
  } as const;
  return (
    <span title={title} className={cx('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium', tones[tone], className)}>
      {children}
    </span>
  );
}

export function Notice({ tone = 'info', title, children, className }: { tone?: 'info' | 'warn' | 'ok'; title?: string; children: ReactNode; className?: string }) {
  const tones = {
    info: 'border-atlantic-500/30 bg-atlantic-100/60 dark:bg-atlantic-700/20',
    warn: 'border-amber-700/30 bg-amber-100/70 dark:bg-amber-700/20',
    ok: 'border-laurel-600/30 bg-laurel-100/70 dark:bg-laurel-700/20',
  } as const;
  return (
    <div role={tone === 'warn' ? 'alert' : 'status'} className={cx('rounded-xl border p-3 text-sm', tones[tone], className)}>
      {title && <p className="mb-1 font-semibold">{title}</p>}
      <div className="text-[var(--text)]/90">{children}</div>
    </div>
  );
}

export function ProgressBar({ value, label, className }: { value: number; label?: string; className?: string }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div className={className}>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-2)] border border-[var(--border)]"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div className="h-full rounded-full bg-laurel-600 transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, back, right }: { title: string; subtitle?: string; back?: string | true; right?: ReactNode }) {
  const nav = useNavigate();
  return (
    <header className="mb-4 flex items-start gap-2">
      {back && (
        <button
          type="button"
          aria-label="Wstecz"
          className="focus-ring -ml-2 mt-0.5 rounded-full p-2 hover:bg-[var(--surface-2)]"
          onClick={() => (back === true ? nav(-1) : nav(back))}
        >
          <ChevronLeft className="size-6" />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-bold leading-tight text-[var(--text)]">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-[var(--muted)]">{subtitle}</p>}
      </div>
      {right}
    </header>
  );
}

export function LinkCard({ to, icon, title, desc, badge }: { to: string; icon: ReactNode; title: string; desc?: string; badge?: ReactNode }) {
  return (
    <Link to={to} className="focus-ring block rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm transition hover:brightness-[0.98]">
      <div className="flex items-center gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-atlantic-100 text-atlantic-700 dark:bg-atlantic-700/30 dark:text-atlantic-100">{icon}</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-semibold">{title}</p>
            {badge}
          </div>
          {desc && <p className="text-sm text-[var(--muted)]">{desc}</p>}
        </div>
      </div>
    </Link>
  );
}

/** Prosty tekst z **pogrubieniami** i akapitami (treść wyjaśnień gramatycznych). */
export function RichText({ text, className }: { text: string; className?: string }) {
  return (
    <div className={cx('space-y-3 leading-relaxed', className)}>
      {text.split(/\n\s*\n/).map((para, i) => (
        <p key={i}>
          {para.split('\n').map((line, j, arr) => (
            <span key={j}>
              {line.split(/(\*\*[^*]+\*\*)/g).map((chunk, k) =>
                chunk.startsWith('**') && chunk.endsWith('**') ? <strong key={k}>{chunk.slice(2, -2)}</strong> : <span key={k}>{chunk}</span>,
              )}
              {j < arr.length - 1 && <br />}
            </span>
          ))}
        </p>
      ))}
    </div>
  );
}
