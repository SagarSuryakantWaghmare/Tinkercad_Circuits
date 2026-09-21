import { MCU_KEY, type McuHandle } from './mcu';
import type { DeviceCtx } from './types';

/**
 * Which Arduino pin a part's terminal is wired to, if any.
 *
 * Parts know the net their signal wire lands on, not the pin number. The MCU
 * publishes a net → pin map each step, so a servo, an LCD or a NeoPixel strip
 * can find the pin that drives it without either side knowing about the other.
 */
export function mcuPinOf(ctx: DeviceCtx, terminal: string): number | null {
  const h = ctx.shared.get(MCU_KEY) as McuHandle | undefined;
  if (!h) return null;
  const node = ctx.node(terminal);
  if (node === -1) return null;
  const pin = h.netToPin.get(node);
  return pin === undefined ? null : pin;
}

export function mcuHandle(ctx: DeviceCtx): McuHandle | undefined {
  return ctx.shared.get(MCU_KEY) as McuHandle | undefined;
}

/**
 * Find the library peripheral this part is wired to, by matching the pins its
 * terminals land on against the pins the library object was constructed with.
 */
export function findPeripheral<T extends { pins: number[] }>(
  ctx: DeviceCtx,
  prefix: string,
  terminals: string[],
): T | null {
  const h = mcuHandle(ctx);
  if (!h) return null;

  const wired = new Set<number>();
  for (const t of terminals) {
    const p = mcuPinOf(ctx, t);
    if (p !== null) wired.add(p);
  }
  if (wired.size > 0) {
    let best: { obj: T; score: number } | null = null;
    h.board.peripherals.forEach((value, key) => {
      if (!key.startsWith(prefix)) return;
      const obj = value as T;
      if (!Array.isArray(obj.pins)) return;
      const score = obj.pins.filter((p) => wired.has(p)).length;
      if (score > 0 && (!best || score > best.score)) best = { obj, score };
    });

    if (best) return (best as { obj: T }).obj;
  }

  // If a series resistor or breadboard separates the net from the MCU pin,
  // fall back to the peripheral prefix — but only when there is exactly one
  // candidate, otherwise Map insertion order would silently decide which
  // device to bind.
  let onlyMatch: T | null = null;
  let matches = 0;
  for (const [key, value] of h.board.peripherals.entries()) {
    if (!key.startsWith(prefix)) continue;
    matches += 1;
    if (matches > 1) return null;
    onlyMatch = value as T;
  }
  return onlyMatch;
}
