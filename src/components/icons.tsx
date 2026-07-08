interface IconProps {
  size?: number;
}

function svgProps(size: number) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.3,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  } as const;
}

export function IconInbox({ size = 16 }: IconProps) {
  return (
    <svg {...svgProps(size)}>
      <path d="M2 9.6 3.3 4a1 1 0 0 1 1-.8h7.4a1 1 0 0 1 1 .8L14 9.6V12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1z" />
      <path d="M2 9.6h3.4l.8 1.6h3.6l.8-1.6H14" />
    </svg>
  );
}

export function IconCheck({ size = 16 }: IconProps) {
  return (
    <svg {...svgProps(size)}>
      <circle cx="8" cy="8" r="6" />
      <path d="m5.5 8.2 1.8 1.8 3.2-3.6" />
    </svg>
  );
}

export function IconDraft({ size = 16 }: IconProps) {
  return (
    <svg {...svgProps(size)}>
      <path d="m11.6 2.6 1.8 1.8L7.2 10.6l-2.5.7.7-2.5z" />
      <path d="M13 8.7V12a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 12V4.5A1.5 1.5 0 0 1 4 3h3.3" />
    </svg>
  );
}

export function IconCompose({ size = 16 }: IconProps) {
  return (
    <svg {...svgProps(size)}>
      <path d="M13 8.7V12a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 12V4.5A1.5 1.5 0 0 1 4 3h3.3" />
      <path d="m12.4 1.8 1.8 1.8-6.4 6.5-2.5.7.7-2.5z" />
    </svg>
  );
}

export function IconTrash({ size = 16 }: IconProps) {
  return (
    <svg {...svgProps(size)}>
      <path d="M3 4.5h10" />
      <path d="M6.5 4.5V3a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1.5" />
      <path d="M4.8 4.5 5.5 13a1 1 0 0 0 1 .9h3a1 1 0 0 0 1-.9l.7-8.5" />
    </svg>
  );
}

export function IconClip({ size = 16 }: IconProps) {
  return (
    <svg {...svgProps(size)}>
      <path d="m12.9 7.4-4.6 4.7a3 3 0 0 1-4.3-4.3l5.3-5.3a2 2 0 0 1 2.9 2.9L7 10.5a1 1 0 0 1-1.5-1.4l4.3-4.4" />
    </svg>
  );
}
