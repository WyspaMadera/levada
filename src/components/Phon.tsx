import { Fragment } from 'react';
import { cx } from './ui';

/** Sylaba jest akcentowana, gdy wszystkie jej litery (poza „ɫ” i końcowym „(y)”) są wielkie. */
export function isStressedSyllable(p: string): boolean {
  const letters = [...p.replace(/\(y\)$/, '')].filter((c) => /\p{L}/u.test(c) && c !== 'ɫ' && c !== 'Ɫ');
  return letters.length > 0 && letters.every((c) => c === c.toUpperCase() && c !== c.toLowerCase());
}

/** „ɫ” (ciemne l) w pogrubionej czcionce bywa mylone z polskim „Ł” — rysujemy je osobno, z podpowiedzią. */
function withDarkL(text: string) {
  if (!text.includes('ɫ')) return text;
  return text.split(/(ɫ)/).map((t, i) =>
    t === 'ɫ' ? (
      <span key={i} className="dark-l" title="ciemne l — język przy zębach; to NIE jest polskie ł">
        l
      </span>
    ) : (
      <Fragment key={i}>{t}</Fragment>
    ),
  );
}

/** Wyświetla zapis „Fonetyka PL” z wyróżnioną sylabą akcentowaną. */
export function Phon({ text, className, size = 'md' }: { text: string; className?: string; size?: 'sm' | 'md' | 'lg' }) {
  const parts = text.normalize('NFC').split(/([\s\-‿]+)/);
  return (
    <span className={cx('phon', size === 'sm' && 'text-sm', size === 'md' && 'text-base', size === 'lg' && 'text-xl', className)} aria-label={`wymowa: ${text}`}>
      {parts.map((p, i) =>
        /^[\s\-‿]+$/.test(p) ? (
          <span key={i} className={p.includes('-') ? 'text-[var(--muted)]' : undefined}>
            {p}
          </span>
        ) : (
          <Fragment key={i}>
            {p.split(/([^\p{L}()ɫ]+)/u).map((chunk, j) =>
              isStressedSyllable(chunk) ? (
                <span key={j} className="stress">
                  {withDarkL(chunk)}
                </span>
              ) : (
                <Fragment key={j}>{withDarkL(chunk)}</Fragment>
              ),
            )}
          </Fragment>
        ),
      )}
    </span>
  );
}
