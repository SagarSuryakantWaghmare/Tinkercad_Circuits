'use client';

import { useEffect, useRef } from 'react';
import { useDesignStore } from '@/state/designStore';
import { useEditorStore } from '@/state/editorStore';
import { useSimStore } from '@/state/simStore';
import { Simulation } from './Simulation';

/**
 * Bridges the editor and the solver. Start/stop is driven by a window event so
 * the top bar button stays a dumb presentational component, and edits made
 * while the sim is running re-extract the netlist without losing device state.
 */
export function useSimulation() {
  const simRef = useRef<Simulation | null>(null);

  useEffect(() => {
    const start = () => {
      const design = useDesignStore.getState().design;
      const sim = new Simulation(design, {
        onSnapshot: (s) => useSimStore.getState().publish(s),
        onDiagnostics: (errors) => useSimStore.getState().setErrors(errors),
      });
      simRef.current = sim;
      sim.setProtect(useEditorStore.getState().protectComponents);
      if (process.env.NODE_ENV !== 'production') {
        (window as unknown as Record<string, unknown>).__sim = sim;
      }
      useSimStore.getState().reset();
      useSimStore.getState().setRunState('running');
      useEditorStore.getState().clearSelection();
      sim.start();
    };

    const stop = () => {
      simRef.current?.stop();
      simRef.current = null;
      useSimStore.getState().reset();
    };

    const toggle = () => {
      const running = useSimStore.getState().runState;
      if (running === 'idle' || running === 'error') start();
      else stop();
    };

    window.addEventListener('circuitlab:toggle-sim', toggle);

    // Turning protection on mid-run should take effect immediately, so the
    // switch is followed rather than read once at start.
    const unsubscribe = useEditorStore.subscribe((s) =>
      simRef.current?.setProtect(s.protectComponents),
    );

    return () => {
      window.removeEventListener('circuitlab:toggle-sim', toggle);
      unsubscribe();
      simRef.current?.stop();
    };
  }, []);

  // Keep a running simulation in step with document edits.
  const revision = useDesignStore((s) => s.revision);
  useEffect(() => {
    if (!simRef.current) return;
    if (useSimStore.getState().runState !== 'running') return;
    simRef.current.rebuild(useDesignStore.getState().design);
  }, [revision]);

  return simRef;
}
