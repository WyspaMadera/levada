/**
 * Schemat samogłosek (uproszczony trapez IPA): położenie języka przód–tył i góra–dół.
 * Porównanie samogłosek PT-PT (standard) z polskimi. Pozycje przybliżone, dydaktyczne.
 */
const PT: [string, number, number][] = [
  ['i', 30, 22],
  ['e', 48, 62],
  ['ɛ', 66, 102],
  ['a', 120, 140],
  ['ɐ', 140, 100],
  ['ɨ', 135, 26],
  ['u', 238, 22],
  ['o', 224, 62],
  ['ɔ', 210, 102],
];
const PL: [string, number, number][] = [
  ['i', 30, 22],
  ['ɨ', 108, 32],
  ['ɛ', 66, 102],
  ['a', 132, 140],
  ['ɔ', 210, 102],
  ['u', 238, 22],
];

export function VowelChart({ highlight = [] }: { highlight?: string[] }) {
  return (
    <figure className="space-y-1">
      <svg viewBox="0 0 280 170" className="h-auto w-full max-w-sm" role="img" aria-label={`Schemat samogłosek; wyróżnione: ${highlight.join(', ') || 'brak'}`}>
        <polygon points="20,15 250,15 250,150 95,150" fill="none" stroke="var(--border)" strokeWidth="2" />
        <text x="20" y="10" fontSize="9" fill="var(--muted)">przód języka</text>
        <text x="205" y="10" fontSize="9" fill="var(--muted)">tył języka</text>
        <text x="258" y="150" fontSize="9" fill="var(--muted)">nisko</text>
        {PL.map(([v, x, y]) => (
          <g key={`pl-${v}`}>
            <circle cx={x + 10} cy={y + 8} r="9" fill="none" stroke="#c4513a" strokeDasharray="2 2" />
            <text x={x + 10} y={y + 25} fontSize="7" textAnchor="middle" fill="#c4513a">PL</text>
          </g>
        ))}
        {PT.map(([v, x, y]) => {
          const on = highlight.includes(v);
          return (
            <g key={`pt-${v}`}>
              <circle cx={x} cy={y} r={on ? 12 : 9} fill={on ? '#1f6fb2' : 'var(--surface-2)'} stroke="#1f6fb2" />
              <text x={x} y={y + 4} fontSize="11" textAnchor="middle" fill={on ? '#fff' : 'var(--text)'} fontFamily="serif">
                {v}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="text-xs text-[var(--muted)]">
        Góra schematu = język wysoko, dół = nisko (usta szerzej otwarte). Niebieskie kółka — samogłoski PT-PT (IPA); czerwone przerywane — najbliższe polskie. Schemat przybliżony, do orientacji.
      </figcaption>
    </figure>
  );
}
