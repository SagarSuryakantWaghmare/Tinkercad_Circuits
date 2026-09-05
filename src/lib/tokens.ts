/**
 * Colour tokens. The hex values in the "measured" block were sampled from the
 * live product's rendered SVG so our art reads as the same family.
 */

export const C = {
  // canvas
  canvasBg: '#F4F5F6',
  gridDot: '#D8DBDF',

  // interaction
  select: '#3B8ED7',
  netHighlight: '#7FBF34',
  wireShadow: '#BFBFBF',
  hover: '#6BB0E8',

  // pcb / boards
  pcbBlue: '#316E99',
  pcbBlueDark: '#255A7D',
  silk: '#FFFFFF',
  headerDark: '#292C2D',
  headerMid: '#3C4042',
  headerHole: '#1C1C1C',
  solderPad: '#C8A24B',

  // breadboard
  bbBody: '#E6E6E6',
  bbBodyEdge: '#D6D6D6',
  bbRing: '#D1D1D1',
  bbRing2: '#BFBFBF',
  bbBore: '#383838',
  bbRailRed: '#C11F1F',
  bbRailBlue: '#2E63B8',
  bbLabel: '#8A8A8A',

  // generic part bodies
  bodyBeige: '#D9C9A3',
  bodyBlack: '#1F2123',
  bodyGrey: '#9B9B9B',
  metal: '#B9BDC2',
  metalDark: '#8A9096',
  lead: '#B0B4B8',

  // status
  warn: '#E3B341',
  danger: '#C11F1F',
  ok: '#3D9E36',
  smoke: '#5A5A5A',
} as const;

/** Wire colours, bound to number keys 0–9 exactly as the product does. */
export const WIRE_COLORS = [
  { key: '0', name: 'Black', hex: '#171919' },
  { key: '1', name: 'Red', hex: '#C11F1F' },
  { key: '2', name: 'Orange', hex: '#CC7A00' },
  { key: '3', name: 'Yellow', hex: '#E6C619' },
  { key: '4', name: 'Green', hex: '#3D9E36' },
  { key: '5', name: 'Blue', hex: '#2E63B8' },
  { key: '6', name: 'Violet', hex: '#7B3FB5' },
  { key: '7', name: 'Brown', hex: '#8A5A2B' },
  { key: '8', name: 'Grey', hex: '#9B9B9B' },
  { key: '9', name: 'White', hex: '#FFFFFF' },
] as const;

export type WireColorKey = (typeof WIRE_COLORS)[number]['key'];

export const wireHex = (k: string) =>
  WIRE_COLORS.find((c) => c.key === k)?.hex ?? WIRE_COLORS[0].hex;

/** Standard LED body/emission colours. */
export const LED_COLORS: Record<
  string,
  { body: string; lens: string; glow: string; vf: number }
> = {
  red: { body: '#E23B3B', lens: '#FF6B6B', glow: '#FF2D2D', vf: 1.8 },
  green: { body: '#3FBF4F', lens: '#77E886', glow: '#2BFF4A', vf: 2.1 },
  blue: { body: '#3F79D6', lens: '#7FAAF2', glow: '#3D8BFF', vf: 3.0 },
  yellow: { body: '#E3C93B', lens: '#FFF07A', glow: '#FFE92D', vf: 2.0 },
  white: { body: '#E8E8E8', lens: '#FFFFFF', glow: '#FFFFFF', vf: 3.1 },
  orange: { body: '#E3853B', lens: '#FFB877', glow: '#FF8A1F', vf: 2.0 },
  infrared: { body: '#5B3A6E', lens: '#8E6BA6', glow: '#A56BFF', vf: 1.4 },
};
