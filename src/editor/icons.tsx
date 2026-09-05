import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement>;

const base = (p: P) => ({
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.9,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  ...p,
});

export const IconPlay = (p: P) => (
  <svg {...base(p)} fill="currentColor" stroke="none">
    <path d="M8 5.5v13l11-6.5z" />
  </svg>
);

export const IconKeyboard = (p: P) => (
  <svg {...base(p)}>
    <rect x="2.5" y="6" width="19" height="12" rx="2" />
    <path d="M6.5 9.5h.01M10 9.5h.01M13.5 9.5h.01M17 9.5h.01M8 14.5h8" />
  </svg>
);

export const IconStepOver = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 14a8 8 0 0 1 15-3.6" />
    <path d="M19 5v5.5h-5.5" />
    <circle cx="12" cy="18" r="1.8" fill="currentColor" stroke="none" />
  </svg>
);

export const IconMaximise = (p: P) => (
  <svg {...base(p)}>
    <path d="M9 4H4v5" />
    <path d="M15 20h5v-5" />
    <path d="M4 4l6 6" />
    <path d="M20 20l-6-6" />
  </svg>
);

export const IconMinimise = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 10h5V5" />
    <path d="M20 14h-5v5" />
    <path d="M9 10L3.5 4.5" />
    <path d="M15 14l5.5 5.5" />
  </svg>
);

export const IconStop = (p: P) => (
  <svg {...base(p)} fill="currentColor" stroke="none">
    <rect x="6" y="6" width="12" height="12" rx="1.5" />
  </svg>
);

export const IconCode = (p: P) => (
  <svg {...base(p)}>
    <path d="M9 8l-4 4 4 4M15 8l4 4-4 4" />
  </svg>
);

export const IconUndo = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 9h11a4.5 4.5 0 010 9h-6" />
    <path d="M7.5 5.5L4 9l3.5 3.5" />
  </svg>
);

export const IconRedo = (p: P) => (
  <svg {...base(p)}>
    <path d="M20 9H9a4.5 4.5 0 000 9h6" />
    <path d="M16.5 5.5L20 9l-3.5 3.5" />
  </svg>
);

export const IconRotate = (p: P) => (
  <svg {...base(p)}>
    <path d="M20 12a8 8 0 11-2.6-5.9" />
    <path d="M20 4v4h-4" />
  </svg>
);

export const IconMirror = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 3v18" strokeDasharray="3 3" />
    <path d="M9 7L4 12l5 5zM15 7l5 5-5 5z" />
  </svg>
);

export const IconTrash = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" />
    <path d="M10 11v6M14 11v6" />
  </svg>
);

export const IconNote = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 5h16v10H9l-5 4z" />
  </svg>
);

export const IconEye = (p: P) => (
  <svg {...base(p)}>
    <path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6z" />
    <circle cx="12" cy="12" r="2.6" />
  </svg>
);

export const IconEyeOff = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 3l18 18" />
    <path d="M10.6 6.2A9.6 9.6 0 0112 6c6.4 0 10 6 10 6a17 17 0 01-3.3 3.9M6.5 8.1A17 17 0 002 12s3.6 6 10 6a9.7 9.7 0 003.5-.6" />
  </svg>
);

export const IconFit = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
  </svg>
);

export const IconPlus = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const IconMinus = (p: P) => (
  <svg {...base(p)}>
    <path d="M5 12h14" />
  </svg>
);

export const IconSearch = (p: P) => (
  <svg {...base(p)}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M16 16l4.5 4.5" />
  </svg>
);

export const IconChevronDown = (p: P) => (
  <svg {...base(p)}>
    <path d="M6 9.5l6 6 6-6" />
  </svg>
);

export const IconChevronLeft = (p: P) => (
  <svg {...base(p)}>
    <path d="M14.5 6l-6 6 6 6" />
  </svg>
);

export const IconExport = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 15V4m0 0L8 8m4-4l4 4" />
    <path d="M4 15v3a2 2 0 002 2h12a2 2 0 002-2v-3" />
  </svg>
);

export const IconCopy = (p: P) => (
  <svg {...base(p)}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M15 5H6a2 2 0 00-2 2v9" />
  </svg>
);

export const IconLock = (p: P) => (
  <svg {...base(p)}>
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V8a4 4 0 018 0v3" />
  </svg>
);

export const IconWire = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 17c4 0 4-10 8-10s4 10 8 10" />
  </svg>
);

export const IconLayers = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 3l9 5-9 5-9-5 9-5z" />
    <path d="M3 13l9 5 9-5" />
  </svg>
);

export const IconChip = (p: P) => (
  <svg {...base(p)}>
    <rect x="7" y="7" width="10" height="10" rx="1.5" />
    <path d="M10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4" />
  </svg>
);

export const IconTerminalWindow = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M7 9l3 3-3 3M13 15h4" />
  </svg>
);

export const IconWarning = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 4l9 16H3l9-16z" />
    <path d="M12 10v4M12 17.2v.1" />
  </svg>
);
