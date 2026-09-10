/**
 * Dense LU with partial pivoting.
 *
 * Circuits in this editor are small — a busy student design solves 20–60
 * unknowns — so a dense factorisation is both fast enough and far more robust
 * than a sparse one with fill-in heuristics. The matrix is stored row-major in
 * a single Float64Array to keep it in one cache-friendly allocation.
 */
export class DenseMatrix {
  readonly n: number;
  readonly a: Float64Array;
  private readonly perm: Int32Array;
  /**
   * Scratch for the factorisation, allocated once.
   *
   * This used to be a fresh copy of the matrix on every solve. At a few
   * hundred unknowns that is over a megabyte per Newton iteration, several
   * iterations per timestep and a thousand timesteps a second — the allocation
   * cost more than the arithmetic it was feeding.
   */
  private readonly lu: Float64Array;

  constructor(n: number) {
    this.n = n;
    this.a = new Float64Array(n * n);
    this.perm = new Int32Array(n);
    this.lu = new Float64Array(n * n);
  }

  clear() {
    this.a.fill(0);
  }

  get(i: number, j: number) {
    return this.a[i * this.n + j];
  }

  add(i: number, j: number, v: number) {
    this.a[i * this.n + j] += v;
  }

  set(i: number, j: number, v: number) {
    this.a[i * this.n + j] = v;
  }

  /**
   * Solve A·x = b in place on a copy of A. Returns false if the matrix is
   * singular, which in circuit terms means a floating node or a voltage-source
   * loop — the caller reports that rather than emitting NaNs.
   */
  solve(b: Float64Array, x: Float64Array): boolean {
    const n = this.n;
    if (n === 0) return true;
    const lu = this.lu;
    lu.set(this.a);
    const perm = this.perm;
    for (let i = 0; i < n; i++) perm[i] = i;

    for (let k = 0; k < n; k++) {
      // partial pivot
      let p = k;
      let max = Math.abs(lu[k * n + k]);
      for (let i = k + 1; i < n; i++) {
        const v = Math.abs(lu[i * n + k]);
        if (v > max) {
          max = v;
          p = i;
        }
      }
      if (max < 1e-14) return false;
      if (p !== k) {
        for (let j = 0; j < n; j++) {
          const t = lu[k * n + j];
          lu[k * n + j] = lu[p * n + j];
          lu[p * n + j] = t;
        }
        const t = perm[k];
        perm[k] = perm[p];
        perm[p] = t;
      }

      const pivot = lu[k * n + k];
      for (let i = k + 1; i < n; i++) {
        const f = lu[i * n + k] / pivot;
        if (f === 0) continue;
        lu[i * n + k] = f;
        for (let j = k + 1; j < n; j++) lu[i * n + j] -= f * lu[k * n + j];
      }
    }

    // forward substitution on the permuted right-hand side
    for (let i = 0; i < n; i++) {
      let s = b[perm[i]];
      for (let j = 0; j < i; j++) s -= lu[i * n + j] * x[j];
      x[i] = s;
    }
    // back substitution
    for (let i = n - 1; i >= 0; i--) {
      let s = x[i];
      for (let j = i + 1; j < n; j++) s -= lu[i * n + j] * x[j];
      x[i] = s / lu[i * n + i];
    }

    for (let i = 0; i < n; i++) {
      if (!Number.isFinite(x[i])) return false;
    }
    return true;
  }
}
