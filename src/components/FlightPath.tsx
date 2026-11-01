import { formatTimeOfDay } from '@/utils/time';

interface FlightPathProps {
  /** 0..1 */
  progress: number;
  departureAt: number;
  arrivalAt: number;
  paused?: boolean;
}

// Quadratic Bézier route: departure → apex → arrival.
const P0 = { x: 24, y: 108 };
const P1 = { x: 320, y: -14 };
const P2 = { x: 616, y: 108 };

function pointAt(t: number) {
  const u = 1 - t;
  return {
    x: u * u * P0.x + 2 * u * t * P1.x + t * t * P2.x,
    y: u * u * P0.y + 2 * u * t * P1.y + t * t * P2.y
  };
}

function angleAt(t: number) {
  const dx = 2 * (1 - t) * (P1.x - P0.x) + 2 * t * (P2.x - P1.x);
  const dy = 2 * (1 - t) * (P1.y - P0.y) + 2 * t * (P2.y - P1.y);
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

/** The flown segment [0, t] of a quadratic Bézier is itself a quadratic (de Casteljau). */
function flownPath(t: number) {
  const c = { x: P0.x + (P1.x - P0.x) * t, y: P0.y + (P1.y - P0.y) * t };
  const end = pointAt(t);
  return `M ${P0.x} ${P0.y} Q ${c.x} ${c.y} ${end.x} ${end.y}`;
}

export function FlightPath({ progress, departureAt, arrivalAt, paused }: FlightPathProps) {
  const t = Math.min(1, Math.max(0, progress));
  const plane = pointAt(t);
  const angle = angleAt(t);

  return (
    <svg viewBox="0 0 640 140" className="w-full" role="img" aria-label={`Пройдено ${Math.round(t * 100)}% маршрута`}>
      {/* Horizon */}
      <line x1="0" x2="640" y1="108" y2="108" className="stroke-line" strokeWidth="1" />
      {[...Array(17)].map((_, i) => (
        <line key={i} x1={i * 40} x2={i * 40} y1="108" y2="112" className="stroke-line" strokeWidth="1" />
      ))}

      {/* Planned route */}
      <path
        d={`M ${P0.x} ${P0.y} Q ${P1.x} ${P1.y} ${P2.x} ${P2.y}`}
        fill="none"
        className="stroke-faint/50"
        strokeWidth="1.5"
        strokeDasharray="2 6"
        strokeLinecap="round"
      />
      {/* Flown route */}
      {t > 0.001 && (
        <path d={flownPath(t)} fill="none" className="stroke-accent" strokeWidth="2" strokeLinecap="round" />
      )}

      <circle cx={P0.x} cy={P0.y} r="4" className="fill-accent" />
      <circle cx={P2.x} cy={P2.y} r="4" className={t >= 1 ? 'fill-accent' : 'fill-bg stroke-faint'} strokeWidth="1.5" />

      <text x={P0.x} y="132" className="fill-faint text-[11px] tracking-[0.12em]" style={{ fontFeatureSettings: '"tnum"' }}>
        ВЫЛЕТ {formatTimeOfDay(departureAt)}
      </text>
      <text
        x={P2.x}
        y="132"
        textAnchor="end"
        className="fill-faint text-[11px] tracking-[0.12em]"
        style={{ fontFeatureSettings: '"tnum"' }}
      >
        {paused ? 'ПРИЛЁТ —' : `ПРИЛЁТ ${formatTimeOfDay(arrivalAt)}`}
      </text>

      {/* Aircraft, nose pointing along the route */}
      <g
        style={{ transition: 'transform 900ms linear' }}
        transform={`translate(${plane.x} ${plane.y}) rotate(${angle})`}
      >
        <circle r="13" className="fill-bg" />
        <path
          d="M10 0 L3 -1.6 L-2 -9 L-4.6 -9 L-2.2 -1.6 L-7 -1.4 L-9 -4.2 L-10.6 -4.2 L-9.4 0 L-10.6 4.2 L-9 4.2 L-7 1.4 L-2.2 1.6 L-4.6 9 L-2 9 L3 1.6 Z"
          className={paused ? 'fill-faint' : 'fill-ink'}
        />
      </g>
    </svg>
  );
}
