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

export function SlipMark({ size = 18 }: IconProps) {
  return (
    <svg {...svgProps(size)}>
      <path d="M5.5 7V3.6a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V7" />
      <rect x="1.8" y="7.2" width="12.4" height="6.3" rx="1.4" />
      <path d="m2.4 8.2 5.6 3 5.6-3" />
    </svg>
  );
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

export function IconGitHub({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 19 19" aria-hidden="true">
      <path
        fill="currentColor"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M9.356 1.85C5.05 1.85 1.57 5.356 1.57 9.694a7.84 7.84 0 0 0 5.324 7.44c.387.079.528-.168.528-.376 0-.182-.013-.805-.013-1.454-2.165.467-2.616-.935-2.616-.935-.349-.91-.864-1.143-.864-1.143-.71-.48.051-.48.051-.48.787.051 1.2.805 1.2.805.695 1.194 1.817.857 2.268.649.064-.507.27-.857.49-1.052-1.728-.182-3.545-.857-3.545-3.87 0-.857.31-1.558.8-2.104-.078-.195-.349-1 .077-2.078 0 0 .657-.208 2.14.805a7.5 7.5 0 0 1 1.946-.26c.657 0 1.328.092 1.946.26 1.483-1.013 2.14-.805 2.14-.805.426 1.078.155 1.883.078 2.078.502.546.799 1.247.799 2.104 0 3.013-1.818 3.675-3.558 3.87.284.247.528.714.528 1.454 0 1.052-.012 1.896-.012 2.156 0 .208.142.455.528.377a7.84 7.84 0 0 0 5.324-7.441c.013-4.338-3.48-7.844-7.773-7.844"
      />
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
