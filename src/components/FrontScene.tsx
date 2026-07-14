// The landing meadow: paper-and-ink plains in the same visual language as the
// envelope mark (white fills, ink strokes) — only the flowers get color.
// Hand-placed, deterministic; motion is CSS-only and respects reduced-motion.

const INK = '#1d1c1a';
const POPPY = ['#d4553f', '#e06a52', '#b8432f'];

function Cloud({ x, y, s, dur }: { x: number; y: number; s: number; dur: number }) {
  return (
    <g
      className="scene-drift"
      style={{ animationDuration: `${dur}s` }}
      transform={`translate(${x} ${y}) scale(${s})`}
    >
      <path
        d="M0 24 a14 14 0 0 1 14-14 a16 16 0 0 1 30-6 a13 13 0 0 1 22 10 a11 11 0 0 1 -2 22 h-52 a12 12 0 0 1 -12-12 z"
        fill="#fff"
        stroke={INK}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
    </g>
  );
}

function Tree({ x, y, s = 1, twin = false }: { x: number; y: number; s?: number; twin?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <line x1="0" y1="0" x2="0" y2="-34" stroke={INK} strokeWidth="2.5" />
      <line x1="0" y1="-16" x2="9" y2="-24" stroke={INK} strokeWidth="2" />
      <circle cx="0" cy="-52" r="22" fill="#fff" stroke={INK} strokeWidth="2.5" />
      {twin && <circle cx="17" cy="-40" r="14" fill="#fff" stroke={INK} strokeWidth="2.5" />}
    </g>
  );
}

function Tuft({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g
      transform={`translate(${x} ${y}) scale(${s})`}
      fill="none"
      stroke={INK}
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M0 0 C -2 -5 -6 -8 -10 -10" />
      <path d="M0 0 C -1 -7 -2 -12 -4 -16" />
      <path d="M0 0 C 1 -8 1 -13 0 -18" />
      <path d="M0 0 C 2 -6 5 -10 8 -14" />
      <path d="M0 0 C 3 -4 7 -6 11 -7" />
    </g>
  );
}

function Flower({
  x,
  y,
  h,
  c,
  delay,
}: {
  x: number;
  y: number;
  h: number;
  c: number;
  delay: number;
}) {
  const color = POPPY[c % POPPY.length];
  const petals = [0, 72, 144, 216, 288];
  return (
    <g
      className="scene-sway"
      style={{ transformOrigin: `${x}px ${y}px`, animationDelay: `${delay}s` }}
    >
      <path
        d={`M${x} ${y} C ${x + 2} ${y - h * 0.4} ${x - 2} ${y - h * 0.7} ${x} ${y - h}`}
        fill="none"
        stroke={INK}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d={`M${x} ${y - h * 0.45} C ${x + 5} ${y - h * 0.5} ${x + 8} ${y - h * 0.55} ${x + 10} ${y - h * 0.62}`}
        fill="none"
        stroke={INK}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <g transform={`translate(${x} ${y - h})`}>
        {petals.map((a) => (
          <ellipse
            key={a}
            cx="0"
            cy="-7"
            rx="4.2"
            ry="7"
            transform={`rotate(${a})`}
            fill={color}
            stroke={INK}
            strokeWidth="1.4"
          />
        ))}
        <circle r="3.2" fill="#fff" stroke={INK} strokeWidth="1.6" />
      </g>
    </g>
  );
}

// One control point list per hill so the stroked crest and the filled body
// always agree.
const BACK_HILL = 'M-10 305 C 240 258, 480 264, 720 284 C 960 304, 1200 268, 1450 292';
const FRONT_HILL = 'M-10 372 C 300 326, 560 340, 820 356 C 1080 372, 1260 344, 1450 358';

const FLOWERS: [number, number, number, number][] = [
  // x, y, height, color index — loosely clustered like real wildflowers
  [96, 452, 46, 0],
  [128, 460, 56, 1],
  [152, 455, 38, 2],
  [330, 442, 50, 1],
  [362, 450, 40, 0],
  [508, 436, 54, 2],
  [534, 446, 42, 0],
  [562, 440, 34, 1],
  [716, 430, 48, 0],
  [748, 438, 38, 2],
  [912, 424, 52, 1],
  [944, 432, 42, 0],
  [972, 428, 34, 2],
  [1128, 418, 48, 0],
  [1160, 426, 40, 1],
  [1312, 412, 54, 2],
  [1344, 420, 44, 0],
  [1388, 416, 36, 1],
];

const TUFTS: [number, number, number][] = [
  [60, 448, 1.2],
  [210, 452, 1],
  [286, 328, 0.8],
  [420, 446, 1.1],
  [472, 336, 0.7],
  [640, 434, 1],
  [808, 356, 0.8],
  [850, 430, 1.2],
  [1044, 424, 1],
  [1096, 352, 0.7],
  [1240, 420, 1.1],
  [1420, 414, 1],
];

export default function FrontScene() {
  return (
    <div className="front-scene" aria-hidden="true">
      <svg viewBox="0 0 1440 480" preserveAspectRatio="xMidYMax slice">
        <Cloud x={180} y={36} s={1.25} dur={26} />
        <Cloud x={1130} y={58} s={1} dur={22} />

        {/* back hill */}
        <path d={`${BACK_HILL} L 1450 480 L -10 480 Z`} fill="#fbfaf7" />
        <path d={BACK_HILL} fill="none" stroke={INK} strokeWidth="2.5" />
        <Tree x={150} y={292} s={1.1} twin />
        <Tree x={268} y={284} s={0.7} />
        <Tree x={598} y={278} s={0.85} />
        <Tree x={1176} y={276} s={1} twin />
        <Tree x={1298} y={282} s={0.65} />

        {/* front hill */}
        <path d={`${FRONT_HILL} L 1450 480 L -10 480 Z`} fill="#ffffff" />
        <path d={FRONT_HILL} fill="none" stroke={INK} strokeWidth="2.5" />

        {TUFTS.map(([x, y, s]) => (
          <Tuft key={`${x}-${y}`} x={x} y={y} s={s} />
        ))}
        {FLOWERS.map(([x, y, h, c], i) => (
          <Flower key={`${x}-${y}`} x={x} y={y} h={h} c={c} delay={-(i * 0.7)} />
        ))}
      </svg>
    </div>
  );
}
