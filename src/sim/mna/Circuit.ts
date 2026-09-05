import { DenseMatrix } from './Matrix';

/**
 * Modified Nodal Analysis system.
 *
 *   [ G  B ] [ v ]   [ i ]
 *   [ C  D ] [ j ] = [ e ]
 *
 * Node index −1 means ground and every stamp touching it is dropped, which is
 * how the reference node is eliminated. Voltage sources add one extra unknown
 * (their branch current) each.
 */
export class Circuit {
  readonly nodeCount: number;
  readonly branchCount: number;
  readonly size: number;
  readonly matrix: DenseMatrix;
  readonly rhs: Float64Array;
  readonly solution: Float64Array;

  /**
   * Set by a nonlinear device when it had to clamp its junction voltage this
   * iteration. Node voltages can sit still for several iterations while a
   * diode's internal state is still ramping toward its operating point, so
   * Newton must not declare convergence while this is true.
   */
  limited = false;

  constructor(nodeCount: number, branchCount: number) {
    this.nodeCount = nodeCount;
    this.branchCount = branchCount;
    this.size = nodeCount + branchCount;
    this.matrix = new DenseMatrix(this.size);
    this.rhs = new Float64Array(this.size);
    this.solution = new Float64Array(this.size);
  }

  reset() {
    this.matrix.clear();
    this.rhs.fill(0);
    this.limited = false;
  }

  /** Conductance `g` between two nodes. */
  stampConductance(a: number, b: number, g: number) {
    if (!Number.isFinite(g)) return;
    if (a >= 0) this.matrix.add(a, a, g);
    if (b >= 0) this.matrix.add(b, b, g);
    if (a >= 0 && b >= 0) {
      this.matrix.add(a, b, -g);
      this.matrix.add(b, a, -g);
    }
  }

  stampResistance(a: number, b: number, r: number) {
    this.stampConductance(a, b, 1 / Math.max(r, 1e-9));
  }

  /** Current `i` flowing out of node `a`, through the source, into node `b`. */
  stampCurrentSource(a: number, b: number, i: number) {
    if (!Number.isFinite(i)) return;
    if (a >= 0) this.rhs[a] -= i;
    if (b >= 0) this.rhs[b] += i;
  }

  /** Voltage source of `v` volts, `a` positive, occupying branch `k`. */
  stampVoltageSource(a: number, b: number, k: number, v: number) {
    const row = this.nodeCount + k;
    if (a >= 0) {
      this.matrix.add(a, row, 1);
      this.matrix.add(row, a, 1);
    }
    if (b >= 0) {
      this.matrix.add(b, row, -1);
      this.matrix.add(row, b, -1);
    }
    this.rhs[row] += v;
  }

  /**
   * Voltage-controlled voltage source: v(a,b) = gain · v(cp,cn).
   * Used for op-amps, comparators and buffered logic outputs.
   */
  stampVCVS(a: number, b: number, cp: number, cn: number, k: number, gain: number) {
    const row = this.nodeCount + k;
    if (a >= 0) {
      this.matrix.add(a, row, 1);
      this.matrix.add(row, a, 1);
    }
    if (b >= 0) {
      this.matrix.add(b, row, -1);
      this.matrix.add(row, b, -1);
    }
    if (cp >= 0) this.matrix.add(row, cp, -gain);
    if (cn >= 0) this.matrix.add(row, cn, gain);
  }

  /** Voltage-controlled current source: i(a→b) = gm · v(cp,cn). */
  stampVCCS(a: number, b: number, cp: number, cn: number, gm: number) {
    if (a >= 0 && cp >= 0) this.matrix.add(a, cp, gm);
    if (a >= 0 && cn >= 0) this.matrix.add(a, cn, -gm);
    if (b >= 0 && cp >= 0) this.matrix.add(b, cp, -gm);
    if (b >= 0 && cn >= 0) this.matrix.add(b, cn, gm);
  }

  /** Node voltage from the last solve; ground reads exactly zero. */
  v(node: number): number {
    return node < 0 ? 0 : this.solution[node];
  }

  /** Branch current from the last solve. */
  branch(k: number): number {
    return this.solution[this.nodeCount + k];
  }

  solve(): boolean {
    return this.matrix.solve(this.rhs, this.solution);
  }
}
