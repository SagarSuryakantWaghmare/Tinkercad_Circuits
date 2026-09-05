/**
 * One-way channel from interactive part art into the running simulation.
 *
 * Art components fire user gestures (button press, knob drag, light slider)
 * here rather than into React state, so an interaction never triggers a
 * document mutation or a re-render — the solver picks it up on its next tick.
 */

export interface SimInteraction {
  partId: string;
  event: string;
  value?: number | boolean;
}

type Listener = (e: SimInteraction) => void;

class SimBus {
  private listeners = new Set<Listener>();
  private queue: SimInteraction[] = [];

  emit(e: SimInteraction) {
    this.queue.push(e);
    for (const l of this.listeners) l(e);
  }

  on(l: Listener) {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  /** Drain everything queued since the last call. */
  drain(): SimInteraction[] {
    const q = this.queue;
    this.queue = [];
    return q;
  }

  clear() {
    this.queue = [];
  }
}

export const simBus = new SimBus();
