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

// A "real" tree: forked trunk whose branch tips vanish into a lumpy canopy
// (canopy is drawn after the trunk, so its white fill swallows the branch ends).
const CANOPY =
  'M-32 -46 C -40 -60 -28 -72 -16 -70 C -12 -82 6 -84 14 -74 C 28 -78 40 -66 32 -54 C 40 -44 30 -34 18 -38 C 12 -28 -8 -26 -14 -34 C -26 -30 -36 -36 -32 -46 Z';

function Tree({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} strokeLinecap="round">
      <path d="M0 0 C 1 -10 -1 -22 0 -36" fill="none" stroke={INK} strokeWidth="3" />
      <path d="M0 -20 C -5 -27 -10 -32 -14 -40" fill="none" stroke={INK} strokeWidth="2.2" />
      <path d="M0 -27 C 4 -33 9 -38 12 -46" fill="none" stroke={INK} strokeWidth="2.2" />
      <path d={CANOPY} fill="#fff" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      <path
        d="M-10 -52 C -4 -58 6 -60 14 -56"
        fill="none"
        stroke={INK}
        strokeWidth="1.6"
        opacity="0.5"
      />
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

// A small flower-and-grass cluster for the margins of the sections below the
// hero, so the meadow runs the whole front page.
export function MeadowSprig({ flip = false }: { flip?: boolean }) {
  return (
    <svg
      className={flip ? 'sprig-svg flipped' : 'sprig-svg'}
      viewBox="0 0 90 96"
      aria-hidden="true"
    >
      <Flower x={30} y={92} h={44} c={0} delay={-2} />
      <Flower x={58} y={94} h={32} c={1} delay={-5} />
      <Tuft x={74} y={94} s={1.1} />
      <Tuft x={12} y={94} s={0.8} />
    </svg>
  );
}

// The closing field band at the very bottom of the front page.
export function MeadowStrip() {
  return (
    <div className="meadow-strip" aria-hidden="true">
      <svg viewBox="0 0 1440 190" preserveAspectRatio="xMidYMax slice">
        <path d="M-10 96 C 300 62, 640 76, 940 88 C 1160 96, 1300 78, 1450 86 L 1450 190 L -10 190 Z" fill="#fbfaf7" />
        <path
          d="M-10 96 C 300 62, 640 76, 940 88 C 1160 96, 1300 78, 1450 86"
          fill="none"
          stroke={INK}
          strokeWidth="2.5"
        />
        <Tree x={230} y={86} s={0.9} />
        <Tree x={1240} y={90} s={0.7} />
        <Tuft x={120} y={150} s={1.1} />
        <Tuft x={480} y={140} s={0.9} />
        <Tuft x={860} y={152} s={1.1} />
        <Tuft x={1360} y={144} s={0.9} />
        <Flower x={340} y={168} h={44} c={0} delay={-1} />
        <Flower x={372} y={174} h={34} c={2} delay={-4} />
        <Flower x={700} y={162} h={48} c={1} delay={-2.5} />
        <Flower x={1030} y={170} h={40} c={0} delay={-6} />
        <Flower x={1062} y={176} h={30} c={1} delay={-3} />
      </svg>
    </div>
  );
}

export default function FrontScene() {
  return (
    <div className="front-scene" aria-hidden="true">
      <svg viewBox="0 0 1440 480" preserveAspectRatio="xMidYMax slice">
        <Cloud x={180} y={36} s={1.25} dur={26} />
        <Cloud x={1130} y={58} s={1} dur={22} />

        {/* back hill */}
        <path d={`${BACK_HILL} L 1450 480 L -10 480 Z`} fill="#fbfaf7" />
        <path d={BACK_HILL} fill="none" stroke={INK} strokeWidth="2.5" />
        <Tree x={168} y={292} s={1.15} />
        <Tree x={296} y={286} s={0.65} />
        <Tree x={1190} y={276} s={1.05} />
        <Tree x={1330} y={284} s={0.6} />

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
