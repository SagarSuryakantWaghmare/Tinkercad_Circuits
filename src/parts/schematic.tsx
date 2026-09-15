import type { ComponentType } from 'react';
import type { ArtProps } from './types';
import { LED_COLORS } from '@/lib/tokens';

/**
 * Schematic symbols.
 *
 * Drawn in the same world-unit space as the top view so a part occupies the
 * same footprint and its terminals stay where the wires already meet them —
 * switching views must never move a connection.
 */

const INK = '#1F2937';
const SW = 2.2;

const line = (x1: number, y1: number, x2: number, y2: number, key?: string) => (
  <line key={key} x1={x1} y1={y1} x2={x2} y2={y2} stroke={INK} strokeWidth={SW} strokeLinecap="round" />
);

function Label({ x, y, text, size = 9 }: { x: number; y: number; text: string; size?: number }) {
  return (
    <text
      x={x}
      y={y}
      fontSize={size}
      fontFamily="ui-sans-serif, system-ui, sans-serif"
      fontWeight={600}
      fill="#4B5563"
      textAnchor="middle"
      dominantBaseline="central"
      style={{ pointerEvents: 'none', userSelect: 'none' }}
    >
      {text}
    </text>
  );
}

/** Format an SI value for a schematic annotation. */
function si(value: number, unit: string) {
  const v = Math.abs(value);
  if (v >= 1e6) return `${trim(value / 1e6)}M${unit}`;
  if (v >= 1e3) return `${trim(value / 1e3)}k${unit}`;
  if (v >= 1) return `${trim(value)}${unit}`;
  if (v >= 1e-3) return `${trim(value * 1e3)}m${unit}`;
  if (v >= 1e-6) return `${trim(value * 1e6)}µ${unit}`;
  if (v >= 1e-9) return `${trim(value * 1e9)}n${unit}`;
  return `${trim(value * 1e12)}p${unit}`;
}
const trim = (n: number) => String(Math.round(n * 100) / 100);

// ─── Passives ────────────────────────────────────────────────────────────────

const Resistor: ComponentType<ArtProps> = ({ props }) => (
  <g>
    {line(-30, 0, -16, 0)}
    <path
      d="M-16,0 l4,-8 l6,16 l6,-16 l6,16 l6,-16 l4,8"
      fill="none"
      stroke={INK}
      strokeWidth={SW}
      strokeLinejoin="round"
    />
    {line(16, 0, 30, 0)}
    <Label x={0} y={-16} text={si(Number(props.resistance ?? 220), 'Ω')} />
  </g>
);

const Capacitor: ComponentType<ArtProps> = ({ props }) => (
  <g>
    {line(-5, 12, -5, 3)}
    {line(5, 12, 5, 3)}
    {line(-14, 3, 14, 3)}
    {line(-14, -3, 14, -3)}
    {line(-5, -3, -5, -12)}
    {line(5, -3, 5, -12)}
    <Label x={0} y={-20} text={si(Number(props.capacitance ?? 1e-7), 'F')} />
  </g>
);

const CapacitorPolarised: ComponentType<ArtProps> = ({ props }) => (
  <g>
    {line(-5, 14, -5, 4)}
    {line(5, 14, 5, 4)}
    {line(-14, 4, 14, 4)}
    <path d="M-14,-4 A16,16 0 0,0 14,-4" fill="none" stroke={INK} strokeWidth={SW} />
    {line(-5, -4, -5, -14)}
    {line(5, -4, 5, -14)}
    <Label x={-18} y={-10} text="+" size={11} />
    <Label x={0} y={-22} text={si(Number(props.capacitance ?? 1e-5), 'F')} />
  </g>
);

const Inductor: ComponentType<ArtProps> = ({ props }) => (
  <g>
    {line(-30, 0, -18, 0)}
    {[-13.5, -4.5, 4.5, 13.5].map((x) => (
      <path key={x} d={`M${x - 4.5},0 A4.5,4.5 0 0,1 ${x + 4.5},0`} fill="none" stroke={INK} strokeWidth={SW} />
    ))}
    {line(18, 0, 30, 0)}
    <Label x={0} y={-14} text={si(Number(props.inductance ?? 1e-3), 'H')} />
  </g>
);

function diodeSymbol(extra?: 'zener' | 'schottky' | 'led') {
  const Sym: ComponentType<ArtProps> = ({ props }) => {
    const colour = extra === 'led' ? (LED_COLORS[String(props.color)] ?? LED_COLORS.red).glow : INK;
    return (
      <g>
        {line(-30, 0, -10, 0)}
        <path d="M-10,-10 L10,0 L-10,10 Z" fill={extra === 'led' ? colour : INK} stroke={INK} strokeWidth={SW} strokeLinejoin="round" />
        {line(10, -10, 10, 10)}
        {extra === 'zener' && <path d="M10,-10 l-6,-4 M10,10 l6,4" stroke={INK} strokeWidth={SW} fill="none" />}
        {extra === 'schottky' && (
          <path d="M10,-10 l-6,0 l0,-4 M10,10 l6,0 l0,4" stroke={INK} strokeWidth={SW} fill="none" />
        )}
        {line(10, 0, 30, 0)}
        {extra === 'led' && (
          <g stroke={INK} strokeWidth={1.6} fill="none">
            <path d="M2,-14 l8,-8 M8,-16 l2,-6 l-6,2" />
            <path d="M10,-10 l8,-8 M16,-12 l2,-6 l-6,2" />
          </g>
        )}
      </g>
    );
  };
  return Sym;
}

// ─── Sources ─────────────────────────────────────────────────────────────────

function batterySymbol(vertical: boolean): ComponentType<ArtProps> {
  const Sym: ComponentType<ArtProps> = ({ props }) => {
    const cells = Math.max(1, Number(props.cells ?? 1));
    const v = Number(props.voltage ?? 9) * (props.cells !== undefined ? cells : 1);
    const body = (
      <g>
        {[-9, 3].map((y) => (
          <g key={y}>
            <line x1={-16} y1={y} x2={16} y2={y} stroke={INK} strokeWidth={SW} />
            <line x1={-8} y1={y + 6} x2={8} y2={y + 6} stroke={INK} strokeWidth={SW} />
          </g>
        ))}
      </g>
    );
    return (
      <g transform={vertical ? 'rotate(90)' : undefined}>
        {body}
        <g transform={vertical ? 'rotate(-90)' : undefined}>
          <Label x={vertical ? 26 : 0} y={vertical ? -14 : -22} text={`${trim(v)} V`} />
        </g>
      </g>
    );
  };
  return Sym;
}

const Ground: ComponentType<ArtProps> = () => (
  <g>
    {line(0, -30, 0, 2)}
    {line(-16, 2, 16, 2)}
    {line(-10, 10, 10, 10)}
    {line(-4, 18, 4, 18)}
  </g>
);

const Vcc: ComponentType<ArtProps> = ({ props }) => (
  <g>
    {line(0, 30, 0, -6)}
    {line(-14, -6, 14, -6)}
    <Label x={0} y={-18} text={`${trim(Number(props.voltage ?? 5))} V`} />
  </g>
);

// ─── Switches ────────────────────────────────────────────────────────────────

const Pushbutton: ComponentType<ArtProps> = ({ state }) => {
  const down = !!state?.pressed;
  return (
    <g>
      {line(-15, -25, -15, -8)}
      {line(15, -25, 15, -8)}
      {line(-15, 25, -15, 8)}
      {line(15, 25, 15, 8)}
      {line(-20, -8, -10, -8)}
      {line(10, -8, 20, -8)}
      {line(-20, 8, -10, 8)}
      {line(10, 8, 20, 8)}
      {line(-18, down ? -2 : -6, 18, down ? -2 : -6)}
      {line(0, down ? -2 : -6, 0, -16)}
      <circle cx={0} cy={-19} r={4} fill="none" stroke={INK} strokeWidth={SW} />
    </g>
  );
};

const Slideswitch: ComponentType<ArtProps> = ({ state }) => {
  // 0 = left closed, 1 = centre OFF (wiper up), 2 = right closed.
  const p = Math.max(0, Math.min(2, Number(state?.position ?? 0)));
  const tipX = p === 0 ? -10 : p === 2 ? 10 : 0;
  const tipY = p === 1 ? -4 : 4;
  return (
    <g>
      {line(-10, 18, -10, 6)}
      {line(0, 18, 0, 8)}
      {line(10, 18, 10, 6)}
      <circle cx={-10} cy={4} r={2.6} fill={INK} />
      <circle cx={10} cy={4} r={2.6} fill={INK} />
      <circle cx={0} cy={10} r={2.6} fill={INK} />
      {line(0, 10, tipX, tipY)}
    </g>
  );
};

const Potentiometer: ComponentType<ArtProps> = ({ props }) => (
  <g transform="rotate(-90)">
    <path
      d="M-16,0 l4,-8 l6,16 l6,-16 l6,16 l6,-16 l4,8"
      fill="none"
      stroke={INK}
      strokeWidth={SW}
      strokeLinejoin="round"
    />
    {line(-30, 0, -16, 0)}
    {line(16, 0, 30, 0)}
    <path d="M0,-22 l0,10 M-5,-14 l5,4 l5,-4" fill="none" stroke={INK} strokeWidth={SW} />
    <g transform="rotate(90)">
      <Label x={22} y={0} text={si(Number(props.resistance ?? 10000), 'Ω')} />
    </g>
  </g>
);

// ─── Semiconductors ──────────────────────────────────────────────────────────

function bjtSymbol(npn: boolean): ComponentType<ArtProps> {
  const Sym: ComponentType<ArtProps> = () => (
    <g>
      {/* base bar and lead */}
      {line(-10, 24, -10, -10)}
      {line(-10, 7, -22, 7)}
      {/* collector / emitter */}
      {line(-10, 0, 10, -12)}
      {line(-10, 14, 10, 26)}
      {line(10, -12, 10, -22)}
      {line(10, 26, 10, 34)}
      {/* arrow on the emitter */}
      {npn ? (
        <path d="M2,20 l8,6 l-2,-8 Z" fill={INK} />
      ) : (
        <path d="M-2,10 l-8,-6 l2,8 Z" fill={INK} />
      )}
      <circle cx={0} cy={7} r={26} fill="none" stroke={INK} strokeWidth={1.4} opacity={0.5} />
    </g>
  );
  return Sym;
}

function mosfetSymbol(nch: boolean): ComponentType<ArtProps> {
  const Sym: ComponentType<ArtProps> = () => (
    <g>
      {line(-22, 7, -12, 7)}
      {line(-12, -6, -12, 20)}
      {[-4, 5, 14].map((y) => line(-6, y - 3, -6, y + 3, `g${y}`))}
      {line(-6, -4, 10, -4)}
      {line(-6, 18, 10, 18)}
      {line(-6, 7, 10, 7)}
      {line(10, -4, 10, -22)}
      {line(10, 18, 10, 34)}
      {line(10, 7, 10, 18)}
      {nch ? <path d="M2,7 l-8,-4 l0,8 Z" fill={INK} /> : <path d="M0,7 l8,-4 l0,8 Z" fill={INK} />}
    </g>
  );
  return Sym;
}

// ─── Loads and sensors ───────────────────────────────────────────────────────

const Motor: ComponentType<ArtProps> = () => (
  <g>
    <circle cx={0} cy={0} r={26} fill="none" stroke={INK} strokeWidth={SW} />
    <Label x={0} y={0} text="M" size={18} />
    {line(-70, -14, -26, -14)}
    {line(-70, 14, -26, 14)}
    {line(-26, -14, -26, -8)}
    {line(-26, 14, -26, 8)}
  </g>
);

const Buzzer: ComponentType<ArtProps> = () => (
  <g>
    <path d="M-18,-14 A18,18 0 0,1 18,-14 L18,0 L-18,0 Z" fill="none" stroke={INK} strokeWidth={SW} />
    {line(-18, 0, 18, 0)}
    {line(-10, 0, -10, 40)}
    {line(10, 0, 10, 40)}
  </g>
);

const Photoresistor: ComponentType<ArtProps> = () => (
  <g>
    {line(-5, 20, -5, 8)}
    {line(5, 20, 5, 8)}
    <rect x={-14} y={-6} width={28} height={14} fill="none" stroke={INK} strokeWidth={SW} />
    {line(-14, 8, -5, 8)}
    {line(14, 8, 5, 8)}
    <g stroke={INK} strokeWidth={1.6} fill="none">
      <path d="M-22,-22 l8,8 M-16,-24 l-6,2 l2,6" />
      <path d="M-12,-26 l8,8 M-6,-28 l-6,2 l2,6" />
    </g>
  </g>
);

const Thermistor: ComponentType<ArtProps> = () => (
  <g>
    {line(-5, 20, -5, 8)}
    {line(5, 20, 5, 8)}
    <rect x={-14} y={-8} width={28} height={16} fill="none" stroke={INK} strokeWidth={SW} />
    {line(-14, 8, -5, 8)}
    {line(14, 8, 5, 8)}
    <path d="M-22,12 l6,-8 l24,-14" fill="none" stroke={INK} strokeWidth={SW} />
    <Label x={0} y={-18} text="t°" />
  </g>
);

/**
 * Fallback: a labelled block with a stub at each terminal. It is what a
 * schematic does for any part that has no conventional symbol, and it keeps
 * the view usable for the whole catalogue rather than only the classics.
 */
export function BlockSymbol({
  name,
  terminals,
}: {
  name: string;
  terminals: { name: string; x: number; y: number }[];
}) {
  const xs = terminals.map((t) => t.x);
  const ys = terminals.map((t) => t.y);
  const minX = Math.min(...xs, -30);
  const maxX = Math.max(...xs, 30);
  const minY = Math.min(...ys, -20);
  const maxY = Math.max(...ys, 20);
  const pad = 16;

  return (
    <g>
      <rect
        x={minX + pad * 0.6}
        y={minY + pad * 0.6}
        width={maxX - minX - pad * 1.2}
        height={maxY - minY - pad * 1.2}
        rx={3}
        fill="#FFFFFF"
        stroke={INK}
        strokeWidth={SW}
      />
      {terminals.map((t) => {
        // Stub from the pin toward the body.
        const towardX = t.x < 0 ? t.x + pad * 0.6 : t.x > 0 ? t.x - pad * 0.6 : t.x;
        const towardY = t.y < 0 ? t.y + pad * 0.6 : t.y > 0 ? t.y - pad * 0.6 : t.y;
        const vertical = Math.abs(t.y) > Math.abs(t.x);
        return (
          <g key={t.name}>
            {vertical ? line(t.x, t.y, t.x, towardY) : line(t.x, t.y, towardX, t.y)}
            <circle cx={t.x} cy={t.y} r={2.2} fill={INK} />
          </g>
        );
      })}
      <Label x={(minX + maxX) / 2} y={(minY + maxY) / 2} text={name} size={9} />
    </g>
  );
}

/** Symbols keyed by part id. Anything absent falls back to a labelled block. */
export const SCHEMATIC_SYMBOLS: Record<string, ComponentType<ArtProps>> = {
  resistor: Resistor,
  trimpot: Potentiometer,
  potentiometer: Potentiometer,
  'slide-pot': Potentiometer,
  capacitor: Capacitor,
  'capacitor-electrolytic': CapacitorPolarised,
  inductor: Inductor,
  diode: diodeSymbol(),
  'diode-zener': diodeSymbol('zener'),
  'diode-schottky': diodeSymbol('schottky'),
  led: diodeSymbol('led'),
  'led-10mm': diodeSymbol('led'),
  'battery-9v': batterySymbol(true),
  'battery-aa': batterySymbol(false),
  'battery-aaa': batterySymbol(false),
  'battery-coin': batterySymbol(true),
  'battery-pack-4aa': batterySymbol(true),
  'gnd-symbol': Ground,
  'vcc-symbol': Vcc,
  pushbutton: Pushbutton,
  'pushbutton-12mm': Pushbutton,
  slideswitch: Slideswitch,
  'toggle-switch': Slideswitch,
  'npn-transistor': bjtSymbol(true),
  'pnp-transistor': bjtSymbol(false),
  tip120: bjtSymbol(true),
  tip125: bjtSymbol(false),
  'nmos-transistor': mosfetSymbol(true),
  'pmos-transistor': mosfetSymbol(false),
  irf520: mosfetSymbol(true),
  'dc-motor': Motor,
  gearmotor: Motor,
  'vibration-motor': Motor,
  piezo: Buzzer,
  speaker: Buzzer,
  photoresistor: Photoresistor,
  phototransistor: Photoresistor,
  photodiode: Photoresistor,
  thermistor: Thermistor,
};
