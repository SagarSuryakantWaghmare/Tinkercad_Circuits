import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useDesignStore } from '../designStore';
import { emptyDesign } from '../design';

const store = () => useDesignStore.getState();

/** Set a part's property the way the inspector and the on-part knobs do. */
const setProp = (id: string, key: string, value: number) =>
  store().transact(
    'Change property',
    (d) => {
      const p = d.parts[id];
      if (p) p.props[key] = value;
    },
    `prop:${id}:${key}`,
  );

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  store().load(emptyDesign('test'));
  store().transact('Add', (d) => {
    d.parts.p1 = {
      id: 'p1', type: 'resistor', x: 0, y: 0, rotation: 0,
      mirrored: false, props: { v: 0 }, z: 0,
    } as never;
    d.parts.p2 = {
      id: 'p2', type: 'resistor', x: 0, y: 0, rotation: 0,
      mirrored: false, props: { v: 0 }, z: 0,
    } as never;
  });
});

describe('history coalescing', () => {
  it('folds a slider drag into one undo step', () => {
    const before = store().past.length;
    // What one drag of a 0..255 slider actually emits.
    for (let v = 1; v <= 200; v++) {
      vi.advanceTimersByTime(2);
      setProp('p1', 'v', v);
    }
    expect(store().past.length).toBe(before + 1);
    expect(store().design.parts.p1.props.v).toBe(200);

    // And undo returns to before the drag, not to the 199th sample of it.
    store().undo();
    expect(store().design.parts.p1.props.v).toBe(0);
  });

  it('does not let a drag flush the rest of the history', () => {
    for (let i = 0; i < 30; i++) {
      vi.advanceTimersByTime(1000);
      store().transact('Move', (d) => void (d.parts.p1.x += 1));
    }
    const placements = store().past.length;

    vi.advanceTimersByTime(1000);
    for (let v = 1; v <= 200; v++) {
      vi.advanceTimersByTime(2);
      setProp('p1', 'v', v);
    }

    // The 30 earlier steps survive; the drag added exactly one.
    expect(store().past.length).toBe(placements + 1);
  });

  it('keeps edits to different parts and properties apart', () => {
    const before = store().past.length;
    setProp('p1', 'v', 1);
    setProp('p2', 'v', 1); // different part
    setProp('p1', 'w', 1); // different property
    expect(store().past.length).toBe(before + 3);
  });

  it('starts a new step once the run goes quiet', () => {
    const before = store().past.length;
    setProp('p1', 'v', 1);
    vi.advanceTimersByTime(5000);
    setProp('p1', 'v', 2);
    expect(store().past.length).toBe(before + 2);
  });

  it('records every edit that carries no key, as before', () => {
    const before = store().past.length;
    for (let i = 0; i < 5; i++) store().transact('Move', (d) => void (d.parts.p1.x += 1));
    expect(store().past.length).toBe(before + 5);
  });

  it('does not fold a fresh edit into the step it just undid', () => {
    setProp('p1', 'v', 7);
    store().undo();
    const after = store().past.length;
    setProp('p1', 'v', 9);
    expect(store().past.length).toBe(after + 1);
  });
});
