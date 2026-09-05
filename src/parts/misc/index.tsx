import { definePart } from '../registry';
import type { ArtProps, PartDef, TerminalDef } from '../types';
import { C } from '@/lib/tokens';
import { BoardShadow, HeaderStrip, Leg, Silk } from '../primitives';

// ─── Connectors ──────────────────────────────────────────────────────────────

function header(id: string, name: string, count: number, male: boolean, keywords: string[]) {
  const w = count * 10 + 6;
  return definePart({
    id,
    name,
    category: 'connectors',
    keywords,
    size: { w: w + 10, h: 44 },
    origin: { x: (w + 10) / 2, y: 22 },
    socketable: true,
    rotationStep: 90,
    // Each pin is its own net; a header is just a mechanical pass-through, so
    // top and bottom of one position share a group.
    terminals: Array.from({ length: count }, (_, i) => [
      {
        name: `P${i + 1}`,
        type: (male ? 'breadboard_male' : 'breadboard_female') as TerminalDef['type'],
        x: -((count - 1) * 10) / 2 + i * 10,
        y: 14,
        dir: [0, 1] as [number, number],
        group: `p${i + 1}`,
      },
      {
        name: `T${i + 1}`,
        type: 'wire' as TerminalDef['type'],
        x: -((count - 1) * 10) / 2 + i * 10,
        y: -14,
        dir: [0, -1] as [number, number],
        group: `p${i + 1}`,
      },
    ]).flat(),
    props: [],
    defaults: {},
    Art: () => (
      <g>
        <HeaderStrip
          x={-((count - 1) * 10) / 2}
          y={0}
          count={count}
          male={male}
        />
      </g>
    ),
  });
}

export const Header8Male = header('header-8-male', '8-pin Header (male)', 8, true, [
  'header',
  'pin header',
  'male',
  'connector',
]);
export const Header8Female = header('header-8-female', '8-pin Header (female)', 8, false, [
  'header',
  'socket',
  'female',
  'connector',
]);
export const Header40 = header('header-40', '40-pin Header', 40, true, [
  'header',
  'gpio',
  'connector',
  '40 pin',
]);

export const UsbConnector = definePart({
  id: 'usb-connector',
  name: 'USB Connector',
  category: 'connectors',
  keywords: ['usb', 'connector', 'type b', 'power', 'data'],
  size: { w: 110, h: 90 },
  origin: { x: 55, y: 45 },
  model: 'battery',
  terminals: [
    { name: 'VBUS', type: 'wire', x: -15, y: 40, dir: [0, 1], role: 'power' },
    { name: 'D-', type: 'wire', x: -5, y: 40, dir: [0, 1] },
    { name: 'D+', type: 'wire', x: 5, y: 40, dir: [0, 1] },
    { name: 'GND', type: 'wire', x: 15, y: 40, dir: [0, 1], role: 'gnd' },
  ],
  props: [],
  defaults: { voltage: 5 },
  Art: () => (
    <g>
      <rect x={-40} y={-38} width={80} height={62} rx={3} fill="#C6CBD1" stroke="#9AA1A8" strokeWidth={1.5} />
      <rect x={-32} y={-30} width={64} height={46} rx={2} fill="#A8AEB5" />
      <rect x={-24} y={-22} width={48} height={30} rx={1.5} fill="#5A6169" />
      <rect x={-16} y={-14} width={32} height={14} rx={1} fill="#C8C2A8" />
      <Silk x={0} y={30} size={7} fill="#5A6068" weight={600}>
        USB 5V
      </Silk>
    </g>
  ),
});

export const ScrewTerminal = definePart({
  id: 'screw-terminal',
  name: 'Screw Terminal Block',
  category: 'connectors',
  keywords: ['terminal block', 'screw', 'connector', 'wire clamp'],
  size: { w: 90, h: 76 },
  origin: { x: 45, y: 34 },
  socketable: true,
  terminals: [
    { name: 'A', type: 'breadboard_male', x: -10, y: 30, dir: [0, 1], group: 'a' },
    { name: 'B', type: 'breadboard_male', x: 10, y: 30, dir: [0, 1], group: 'b' },
    { name: 'wireA', type: 'wire', x: -10, y: -30, dir: [0, -1], group: 'a' },
    { name: 'wireB', type: 'wire', x: 10, y: -30, dir: [0, -1], group: 'b' },
  ],
  props: [],
  defaults: {},
  Art: () => (
    <g>
      <rect x={-24} y={-24} width={48} height={48} rx={2.5} fill="#2E7D32" stroke="#1E5622" />
      {[-10, 10].map((x) => (
        <g key={x}>
          <circle cx={x} cy={-8} r={7} fill="#B9BEC4" stroke="#8E949A" />
          <rect x={x - 5} y={-9} width={10} height={2.4} rx={1} fill="#6E7479" />
          <rect x={x - 5} y={8} width={10} height={10} rx={1.5} fill="#1F2123" />
        </g>
      ))}
    </g>
  ),
});

export const BarrelJack = definePart({
  id: 'barrel-jack',
  name: 'Barrel Jack',
  category: 'connectors',
  keywords: ['barrel', 'dc jack', 'power connector', '5.5mm'],
  size: { w: 110, h: 80 },
  origin: { x: 55, y: 40 },
  model: 'battery',
  terminals: [
    { name: '+', type: 'wire', x: 42, y: -12, dir: [1, 0], role: 'power' },
    { name: '-', type: 'wire', x: 42, y: 12, dir: [1, 0], role: 'gnd' },
  ],
  props: [{ key: 'voltage', label: 'Supply voltage', kind: 'number', unit: 'V', min: 3, max: 24 }],
  defaults: { voltage: 9 },
  Art: () => (
    <g>
      <rect x={-46} y={-24} width={88} height={48} rx={4} fill="#1B1D1F" stroke="#0C0D0E" />
      <circle cx={-24} cy={0} r={17} fill="#0E0F10" />
      <circle cx={-24} cy={0} r={5} fill="#3A3E42" />
      <Silk x={12} y={0} size={7} fill="#8E949A" weight={600}>
        DC IN
      </Silk>
    </g>
  ),
});

export const AlligatorLead = definePart({
  id: 'alligator-lead',
  name: 'Alligator Clip Lead',
  category: 'connectors',
  keywords: ['alligator', 'crocodile', 'clip', 'test lead', 'jumper'],
  size: { w: 190, h: 60 },
  origin: { x: 95, y: 30 },
  terminals: [
    { name: 'A', type: 'wire', x: -80, y: 0, dir: [-1, 0], group: 'lead' },
    { name: 'B', type: 'wire', x: 80, y: 0, dir: [1, 0], group: 'lead' },
  ],
  props: [],
  defaults: {},
  Art: () => (
    <g>
      <path d="M-72,0 Q0,-22 72,0" fill="none" stroke="#C11F1F" strokeWidth={4} strokeLinecap="round" />
      {[-1, 1].map((s) => (
        <g key={s} transform={`translate(${s * 76},0) scale(${s},1)`}>
          <path d="M-14,-8 L6,-3 L14,-1 L14,1 L6,3 L-14,8 Z" fill="#B9BEC4" stroke="#8E949A" />
          <path d="M-14,-2 L4,0 L-14,2 Z" fill="#8E949A" />
        </g>
      ))}
    </g>
  ),
});

export const JumperWire = definePart({
  id: 'jumper-wire',
  name: 'Jumper Wire',
  category: 'connectors',
  keywords: ['jumper', 'dupont', 'patch', 'link', 'wire'],
  size: { w: 130, h: 40 },
  origin: { x: 65, y: 20 },
  socketable: true,
  terminals: [
    { name: 'A', type: 'breadboard_male', x: -50, y: 10, dir: [0, 1], group: 'link' },
    { name: 'B', type: 'breadboard_male', x: 50, y: 10, dir: [0, 1], group: 'link' },
  ],
  props: [],
  defaults: {},
  Art: () => (
    <g>
      <path d="M-50,6 L-50,-6 Q-50,-14 -42,-14 L42,-14 Q50,-14 50,-6 L50,6" fill="none" stroke="#2E63B8" strokeWidth={4} strokeLinecap="round" />
      <Leg x1={-50} y1={2} x2={-50} y2={12} />
      <Leg x1={50} y1={2} x2={50} y2={12} />
    </g>
  ),
});

// ─── Power extras ────────────────────────────────────────────────────────────

interface SolarProps extends Record<string, string | number> {
  voltage: number;
  current: number;
}

export const SolarPanel = definePart<SolarProps>({
  id: 'solar-panel',
  name: 'Solar Panel',
  category: 'power',
  keywords: ['solar', 'photovoltaic', 'panel', 'sun', 'renewable'],
  size: { w: 180, h: 140 },
  origin: { x: 90, y: 66 },
  model: 'solar-panel',
  terminals: [
    { name: '+', type: 'wire', x: -20, y: 68, dir: [0, 1], role: 'power' },
    { name: '-', type: 'wire', x: 20, y: 68, dir: [0, 1], role: 'gnd' },
  ],
  props: [
    { key: 'voltage', label: 'Open-circuit voltage', kind: 'number', unit: 'V', min: 0.5, max: 24, step: 0.5 },
    { key: 'current', label: 'Short-circuit current', kind: 'number', unit: 'A', min: 0.01, max: 2, step: 0.01 },
  ],
  defaults: { voltage: 5, current: 0.1 },
  Art: ({ state, simulating, interact }: ArtProps<SolarProps>) => {
    const illum = Number(state?.illumination ?? 100);
    return (
      <g>
        <BoardShadow w={166} h={116} rx={3} />
        <rect x={-83} y={-58} width={166} height={116} rx={3} fill="#8E949A" stroke="#6E7479" />
        <rect x={-77} y={-52} width={154} height={104} rx={2} fill="#14264A" />
        {Array.from({ length: 4 }, (_, r) =>
          Array.from({ length: 6 }, (_, c) => (
            <rect
              key={`${r}-${c}`}
              x={-74 + c * 25}
              y={-49 + r * 25}
              width={22}
              height={22}
              rx={1}
              fill="#1E3A6E"
              opacity={0.55 + (illum / 100) * 0.45}
            />
          )),
        )}
        {Array.from({ length: 6 }, (_, c) => (
          <line key={c} x1={-63 + c * 25} y1={-52} x2={-63 + c * 25} y2={52} stroke="#9FB4D8" strokeWidth={0.8} opacity={0.6} />
        ))}
        {simulating && (
          <>
            <Silk x={0} y={-70} size={8} fill="#4A4F55" weight={700}>
              {`${Math.round(illum)}% sun`}
            </Silk>
            <rect
              x={-83}
              y={-58}
              width={166}
              height={116}
              fill="transparent"
              style={{ cursor: 'ns-resize' }}
              onPointerDown={(e) => {
                let v = illum;
                const start = e.clientY;
                const move = (ev: PointerEvent) => {
                  v = Math.max(0, Math.min(100, illum - (ev.clientY - start) * 0.6));
                  interact?.('illumination', v);
                };
                const up = () => {
                  window.removeEventListener('pointermove', move);
                  window.removeEventListener('pointerup', up);
                };
                e.stopPropagation();
                window.addEventListener('pointermove', move);
                window.addEventListener('pointerup', up);
              }}
            />
          </>
        )}
      </g>
    );
  },
});

export const VccSymbol = definePart({
  id: 'vcc-symbol',
  name: 'VCC Supply',
  category: 'power',
  keywords: ['vcc', 'rail', 'supply', 'power symbol', '5v'],
  size: { w: 60, h: 70 },
  origin: { x: 30, y: 35 },
  model: 'vcc-symbol',
  terminals: [{ name: 'out', type: 'wire', x: 0, y: 30, dir: [0, 1], role: 'power' }],
  props: [{ key: 'voltage', label: 'Voltage', kind: 'number', unit: 'V', min: 0, max: 30, step: 0.1 }],
  defaults: { voltage: 5 },
  Art: ({ props }: ArtProps) => (
    <g>
      <path d="M-18,-6 L0,-26 L18,-6 Z" fill={C.danger} />
      <line x1={0} y1={-6} x2={0} y2={30} stroke={C.danger} strokeWidth={3} strokeLinecap="round" />
      <Silk x={0} y={-16} size={9} fill="#FFFFFF" weight={800}>
        +
      </Silk>
      <Silk x={22} y={8} size={9} fill="#5A6068" weight={700} anchor="start">
        {`${props.voltage}V`}
      </Silk>
    </g>
  ),
});

export const GndSymbol = definePart({
  id: 'gnd-symbol',
  name: 'Ground',
  category: 'power',
  keywords: ['ground', 'gnd', 'earth', '0v', 'reference'],
  size: { w: 60, h: 70 },
  origin: { x: 30, y: 35 },
  model: 'gnd-symbol',
  terminals: [{ name: 'out', type: 'wire', x: 0, y: -30, dir: [0, -1], role: 'gnd' }],
  props: [],
  defaults: {},
  Art: () => (
    <g>
      <line x1={0} y1={-30} x2={0} y2={4} stroke="#171919" strokeWidth={3} strokeLinecap="round" />
      <line x1={-18} y1={6} x2={18} y2={6} stroke="#171919" strokeWidth={3.5} strokeLinecap="round" />
      <line x1={-11} y1={14} x2={11} y2={14} stroke="#171919" strokeWidth={3.5} strokeLinecap="round" />
      <line x1={-4} y1={22} x2={4} y2={22} stroke="#171919" strokeWidth={3.5} strokeLinecap="round" />
    </g>
  ),
});

// ─── Networking modules (non-programmable, as in the reference product) ──────

function networkModule(opts: {
  id: string;
  name: string;
  label: string;
  sub: string;
  pins: string[];
  keywords: string[];
  led?: string;
}) {
  const w = Math.max(90, opts.pins.length * 10 + 30);
  const h = 92;
  return definePart({
    id: opts.id,
    name: opts.name,
    category: 'networking',
    keywords: opts.keywords,
    size: { w: w + 10, h: h + 40 },
    origin: { x: (w + 10) / 2, y: (h + 40) / 2 - 14 },
    socketable: true,
    rotationStep: 90,
    terminals: opts.pins.map((p, i) => ({
      name: p,
      type: 'breadboard_male' as const,
      x: -((opts.pins.length - 1) * 10) / 2 + i * 10,
      y: h / 2 + 14,
      dir: [0, 1] as [number, number],
      role: p === 'VCC' ? ('power' as const) : p === 'GND' ? ('gnd' as const) : undefined,
    })),
    props: [],
    defaults: {},
    Art: () => (
      <g>
        <BoardShadow w={w} h={h} rx={3} />
        <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={3} fill="#1B4D8C" stroke="#123563" />
        {/* PCB trace antenna */}
        <path
          d={`M${-w / 2 + 10},${-h / 2 + 10} h${w * 0.32} v10 h${-w * 0.24} v10 h${w * 0.24} v10 h${-w * 0.24}`}
          fill="none"
          stroke="#C8A24B"
          strokeWidth={3}
        />
        <rect x={-8} y={-14} width={34} height={26} rx={2} fill="#B9BEC4" stroke="#8E949A" />
        <Silk x={9} y={-1} size={5.5} fill="#3A3D41" weight={600}>
          RF
        </Silk>
        {opts.led && <circle cx={w / 2 - 12} cy={-h / 2 + 14} r={3.5} fill={opts.led} />}
        <Silk x={0} y={h / 2 - 26} size={7} fill="#DCE8F5" weight={700}>
          {opts.label}
        </Silk>
        <Silk x={0} y={h / 2 - 17} size={5} fill="#9FC0E0" weight={500}>
          {opts.sub}
        </Silk>
        {opts.pins.map((p, i) => (
          <rect
            key={p}
            x={-((opts.pins.length - 1) * 10) / 2 + i * 10 - 1.4}
            y={h / 2 - 9}
            width={2.8}
            height={23}
            fill={C.solderPad}
          />
        ))}
      </g>
    ),
  });
}

export const Esp8266 = networkModule({
  id: 'esp8266',
  name: 'Wi-Fi Module [ESP8266]',
  label: 'ESP-01',
  sub: 'Wi-Fi 802.11',
  pins: ['GND', 'GPIO2', 'GPIO0', 'RX', 'TX', 'CH_PD', 'RST', 'VCC'],
  keywords: ['esp8266', 'wifi', 'wireless', 'iot', 'esp-01', 'network'],
  led: '#2E8BD6',
});

export const Hc05 = networkModule({
  id: 'hc-05',
  name: 'Bluetooth Module [HC-05]',
  label: 'HC-05',
  sub: 'Bluetooth SPP',
  pins: ['STATE', 'RX', 'TX', 'GND', 'VCC', 'EN'],
  keywords: ['bluetooth', 'hc-05', 'wireless', 'serial', 'spp'],
  led: '#3D9E36',
});

export const Nrf24 = networkModule({
  id: 'nrf24l01',
  name: 'Radio Module [nRF24L01]',
  label: 'nRF24L01',
  sub: '2.4 GHz radio',
  pins: ['GND', 'VCC', 'CE', 'CSN', 'SCK', 'MOSI', 'MISO', 'IRQ'],
  keywords: ['nrf24', 'radio', 'wireless', '2.4ghz', 'spi'],
});

export const CONNECTORS: PartDef<never>[] = [
  Header8Male, Header8Female, Header40, UsbConnector, ScrewTerminal, BarrelJack,
  AlligatorLead, JumperWire,
] as unknown as PartDef<never>[];

export const POWER_EXTRAS: PartDef<never>[] = [
  SolarPanel, VccSymbol, GndSymbol,
] as unknown as PartDef<never>[];

export const NETWORKING: PartDef<never>[] = [Esp8266, Hc05, Nrf24] as unknown as PartDef<never>[];
