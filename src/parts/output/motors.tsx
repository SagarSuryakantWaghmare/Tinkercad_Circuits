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

function makeMotor(id: string, name: string, keywords: string[], basic = false) {
  return definePart<MotorProps>({
    id,
    name,
    category: 'output',
    keywords,
    basic,
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

export const DcMotor = makeMotor('dc-motor', 'DC Motor', ['motor', 'dc', 'spin', 'rotate'], true);
export const Gearmotor = makeMotor('gearmotor', 'Hobby Gearmotor', [
  'gearmotor',
  'geared',
  'motor',
  'tt motor',
]);

// Hobby motor with a propeller fitted to the shaft. Same electrical model as
// the plain DC motor; only the art differs, adding a rotor blade that spins
// with the solved shaft angle.
function PropMotorArt(p: ArtProps<MotorProps>) {
  const angle = Number(p.state?.angle ?? 0);
  const rpm = Number(p.state?.rpm ?? 0);
  const spinning = Math.abs(rpm) > 50;
  return (
    <g>
      <MotorArt {...p} />
      {/* Propeller hub sits just past the motor shaft. */}
      <g transform={`translate(94,0) rotate(${angle})`}>
        <ellipse cx={0} cy={0} rx={22} ry={3.2} fill="#E8EAEC" stroke="#8E949A" opacity={spinning ? 0.55 : 0.95} />
        <ellipse cx={0} cy={0} rx={3.2} ry={22} fill="#E8EAEC" stroke="#8E949A" opacity={spinning ? 0.55 : 0.95} />
        <circle cx={0} cy={0} r={4.5} fill="#8E949A" stroke="#5A6066" />
      </g>
      {spinning && (
        <circle cx={94} cy={0} r={24} fill="none" stroke={C.select} strokeWidth={1.2} opacity={0.35} />
      )}
    </g>
  );
}

export const HobbyMotorProp = definePart<MotorProps>({
  id: 'hobby-motor-prop',
  name: 'Hobby Motor with Propeller',
  category: 'output',
  keywords: ['motor', 'propeller', 'fan', 'hobby', 'dc', 'spin'],
  size: { w: 200, h: 96 },
  origin: { x: 100, y: 48 },
  model: 'dc-motor',
  terminals: [
    { name: 'terminal1', type: 'wire', x: -70, y: -14, dir: [-1, 0] },
    { name: 'terminal2', type: 'wire', x: -70, y: 14, dir: [-1, 0] },
  ],
  props: [
    { key: 'ratedVoltage', label: 'Rated voltage', kind: 'number', unit: 'V', min: 1, max: 24 },
  ],
  defaults: { ratedVoltage: 6 },
  Art: PropMotorArt,
});

// Tinkercad ships a DC motor with a back-of-the-shaft optical encoder. It
// looks like a regular DC motor but has two extra output pins (A/B channels
// in quadrature) so a sketch can count rotations. Behaviour is the same
// motor, so it reuses the dc-motor sim model; the encoder A/B lines are
// exposed at the back for the sketch to sample.
function EncoderMotorArt(p: ArtProps<MotorProps>) {
  const rpm = Number(p.state?.rpm ?? 0);
  const spinning = Math.abs(rpm) > 1;
  return (
    <g>
      <MotorArt {...p} />
      {/* Encoder disk on the tail end of the shaft. */}
      <g transform="translate(76,0)">
        <circle cx={0} cy={0} r={9} fill="#2B2E31" stroke="#17191B" />
        <g transform={`rotate(${Number(p.state?.angle ?? 0) * 2} 0 0)`}>
          {Array.from({ length: 8 }, (_, i) => (
            <rect
              key={i}
              x={-1.4}
              y={-8}
              width={2.8}
              height={4}
              transform={`rotate(${i * 45} 0 0)`}
              fill="#E8EAEC"
            />
          ))}
        </g>
        {spinning && (
          <circle cx={0} cy={0} r={12} fill="none" stroke={C.select} strokeWidth={1.4} opacity={0.4} />
        )}
      </g>
      {/* Encoder header: A / B / VCC / GND on the far right. */}
      {['A', 'B', 'VCC', 'GND'].map((label, i) => (
        <g key={label} transform={`translate(72,${-24 + i * 16})`}>
          <Leg x1={0} y1={0} x2={12} y2={0} w={3} color={C.metal} />
          <Silk x={16} y={0} size={5.5} fill="#4A4F55" anchor="start" weight={600}>
            {label}
          </Silk>
        </g>
      ))}
    </g>
  );
}

export const DcMotorEncoder = definePart<MotorProps>({
  id: 'dc-motor-encoder',
  name: 'DC Motor with Encoder',
  category: 'output',
  keywords: ['motor', 'dc', 'encoder', 'quadrature', 'rotation', 'feedback'],
  size: { w: 200, h: 96 },
  origin: { x: 100, y: 48 },
  model: 'dc-motor',
  terminals: [
    { name: 'terminal1', type: 'wire', x: -70, y: -14, dir: [-1, 0] },
    { name: 'terminal2', type: 'wire', x: -70, y: 14, dir: [-1, 0] },
    { name: 'A', type: 'wire', x: 90, y: -24, dir: [1, 0], role: 'digital' },
    { name: 'B', type: 'wire', x: 90, y: -8, dir: [1, 0], role: 'digital' },
    { name: 'VCC', type: 'wire', x: 90, y: 8, dir: [1, 0], role: 'power' },
    { name: 'GND', type: 'wire', x: 90, y: 24, dir: [1, 0], role: 'gnd' },
  ],
  props: [
    { key: 'ratedVoltage', label: 'Rated voltage', kind: 'number', unit: 'V', min: 1, max: 24 },
  ],
  defaults: { ratedVoltage: 6 },
  Art: EncoderMotorArt,
});

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

function makeServo(id: string, name: string, kind: string, keywords: string[], basic = false) {
  return definePart<ServoProps>({
    id,
    name,
    category: 'output',
    keywords,
    basic,
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
  true,
);
export const ContinuousServo = makeServo(
  'continuous-servo',
  'Continuous Rotation Servo',
  'continuous',
  ['servo', 'continuous', '360', 'wheel'],
);

// ─── Standard servo ──────────────────────────────────────────────────────────
// Bigger body than the SG90; same electrical model, same three-wire lead.

function StandardServoArt({ props, state }: ArtProps<ServoProps>) {
  const continuous = String(props.kind) === 'continuous';
  const angle = Number(state?.angle ?? 90);
  const speed = Number(state?.speed ?? 0);
  const hornAngle = continuous ? Number(state?.hornAngle ?? 0) : angle - 90;
  return (
    <g>
      <BoardShadow w={128} h={96} rx={4} />
      <rect x={-64} y={-36} width={128} height={72} rx={4} fill="#1E4FA0" stroke="#153A78" />
      <rect x={-64} y={-46} width={128} height={12} rx={3} fill="#2A5FB8" />
      <circle cx={-54} cy={-40} r={3.6} fill="#12305F" />
      <circle cx={54} cy={-40} r={3.6} fill="#12305F" />
      {/* larger gearbox hub */}
      <circle cx={22} cy={0} r={24} fill="#2A5FB8" stroke="#153A78" />
      <circle cx={22} cy={0} r={13} fill="#D8DCE1" stroke="#A8AEB5" />
      <g transform={`rotate(${hornAngle} 22 0)`}>
        <rect x={17} y={-52} width={10} height={54} rx={4} fill="#F0F2F4" stroke="#C2C7CC" strokeWidth={0.8} />
        <circle cx={22} cy={-46} r={2.4} fill="#B6BCC2" />
        <circle cx={22} cy={-38} r={2.4} fill="#B6BCC2" />
        <circle cx={22} cy={-30} r={2.4} fill="#B6BCC2" />
      </g>
      <circle cx={22} cy={0} r={4.4} fill="#8E949A" />
      <path d="M-64,-10 L-82,-10" stroke="#C11F1F" strokeWidth={4} strokeLinecap="round" />
      <path d="M-64,0 L-82,0" stroke="#8A5A2B" strokeWidth={4} strokeLinecap="round" />
      <path d="M-64,10 L-82,10" stroke="#E6C619" strokeWidth={4} strokeLinecap="round" />
      <Silk x={-22} y={20} size={7} fill="#BBD0EC" weight={600}>
        MG996R
      </Silk>
      {state && (
        <Silk x={-22} y={-14} size={9} fill="#FFFFFF" weight={700}>
          {continuous ? `${Math.round(speed)}%` : `${Math.round(angle)}°`}
        </Silk>
      )}
    </g>
  );
}

export const StandardServo = definePart<ServoProps>({
  id: 'standard-servo',
  name: 'Standard Servo',
  category: 'output',
  keywords: ['servo', 'standard', 'mg996r', 'motor', 'positional'],
  size: { w: 172, h: 116 },
  origin: { x: 86, y: 58 },
  model: 'servo',
  terminals: [
    { name: 'power', type: 'wire', x: -82, y: -10, dir: [-1, 0], role: 'power' },
    { name: 'gnd', type: 'wire', x: -82, y: 0, dir: [-1, 0], role: 'gnd' },
    { name: 'signal', type: 'wire', x: -82, y: 10, dir: [-1, 0], role: 'pwm' },
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
  defaults: { kind: 'positional' },
  Art: StandardServoArt,
});

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
  DcMotorEncoder,
  Gearmotor,
  HobbyMotorProp,
  MicroServo,
  ContinuousServo,
  StandardServo,
  StepperMotor,
  VibrationMotor,
  Solenoid,
] as unknown as PartDef<never>[];
