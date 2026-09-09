import { definePart } from '../registry';
import type { ArtProps, PartDef } from '../types';
import { C } from '@/lib/tokens';
import { BoardShadow, Leg, Silk } from '../primitives';

// ─── DC motor ────────────────────────────────────────────────────────────────

interface MotorProps extends Record<string, string | number> {
  ratedVoltage: number;
}

function MotorArt({ state }: ArtProps<MotorProps>) {
  const rpm = Number(state?.rpm ?? 0);
  const angle = Number(state?.angle ?? 0);
  const spinning = Math.abs(rpm) > 1;
  return (
    <g>
      <BoardShadow w={104} h={72} rx={30} />
      {/* can */}
      <rect x={-52} y={-36} width={92} height={72} rx={30} fill="#B9BEC4" stroke="#8E949A" />
      <rect x={-52} y={-36} width={92} height={22} rx={11} fill="#CDD2D7" opacity={0.7} />
      <rect x={-52} y={-36} width={10} height={72} rx={5} fill="#9AA0A6" />
      {/* end bell + shaft */}
      <rect x={38} y={-22} width={12} height={44} rx={4} fill="#8E949A" />
      <rect x={50} y={-4} width={22} height={8} rx={3} fill="#6E7479" />
      {/* rotor mark so rotation is visible */}
      <g transform={`rotate(${angle} 72 0)`}>
        <circle cx={72} cy={0} r={11} fill="#D5D9DD" stroke="#9AA0A6" />
        <rect x={70.5} y={-11} width={3} height={11} rx={1.2} fill="#5C6166" />
      </g>
      {spinning && (
        <path
          d={`M60,-18 A18,18 0 0,${rpm > 0 ? 1 : 0} 84,-18`}
          fill="none"
          stroke={C.select}
          strokeWidth={2}
          strokeLinecap="round"
          opacity={0.8}
        />
      )}
      {/* terminals */}
      <Leg x1={-52} y1={-14} x2={-70} y2={-14} w={3.5} color="#C11F1F" />
      <Leg x1={-52} y1={14} x2={-70} y2={14} w={3.5} color="#171919" />
      {state && (
        <Silk x={-6} y={0} size={10} fill="#4A4F55" weight={700}>
          {`${Math.round(Math.abs(rpm))} rpm`}
        </Silk>
      )}
    </g>
  );
}

function makeMotor(id: string, name: string, keywords: string[]) {
  return definePart<MotorProps>({
    id,
    name,
    category: 'output',
    keywords,
    size: { w: 152, h: 80 },
    origin: { x: 76, y: 40 },
    model: 'dc-motor',
    terminals: [
      { name: 'terminal1', type: 'wire', x: -70, y: -14, dir: [-1, 0] },
      { name: 'terminal2', type: 'wire', x: -70, y: 14, dir: [-1, 0] },
    ],
    props: [
      { key: 'ratedVoltage', label: 'Rated voltage', kind: 'number', unit: 'V', min: 1, max: 24 },
    ],
    defaults: { ratedVoltage: 6 },
    Art: MotorArt,
  });
}

export const DcMotor = makeMotor('dc-motor', 'DC Motor', ['motor', 'dc', 'spin', 'rotate']);
export const Gearmotor = makeMotor('gearmotor', 'Hobby Gearmotor', [
  'gearmotor',
  'geared',
  'motor',
  'tt motor',
]);

// ─── Servos ──────────────────────────────────────────────────────────────────

interface ServoProps extends Record<string, string | number> {
  kind: string;
}

function ServoArt({ props, state }: ArtProps<ServoProps>) {
  const continuous = String(props.kind) === 'continuous';
  const angle = Number(state?.angle ?? 90);
  const speed = Number(state?.speed ?? 0);
  const hornAngle = continuous ? Number(state?.hornAngle ?? 0) : angle - 90;

  return (
    <g>
      <BoardShadow w={92} h={72} rx={3} />
      {/* body */}
      <rect x={-46} y={-26} width={92} height={52} rx={3} fill="#1E4FA0" stroke="#153A78" />
      {/* mounting tabs */}
      <rect x={-46} y={-34} width={92} height={9} rx={2} fill="#2A5FB8" />
      <circle cx={-38} cy={-29.5} r={2.6} fill="#12305F" />
      <circle cx={38} cy={-29.5} r={2.6} fill="#12305F" />
      {/* gearbox hub */}
      <circle cx={16} cy={0} r={17} fill="#2A5FB8" stroke="#153A78" />
      <circle cx={16} cy={0} r={9} fill="#D8DCE1" stroke="#A8AEB5" />
      {/* horn */}
      <g transform={`rotate(${hornAngle} 16 0)`}>
        <rect x={12.5} y={-38} width={7} height={40} rx={3.2} fill="#F0F2F4" stroke="#C2C7CC" strokeWidth={0.8} />
        <circle cx={16} cy={-33} r={2} fill="#B6BCC2" />
        <circle cx={16} cy={-26} r={2} fill="#B6BCC2" />
      </g>
      <circle cx={16} cy={0} r={3.4} fill="#8E949A" />
      {/* lead-out */}
      <path d="M-46,-8 L-62,-8" stroke="#C11F1F" strokeWidth={3.5} strokeLinecap="round" />
      <path d="M-46,0 L-62,0" stroke="#8A5A2B" strokeWidth={3.5} strokeLinecap="round" />
      <path d="M-46,8 L-62,8" stroke="#E6C619" strokeWidth={3.5} strokeLinecap="round" />
      <Silk x={-14} y={14} size={6} fill="#BBD0EC" weight={600}>
        {continuous ? 'CR SERVO' : 'SG90'}
      </Silk>
      {state && (
        <Silk x={-14} y={-12} size={8} fill="#FFFFFF" weight={700}>
          {continuous ? `${Math.round(speed)}%` : `${Math.round(angle)}°`}
        </Silk>
      )}
    </g>
  );
}

function makeServo(id: string, name: string, kind: string, keywords: string[]) {
  return definePart<ServoProps>({
    id,
    name,
    category: 'output',
    keywords,
    size: { w: 128, h: 92 },
    origin: { x: 64, y: 46 },
    model: 'servo',
    terminals: [
      { name: 'power', type: 'wire', x: -62, y: -8, dir: [-1, 0], role: 'power' },
      { name: 'gnd', type: 'wire', x: -62, y: 0, dir: [-1, 0], role: 'gnd' },
      { name: 'signal', type: 'wire', x: -62, y: 8, dir: [-1, 0], role: 'pwm' },
    ],
    props: [
      {
        key: 'kind',
        label: 'Type',
        kind: 'select',
        options: [
          { value: 'positional', label: 'Positional (0–180°)' },
          { value: 'continuous', label: 'Continuous rotation' },
        ],
      },
    ],
    defaults: { kind },
    Art: ServoArt,
  });
}

export const MicroServo = makeServo(
  'micro-servo',
  'Micro Servo',
  'positional',
  ['servo', 'sg90', 'positional', 'motor', 'angle'],
);
export const ContinuousServo = makeServo(
  'continuous-servo',
  'Continuous Rotation Servo',
  'continuous',
  ['servo', 'continuous', '360', 'wheel'],
);

// ─── Stepper motor ───────────────────────────────────────────────────────────

export const StepperMotor = definePart({
  id: 'stepper',
  name: 'Stepper Motor',
  category: 'output',
  keywords: ['stepper', '28byj', 'unipolar', 'bipolar', 'precise'],
  size: { w: 130, h: 130 },
  origin: { x: 65, y: 65 },
  model: 'stepper',
  terminals: [
    { name: 'A+', type: 'wire', x: -30, y: 58, dir: [0, 1] },
    { name: 'A-', type: 'wire', x: -10, y: 58, dir: [0, 1] },
    { name: 'B+', type: 'wire', x: 10, y: 58, dir: [0, 1] },
    { name: 'B-', type: 'wire', x: 30, y: 58, dir: [0, 1] },
  ],
  props: [],
  defaults: {},
  Art: ({ state }: ArtProps<Record<string, never>>) => {
    const angle = Number(state?.angle ?? 0);
    return (
      <g>
        <circle cx={0} cy={0} r={52} fill="#9AA0A6" stroke="#767C82" strokeWidth={1.5} />
        <circle cx={0} cy={0} r={44} fill="#B4B9BF" />
        {Array.from({ length: 24 }, (_, i) => (
          <line
            key={i}
            x1={0}
            y1={0}
            x2={Math.cos((i / 24) * Math.PI * 2) * 44}
            y2={Math.sin((i / 24) * Math.PI * 2) * 44}
            stroke="#A2A8AE"
            strokeWidth={1}
          />
        ))}
        <circle cx={0} cy={0} r={18} fill="#D5D9DD" stroke="#8E949A" />
        <g transform={`rotate(${angle} 0 0)`}>
          <rect x={-2} y={-18} width={4} height={18} rx={1.6} fill="#4C5257" />
        </g>
        <circle cx={0} cy={0} r={4} fill="#6E7479" />
        <rect x={-38} y={44} width={76} height={14} rx={3} fill="#2B2E31" />
        <Silk x={0} y={30} size={7} fill="#5C6166" weight={600}>
          28BYJ-48
        </Silk>
      </g>
    );
  },
});

// ─── Vibration motor ─────────────────────────────────────────────────────────

export const VibrationMotor = definePart<MotorProps>({
  id: 'vibration-motor',
  name: 'Vibration Motor',
  category: 'output',
  keywords: ['vibration', 'haptic', 'buzz', 'pager motor', 'erm'],
  size: { w: 96, h: 60 },
  origin: { x: 48, y: 30 },
  model: 'dc-motor',
  terminals: [
    { name: 'terminal1', type: 'wire', x: -44, y: -8, dir: [-1, 0] },
    { name: 'terminal2', type: 'wire', x: -44, y: 8, dir: [-1, 0] },
  ],
  props: [
    { key: 'ratedVoltage', label: 'Rated voltage', kind: 'number', unit: 'V', min: 1, max: 12 },
  ],
  defaults: { ratedVoltage: 3 },
  Art: ({ state }: ArtProps<MotorProps>) => {
    const rpm = Number(state?.rpm ?? 0);
    const buzz = Math.min(1, Math.abs(rpm) / 8000);
    const wobble = buzz > 0.02 ? Math.sin(Number(state?.angle ?? 0) * 0.7) * 1.6 * buzz : 0;
    return (
      <g transform={`translate(${wobble},${-wobble})`}>
        <circle cx={0} cy={0} r={24} fill="#B9BEC4" stroke="#8E949A" />
        <circle cx={0} cy={0} r={17} fill="#CDD2D7" />
        <circle cx={0} cy={0} r={6} fill="#8E949A" />
        <path d="M-8,-14 A16,16 0 0,1 8,-14" fill="none" stroke="#8E949A" strokeWidth={5} />
        <Leg x1={-24} y1={-8} x2={-44} y2={-8} w={3} color="#C11F1F" />
        <Leg x1={-24} y1={8} x2={-44} y2={8} w={3} color="#171919" />
        {buzz > 0.05 &&
          [20, 26, 32].map((r, i) => (
            <circle key={r} cx={0} cy={0} r={r + i} fill="none" stroke={C.select} strokeWidth={1.2} opacity={0.45 * buzz} />
          ))}
      </g>
    );
  },
});

// ─── Solenoid ────────────────────────────────────────────────────────────────

export const Solenoid = definePart({
  id: 'solenoid',
  name: 'Solenoid',
  category: 'output',
  keywords: ['solenoid', 'actuator', 'push', 'linear', 'plunger'],
  size: { w: 140, h: 70 },
  origin: { x: 70, y: 35 },
  model: 'solenoid',
  terminals: [
    { name: 'terminal1', type: 'wire', x: -62, y: -12, dir: [-1, 0] },
    { name: 'terminal2', type: 'wire', x: -62, y: 12, dir: [-1, 0] },
  ],
  props: [],
  defaults: {},
  Art: ({ state }: ArtProps<Record<string, never>>) => {
    const on = Number(state?.engaged ?? 0);
    return (
      <g>
        <rect x={-52} y={-26} width={74} height={52} rx={4} fill="#8E949A" stroke="#6E7479" />
        {[-40, -30, -20, -10, 0, 10].map((x) => (
          <rect key={x} x={x} y={-26} width={5} height={52} fill="#B78A4A" opacity={0.85} />
        ))}
        <rect x={22 + on * 18} y={-8} width={44} height={16} rx={3} fill="#C4C9CE" stroke="#9AA0A6" />
        <Leg x1={-52} y1={-12} x2={-62} y2={-12} w={3} color="#C11F1F" />
        <Leg x1={-52} y1={12} x2={-62} y2={12} w={3} color="#171919" />
      </g>
    );
  },
});

export const MOTORS: PartDef<never>[] = [
  DcMotor,
  Gearmotor,
  MicroServo,
  ContinuousServo,
  StepperMotor,
  VibrationMotor,
  Solenoid,
] as unknown as PartDef<never>[];
