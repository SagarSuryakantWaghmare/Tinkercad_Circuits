import { definePart } from '../registry';
import type { ArtProps, PartDef } from '../types';
import { BoardShadow, Silk } from '../primitives';
import { PartButton, PartKnob } from '../simControls';

const CASE = '#E8B23A';
const CASE_EDGE = '#B8862A';
const LCD_BG = '#B7CBA4';
const LCD_INK = '#16240E';

/** Format a reading with an SI prefix and a fixed number of significant digits. */
function siFormat(value: number, unit: string): string {
  const v = Math.abs(value);
  if (!isFinite(v)) return `OL ${unit}`;
  if (v >= 1e6) return `${(value / 1e6).toFixed(2)} M${unit}`;
  if (v >= 1e3) return `${(value / 1e3).toFixed(2)} k${unit}`;
  if (v >= 1) return `${value.toFixed(2)} ${unit}`;
  if (v >= 1e-3) return `${(value * 1e3).toFixed(1)} m${unit}`;
  if (v >= 1e-6) return `${(value * 1e6).toFixed(1)} µ${unit}`;
  return `0.00 ${unit}`;
}

// ─── Multimeter ──────────────────────────────────────────────────────────────

interface MeterProps extends Record<string, string | number> {
  mode: string;
}

const MODE_UNIT: Record<string, string> = {
  voltage: 'V',
  current: 'A',
  resistance: 'Ω',
  continuity: 'Ω',
};

export const Multimeter = definePart<MeterProps>({
  id: 'multimeter',
  name: 'Multimeter',
  category: 'instruments',
  keywords: ['multimeter', 'dmm', 'voltmeter', 'ammeter', 'ohmmeter', 'measure', 'probe'],
  basic: true,
  size: { w: 200, h: 260 },
  origin: { x: 100, y: 118 },
  model: 'multimeter',
  terminals: [
    // Align the electrical terminal with the visible probe jack so a probe
    // wire lands on the socket instead of hovering below it.
    { name: 'positive', type: 'probe', x: -34, y: 92, dir: [0, 1], role: 'analog' },
    { name: 'negative', type: 'probe', x: 34, y: 92, dir: [0, 1], role: 'analog' },
  ],
  props: [
    {
      key: 'mode',
      label: 'Mode',
      kind: 'select',
      options: [
        { value: 'voltage', label: 'Voltmeter (V)' },
        { value: 'current', label: 'Ammeter (A)' },
        { value: 'resistance', label: 'Ohmmeter (Ω)' },
        { value: 'continuity', label: 'Continuity' },
      ],
    },
  ],
  defaults: { mode: 'voltage' },
  Art: ({ props, state, setProp }: ArtProps<MeterProps>) => {
    const mode = String(props.mode);
    const unit = MODE_UNIT[mode] ?? 'V';
    const reading = Number(state?.reading ?? 0);
    const angle = { voltage: -60, current: -20, resistance: 20, continuity: 60 }[mode] ?? 0;
    return (
      <g>
        <BoardShadow w={180} h={230} rx={10} />
        <rect x={-90} y={-115} width={180} height={230} rx={10} fill={CASE} stroke={CASE_EDGE} strokeWidth={2} />
        <rect x={-80} y={-105} width={160} height={62} rx={4} fill={LCD_BG} stroke="#8FA37E" />
        <text
          x={72}
          y={-74}
          fontSize={26}
          fontFamily="var(--font-geist-mono), ui-monospace, monospace"
          fontWeight={700}
          fill={LCD_INK}
          textAnchor="end"
          dominantBaseline="central"
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          {state ? siFormat(reading, unit) : `--- ${unit}`}
        </text>
        <Silk x={-70} y={-95} size={8} fill="#3F5233" anchor="start" weight={700}>
          {mode === 'continuity' ? 'CONT' : mode.toUpperCase()}
        </Silk>
        {state?.beep ? (
          <Silk x={70} y={-95} size={8} fill="#8B2F2F" anchor="end" weight={700}>
            BEEP
          </Silk>
        ) : null}

        {/* rotary mode dial, which follows the range buttons */}
        <circle cx={0} cy={18} r={32} fill="#2B2E31" stroke="#17191B" strokeWidth={2} />
        <circle cx={0} cy={18} r={24} fill="#3A3D41" />
        <g transform={`rotate(${angle} 0 18)`}>
          <rect x={-4} y={-4} width={8} height={24} rx={3} fill="#E8EAEC" />
        </g>

        {/*
          Range buttons on the meter face. The reference product puts these on
          the instrument rather than in a panel, and the choice has to persist
          with the design, so they write the property rather than sim state.
        */}
        {[
          { key: 'voltage', label: 'V', x: -57 },
          { key: 'current', label: 'A', x: -19 },
          { key: 'resistance', label: '\u03a9', x: 19 },
          { key: 'continuity', label: '\u2022)))', x: 57 },
        ].map((b) => (
          <PartButton
            key={b.key}
            x={b.x}
            y={-30}
            width={34}
            height={18}
            label={b.label}
            active={mode === b.key}
            onPress={() => setProp?.('mode', b.key)}
            activeColor="#8B5E12"
          />
        ))}

        {/* probe jacks */}
        <circle cx={-34} cy={92} r={11} fill="#C11F1F" stroke="#8E1616" strokeWidth={2} />
        <circle cx={-34} cy={92} r={5} fill="#5A0F0F" />
        <circle cx={34} cy={92} r={11} fill="#1F2123" stroke="#0E1011" strokeWidth={2} />
        <circle cx={34} cy={92} r={5} fill="#000" />
        <Silk x={-34} y={108} size={7} fill="#5A4415" weight={700}>+</Silk>
        <Silk x={34} y={108} size={9} fill="#5A4415" weight={700}>−</Silk>
      </g>
    );
  },
});

// ─── Bench power supply ──────────────────────────────────────────────────────

interface PsuProps extends Record<string, string | number> {
  voltage: number;
  currentLimit: number;
}

export const PowerSupply = definePart<PsuProps>({
  id: 'power-supply',
  name: 'Power Supply',
  category: 'instruments',
  keywords: ['power supply', 'psu', 'bench', 'variable', 'dc source', 'lab'],
  basic: true,
  size: { w: 260, h: 160 },
  origin: { x: 130, y: 76 },
  model: 'power-supply',
  terminals: [
    { name: '+', type: 'probe', x: 66, y: 46, dir: [0, 1], role: 'power' },
    { name: '-', type: 'probe', x: 106, y: 46, dir: [0, 1], role: 'gnd' },
  ],
  props: [
    { key: 'voltage', label: 'Voltage', kind: 'number', unit: 'V', min: 0, max: 30, step: 0.1 },
    { key: 'currentLimit', label: 'Current limit', kind: 'number', unit: 'A', min: 0.01, max: 5, step: 0.01 },
  ],
  defaults: { voltage: 5, currentLimit: 1 },
  Art: ({ props, state, setProp }: ArtProps<PsuProps>) => (
    <g>
      <BoardShadow w={244} h={132} rx={6} />
      <rect x={-122} y={-66} width={244} height={132} rx={6} fill="#E4E6E9" stroke="#B6BBC1" strokeWidth={2} />
      <rect x={-122} y={-66} width={244} height={20} rx={6} fill="#CDD2D7" />
      <Silk x={-108} y={-56} size={8} anchor="start" fill="#5A6068" weight={700}>
        DC POWER SUPPLY
      </Silk>

      {[
        { x: -60, label: 'VOLTS', value: state ? Number(state.voltage ?? 0).toFixed(2) : Number(props.voltage).toFixed(2), unit: 'V' },
        { x: 24, label: 'AMPS', value: state ? Number(state.current ?? 0).toFixed(3) : '0.000', unit: 'A' },
      ].map((d) => (
        <g key={d.label}>
          <rect x={d.x - 42} y={-38} width={84} height={40} rx={3} fill="#1B2419" stroke="#0D120C" />
          <text
            x={d.x + 34}
            y={-18}
            fontSize={20}
            fontFamily="var(--font-geist-mono), ui-monospace, monospace"
            fontWeight={700}
            fill="#FF5B3A"
            textAnchor="end"
            dominantBaseline="central"
            style={{ pointerEvents: 'none', userSelect: 'none' }}
          >
            {d.value}
          </text>
          <Silk x={d.x - 34} y={-30} size={6} anchor="start" fill="#7B8F72" weight={600}>
            {d.label}
          </Silk>
        </g>
      ))}

      {state?.limiting ? (
        <Silk x={-60} y={12} size={8} fill="#C11F1F" weight={700}>
          C.C. LIMIT
        </Silk>
      ) : (
        <Silk x={-60} y={12} size={8} fill="#3D9E36" weight={700}>
          C.V.
        </Silk>
      )}

      {/* knobs — turning them sets the supply, as on a bench unit */}
      <PartKnob
        x={-60}
        y={38}
        value={Number(props.voltage)}
        min={0}
        max={30}
        label="VOLTAGE"
        onChange={(v) => setProp?.('voltage', Math.round(v * 10) / 10)}
      />
      <PartKnob
        x={24}
        y={38}
        value={Number(props.currentLimit)}
        min={0.01}
        max={5}
        label="CURRENT"
        onChange={(v) => setProp?.('currentLimit', Math.round(v * 100) / 100)}
      />

      {/* binding posts */}
      <circle cx={66} cy={46} r={12} fill="#C11F1F" stroke="#8E1616" strokeWidth={2} />
      <circle cx={106} cy={46} r={12} fill="#1F2123" stroke="#0E1011" strokeWidth={2} />
      <Silk x={66} y={64} size={9} fill="#5A6068" weight={700}>+</Silk>
      <Silk x={106} y={64} size={11} fill="#5A6068" weight={700}>−</Silk>
    </g>
  ),
});

// ─── Function generator ──────────────────────────────────────────────────────

interface FgProps extends Record<string, string | number> {
  wave: string;
  amplitude: number;
  frequency: number;
  offset: number;
}

const WAVE_PATHS: Record<string, string> = {
  sine: 'M-26,0 q6.5,-16 13,0 t13,0 t13,0',
  square: 'M-26,10 L-26,-10 L-13,-10 L-13,10 L0,10 L0,-10 L13,-10 L13,10 L26,10',
  triangle: 'M-26,10 L-19.5,-10 L-6.5,10 L6.5,-10 L19.5,10 L26,0',
  sawtooth: 'M-26,10 L-13,-10 L-13,10 L0,-10 L0,10 L13,-10 L13,10 L26,-10',
};

export const FunctionGenerator = definePart<FgProps>({
  id: 'function-generator',
  name: 'Function Generator',
  category: 'instruments',
  keywords: ['function generator', 'signal', 'sine', 'square', 'waveform', 'oscillator'],
  size: { w: 260, h: 170 },
  origin: { x: 130, y: 80 },
  model: 'function-generator',
  terminals: [
    { name: 'positive', type: 'probe', x: 70, y: 52, dir: [0, 1] },
    { name: 'negative', type: 'probe', x: 106, y: 52, dir: [0, 1], role: 'gnd' },
  ],
  props: [
    {
      key: 'wave',
      label: 'Waveform',
      kind: 'select',
      options: [
        { value: 'sine', label: 'Sine' },
        { value: 'square', label: 'Square' },
        { value: 'triangle', label: 'Triangle' },
        { value: 'sawtooth', label: 'Sawtooth' },
      ],
    },
    { key: 'frequency', label: 'Frequency', kind: 'number', unit: 'Hz', min: 0.1, max: 100000, step: 0.1 },
    { key: 'amplitude', label: 'Amplitude', kind: 'number', unit: 'V', min: 0, max: 20, step: 0.1 },
    { key: 'offset', label: 'DC offset', kind: 'number', unit: 'V', min: -20, max: 20, step: 0.1 },
  ],
  defaults: { wave: 'sine', frequency: 100, amplitude: 5, offset: 0 },
  Art: ({ props, state, setProp }: ArtProps<FgProps>) => (
    <g>
      <BoardShadow w={244} h={142} rx={6} />
      <rect x={-122} y={-71} width={244} height={142} rx={6} fill="#E4E6E9" stroke="#B6BBC1" strokeWidth={2} />
      <rect x={-122} y={-71} width={244} height={20} rx={6} fill="#CDD2D7" />
      <Silk x={-108} y={-61} size={8} anchor="start" fill="#5A6068" weight={700}>
        FUNCTION GENERATOR
      </Silk>

      <rect x={-108} y={-42} width={128} height={56} rx={3} fill="#1B2419" stroke="#0D120C" />
      <Silk x={-44} y={-33} size={6} fill="#7B8F72" weight={600}>
        {`${Number(props.amplitude).toFixed(1)} Vp  ·  ${Number(props.offset).toFixed(1)} V DC`}
      </Silk>
      <g transform="translate(-44,-16)" stroke="#4ADE80" strokeWidth={2.2} fill="none" strokeLinejoin="round">
        <path d={WAVE_PATHS[String(props.wave)] ?? WAVE_PATHS.sine} />
      </g>
      <text
        x={-44}
        y={4}
        fontSize={13}
        fontFamily="var(--font-geist-mono), ui-monospace, monospace"
        fontWeight={700}
        fill="#4ADE80"
        textAnchor="middle"
        dominantBaseline="central"
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        {formatHz(Number(props.frequency))}
      </text>
      {state && (
        <Silk x={-44} y={23} size={8} fill="#4ADE80" weight={700}>
          {`${Number(state.voltage ?? 0).toFixed(2)} V now`}
        </Silk>
      )}

      {/* wave selector tabs in a row above knobs */}
      {(['sine', 'square', 'triangle', 'sawtooth'] as const).map((wave, i) => (
        <PartButton
          key={wave}
          x={35 + i * 24}
          y={-34}
          width={22}
          height={18}
          label={{ sine: '\u223f', square: '\u2293', triangle: '\u2227', sawtooth: '\u2571' }[wave]}
          active={String(props.wave) === wave}
          onPress={() => setProp?.('wave', wave)}
        />
      ))}
      <PartKnob
        x={46}
        y={2}
        r={13}
        value={Math.log10(Math.max(0.1, Number(props.frequency)))}
        min={-1}
        max={5}
        label="FREQ"
        onChange={(v) => setProp?.('frequency', Math.round(Math.pow(10, v) * 10) / 10)}
      />
      <PartKnob
        x={94}
        y={2}
        r={13}
        value={Number(props.amplitude)}
        min={0}
        max={20}
        label="AMPL"
        onChange={(v) => setProp?.('amplitude', Math.round(v * 10) / 10)}
      />

      <circle cx={70} cy={52} r={12} fill="#C11F1F" stroke="#8E1616" strokeWidth={2} />
      <circle cx={106} cy={52} r={12} fill="#1F2123" stroke="#0E1011" strokeWidth={2} />
      <Silk x={70} y={35} size={8} fill="#5A6068" weight={700}>SIG</Silk>
      <Silk x={106} y={35} size={8} fill="#5A6068" weight={700}>GND</Silk>
    </g>
  ),
});

function formatHz(hz: number) {
  if (hz >= 1e6) return `${(hz / 1e6).toFixed(2)} MHz`;
  if (hz >= 1e3) return `${(hz / 1e3).toFixed(2)} kHz`;
  return `${hz.toFixed(1)} Hz`;
}

// ─── Oscilloscope ────────────────────────────────────────────────────────────

interface ScopeProps extends Record<string, string | number> {
  timePerDiv: number;
  voltsPerDiv: number;
}

const TIME_DIVS = [1e-5, 5e-5, 1e-4, 5e-4, 1e-3, 5e-3, 1e-2, 5e-2, 0.1, 0.5];
const VOLT_DIVS = [0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10];

export const Oscilloscope = definePart<ScopeProps>({
  id: 'oscilloscope',
  name: 'Oscilloscope',
  category: 'instruments',
  keywords: ['oscilloscope', 'scope', 'waveform', 'trace', 'measure', 'signal'],
  basic: true,
  size: { w: 340, h: 260 },
  origin: { x: 170, y: 120 },
  model: 'oscilloscope',
  terminals: [
    { name: 'CH1+', type: 'probe', x: -80, y: 92, dir: [0, 1] },
    { name: 'CH1-', type: 'probe', x: -44, y: 92, dir: [0, 1], role: 'gnd' },
    { name: 'CH2+', type: 'probe', x: 44, y: 92, dir: [0, 1] },
    { name: 'CH2-', type: 'probe', x: 80, y: 92, dir: [0, 1], role: 'gnd' },
  ],
  props: [
    {
      key: 'timePerDiv',
      label: 'Time / division',
      kind: 'select',
      options: TIME_DIVS.map((v) => ({ value: String(v), label: formatTime(v) })),
    },
    {
      key: 'voltsPerDiv',
      label: 'Volts / division',
      kind: 'select',
      options: VOLT_DIVS.map((v) => ({ value: String(v), label: `${v} V` })),
    },
  ],
  defaults: { timePerDiv: 1e-3, voltsPerDiv: 1 },
  Art: ({ props, state, setProp }: ArtProps<ScopeProps>) => {
    const W = 260;
    const H = 120;
    const vdiv = Number(props.voltsPerDiv) || 1;
    const ch1 = (state?.ch1 as number[] | undefined) ?? [];
    const ch2 = (state?.ch2 as number[] | undefined) ?? [];
    // How much of the graticule the captured samples are entitled to. Drawing
    // a part-window across the full width would put the time axis out by
    // whatever fraction was missing.
    const fill = Math.max(0, Math.min(1, Number(state?.fill ?? 1)));

    const trace = (samples: number[]) => {
      if (samples.length < 2) return '';
      const parts: string[] = [];
      let pen = false;
      for (let i = 0; i < samples.length; i++) {
        const v = samples[i];
        if (!Number.isFinite(v)) {
          // Lift the pen across gaps so a floating probe doesn't stripe the
          // grid with junk lines through zero.
          pen = false;
          continue;
        }
        const x = -W / 2 + (i / (samples.length - 1)) * W * fill;
        const y = clamp(-(v / vdiv) * (H / 8), -H / 2, H / 2);
        if (!Number.isFinite(y)) {
          pen = false;
          continue;
        }
        parts.push(`${pen ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`);
        pen = true;
      }
      return parts.join(' ');
    };

    return (
      <g>
        <BoardShadow w={324} h={236} rx={6} />
        <rect x={-162} y={-118} width={324} height={236} rx={6} fill="#E4E6E9" stroke="#B6BBC1" strokeWidth={2} />
        <rect x={-162} y={-118} width={324} height={20} rx={6} fill="#CDD2D7" />
        <Silk x={-148} y={-108} size={8} anchor="start" fill="#5A6068" weight={700}>
          OSCILLOSCOPE
        </Silk>

        {/* screen */}
        <rect x={-W / 2 - 6} y={-92} width={W + 12} height={H + 12} rx={3} fill="#0C1410" stroke="#0A0D0B" />
        <g transform={`translate(0,${-26})`}>
          {/* graticule */}
          {Array.from({ length: 11 }, (_, i) => (
            <line
              key={`v${i}`}
              x1={-W / 2 + (i * W) / 10}
              y1={-H / 2}
              x2={-W / 2 + (i * W) / 10}
              y2={H / 2}
              stroke="#1E3A2A"
              strokeWidth={i === 5 ? 1.2 : 0.6}
            />
          ))}
          {Array.from({ length: 9 }, (_, i) => (
            <line
              key={`h${i}`}
              x1={-W / 2}
              y1={-H / 2 + (i * H) / 8}
              x2={W / 2}
              y2={-H / 2 + (i * H) / 8}
              stroke="#1E3A2A"
              strokeWidth={i === 4 ? 1.2 : 0.6}
            />
          ))}
          <path d={trace(ch1)} fill="none" stroke="#F5D033" strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
          <path d={trace(ch2)} fill="none" stroke="#3FC5F0" strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
          <Silk x={-W / 2 + 6} y={-H / 2 + 8} size={7} anchor="start" fill="#F5D033" weight={700}>
            {state ? `CH1 ${Number(state.vpp1 ?? 0).toFixed(2)} Vpp` : 'CH1'}
          </Silk>
          <Silk x={-W / 2 + 6} y={-H / 2 + 18} size={7} anchor="start" fill="#3FC5F0" weight={700}>
            {state ? `CH2 ${Number(state.vpp2 ?? 0).toFixed(2)} Vpp` : 'CH2'}
          </Silk>
          <Silk x={W / 2 - 6} y={H / 2 - 8} size={7} anchor="end" fill="#7B8F72" weight={600}>
            {`${formatTime(Number(props.timePerDiv))}/div · ${vdiv} V/div`}
          </Silk>
        </g>

        {/* knobs step through the standard division settings */}
        <PartKnob
          x={-122}
          y={72}
          r={13}
          value={Math.max(0, TIME_DIVS.indexOf(Number(props.timePerDiv)))}
          min={0}
          max={TIME_DIVS.length - 1}
          label="TIME/DIV"
          onChange={(v) =>
            setProp?.('timePerDiv', TIME_DIVS[Math.round(Math.max(0, Math.min(TIME_DIVS.length - 1, v)))])
          }
        />
        <PartKnob
          x={0}
          y={72}
          r={13}
          value={Math.max(0, VOLT_DIVS.indexOf(vdiv))}
          min={0}
          max={VOLT_DIVS.length - 1}
          label="VOLTS/DIV"
          onChange={(v) =>
            setProp?.('voltsPerDiv', VOLT_DIVS[Math.round(Math.max(0, Math.min(VOLT_DIVS.length - 1, v)))])
          }
        />
        {[
          { x: -80, c: '#F5D033', l: 'CH1' },
          { x: -44, c: '#1F2123', l: 'GND' },
          { x: 44, c: '#3FC5F0', l: 'CH2' },
          { x: 80, c: '#1F2123', l: 'GND' },
        ].map((p) => (
          <g key={p.x}>
            <Silk x={p.x} y={74} size={6.5} fill="#5A6068" weight={700}>
              {p.l}
            </Silk>
            <circle cx={p.x} cy={92} r={10} fill={p.c} stroke="#6E7479" strokeWidth={1.5} />
            <circle cx={p.x} cy={92} r={4.5} fill="#2B2E31" />
          </g>
        ))}
      </g>
    );
  },
});

function formatTime(s: number) {
  if (s >= 1) return `${s} s`;
  if (s >= 1e-3) return `${(s * 1e3).toFixed(s * 1e3 < 10 ? 1 : 0)} ms`;
  return `${(s * 1e6).toFixed(0)} µs`;
}

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

export const INSTRUMENTS: PartDef<never>[] = [
  Multimeter,
  PowerSupply,
  FunctionGenerator,
  Oscilloscope,
] as unknown as PartDef<never>[];
