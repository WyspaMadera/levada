import type { MapStop } from '@/content/schema';
import { cx } from './ui';

/** Stylizowany zarys Madery (oryginalna grafika — nie mapa topograficzna, nie realne szlaki). */
export const MADEIRA_PATH =
  'M38 168 C40 158 50 150 62 147 C80 142 100 141 120 138 C145 134 170 131 195 130 C215 129 235 132 252 136 C270 140 284 146 296 152 C305 156 312 158 322 157 C335 155 350 152 366 153 C372 154 374 158 368 160 C352 162 336 163 320 166 C308 168 300 172 294 178 C280 186 262 192 244 195 C228 197 212 198 198 197 C180 196 165 193 150 191 C128 189 108 187 92 185 C70 183 52 180 42 175 Z';
export const PORTO_SANTO_PATH = 'M322 66 C326 54 344 46 360 48 C370 50 372 58 364 64 C354 72 334 76 322 66 Z';

/** Położenie podpisów (dx, dy, wyrównanie) — ręcznie, by się nie nakładały. */
const LABEL: Record<string, [number, number, 'start' | 'middle' | 'end']> = {
  funchal: [4, 15, 'start'],
  'camara-de-lobos': [-3, -8, 'end'],
  'ribeira-brava': [0, 15, 'middle'],
  calheta: [0, 15, 'middle'],
  'porto-moniz': [0, -9, 'middle'],
  santana: [0, -9, 'middle'],
  'pico-do-arieiro': [0, -9, 'middle'],
  machico: [0, 15, 'middle'],
  'ponta-sao-lourenco': [8, -9, 'end'],
  'porto-santo': [0, -9, 'middle'],
};

export type StopStatus = 'done' | 'current' | 'locked' | 'needs-review';

function trailPath(stops: MapStop[]): string {
  if (stops.length < 2) return '';
  let d = `M${stops[0]!.x} ${stops[0]!.y}`;
  for (let i = 1; i < stops.length; i++) {
    const a = stops[i - 1]!;
    const b = stops[i]!;
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2 - (b.x > a.x ? 6 : -6);
    d += ` Q${mx} ${my} ${b.x} ${b.y}`;
  }
  return d;
}

export function MadeiraMap({
  stops,
  status,
  selected,
  onSelect,
  className,
}: {
  stops: MapStop[];
  status: Record<string, StopStatus>;
  selected?: string | null;
  onSelect?: (id: string) => void;
  className?: string;
}) {
  const doneIdx = stops.reduce((acc, s, i) => (status[s.id] === 'done' || status[s.id] === 'needs-review' ? i : acc), -1);
  const doneStops = stops.slice(0, Math.max(0, doneIdx + 2));
  return (
    <svg viewBox="22 28 362 182" className={cx('h-auto w-full', className)} role="group" aria-label="Mapa szlaku nauki — stylizowana Madera">
      <defs>
        <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#cfe5f6" />
          <stop offset="1" stopColor="#a9d0ee" />
        </linearGradient>
        <linearGradient id="land" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5c9b6b" />
          <stop offset="1" stopColor="#7fb487" />
        </linearGradient>
        <radialGradient id="peak" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#3f7a4f" />
          <stop offset="1" stopColor="#3f7a4f" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x="22" y="28" width="362" height="182" rx="14" fill="url(#sea)" className="dark:opacity-40" />
      {/* fale */}
      <g stroke="#ffffff" strokeOpacity="0.5" strokeWidth="1" fill="none">
        <path d="M40 60 q8 -5 16 0 t16 0" />
        <path d="M150 60 q8 -5 16 0 t16 0" />
        <path d="M120 208 q8 -5 16 0 t16 0" />
        <path d="M300 200 q8 -5 16 0 t16 0" />
      </g>
      <path d={PORTO_SANTO_PATH} fill="#d8c49a" stroke="#b9a274" strokeWidth="1" />
      <path d={MADEIRA_PATH} fill="url(#land)" stroke="#2f6b43" strokeWidth="1.2" />
      {/* masyw centralny */}
      <ellipse cx="205" cy="160" rx="55" ry="16" fill="url(#peak)" />
      <ellipse cx="140" cy="160" rx="40" ry="12" fill="url(#peak)" opacity="0.7" />
      <text x="30" y="204" fontSize="8" fill="#24577f" opacity="0.8">
        Oceano Atlântico
      </text>
      {/* levada — szlak */}
      <path d={trailPath(stops)} fill="none" stroke="#2f86cf" strokeWidth="2.2" strokeDasharray="4 4" strokeLinecap="round" opacity="0.85" />
      {doneStops.length > 1 && <path d={trailPath(doneStops)} fill="none" stroke="#1f6fb2" strokeWidth="3.2" strokeLinecap="round" />}
      {stops.map((s) => {
        const st = status[s.id] ?? 'locked';
        const fill = st === 'done' ? '#2f7d4f' : st === 'current' ? '#1f6fb2' : st === 'needs-review' ? '#d18f1f' : '#ffffff';
        const isSel = selected === s.id;
        return (
          <g
            key={s.id}
            role="button"
            tabIndex={0}
            aria-label={`${s.namePt}: ${st === 'done' ? 'ukończone' : st === 'current' ? 'aktualny etap' : st === 'needs-review' ? 'warto powtórzyć' : 'przed Tobą'}`}
            aria-pressed={isSel}
            onClick={() => onSelect?.(s.id)}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect?.(s.id)}
            className="cursor-pointer outline-none [&:focus-visible_circle]:stroke-[#ff9b85]"
          >
            <circle cx={s.x} cy={s.y} r="14" fill="transparent" />
            {st === 'current' && <circle cx={s.x} cy={s.y} r="9" fill="#1f6fb2" opacity="0.25" className="animate-ping origin-center [transform-box:fill-box]" />}
            <circle cx={s.x} cy={s.y} r={isSel ? 7 : 5.5} fill={fill} stroke={st === 'locked' ? '#5a6776' : '#ffffff'} strokeWidth="1.8" />
            <text
              x={s.x + (LABEL[s.id]?.[0] ?? 0)}
              y={s.y + (LABEL[s.id]?.[1] ?? 15)}
              textAnchor={LABEL[s.id]?.[2] ?? 'middle'}
              fontSize="8.5"
              fontWeight={isSel || st === 'current' ? 700 : 500}
              fill="#0f2a44"
              paintOrder="stroke"
              stroke="#ffffffcc"
              strokeWidth="2.5"
            >
              {s.namePt}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function LevadaLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <rect width="64" height="64" rx="16" fill="#0f2a44" />
      <path d="M10 44 C20 30 30 46 40 32 C46 24 52 26 56 22" fill="none" stroke="#6db3ee" strokeWidth="4" strokeLinecap="round" />
      <path d="M10 50 C20 36 30 52 40 38 C46 30 52 32 56 28" fill="none" stroke="#2f7d4f" strokeWidth="3" strokeLinecap="round" opacity="0.9" />
      <circle cx="40" cy="32" r="3.5" fill="#f7f3ec" />
    </svg>
  );
}
