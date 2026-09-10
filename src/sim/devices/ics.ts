/**
 * Bus-attached chips: an SPI analog-to-digital converter and an I2C EEPROM.
 *
 * Both parts shipped in the catalogue with a `model` that nothing registered,
 * so the netlist listed them and the simulator silently dropped them — you
 * could place one, wire it carefully, and nothing would happen, with nothing
 * to say why. They need a working bus underneath them, which is why
 * `Board.spiTargets` / `i2cTargets` exist.
 */

import { mcuHandle, mcuPinOf } from './resolve';
import { clamp, defineDevice, R_OPEN, type Device } from './types';

// ─── MCP3008: 8-channel, 10-bit SPI ADC ──────────────────────────────────────
//
// The transfer is three bytes: a start byte, a byte selecting the channel, and
// a byte clocked out to collect the result. The chip answers across the second
// and third, which is why the model has to remember where in the sequence it
// is rather than treating each byte alone.

defineDevice('mcp3008', (): Device => {
  let phase = 0;
  let pending = 0;

  return {
    stamp(c, ctx) {
      const agnd = ctx.node('AGND');
      const vdd = ctx.node('VDD');

      // Inputs are high impedance; the chip itself draws a little from VDD.
      c.stampResistance(vdd, ctx.node('DGND'), 8000);
      for (let ch = 0; ch < 8; ch++) {
        c.stampResistance(ctx.node(`CH${ch}`), agnd, R_OPEN);
      }

      const h = mcuHandle(ctx);
      const csPin = mcuPinOf(ctx, 'CS');
      if (!h || csPin === null) return;

      const vref = Math.max(c.v(ctx.node('VREF')) - c.v(agnd), 0.001);

      h.board.spiTargets.set(ctx.partId, {
        csPin,
        transfer: (byte) => {
          if (phase === 0) {
            // Start byte; the chip is still listening, so nothing useful yet.
            phase = 1;
            return 0;
          }
          if (phase === 1) {
            const ch = (byte >> 4) & 7;
            const v = c.v(ctx.node(`CH${ch}`)) - c.v(agnd);
            pending = Math.round(clamp(v / vref, 0, 1) * 1023);
            ctx.s.channel = ch;
            ctx.s.reading = pending;
            phase = 2;
            // The top two bits of a 10-bit result ride in this byte.
            return (pending >> 8) & 0x03;
          }
          phase = 0;
          return pending & 0xff;
        },
      });
    },
    commit(_, ctx) {
      // A transfer only counts while CS is held low. Releasing it abandons any
      // half-finished sequence, exactly as the real chip does.
      const h = mcuHandle(ctx);
      const csPin = mcuPinOf(ctx, 'CS');
      if (!h || csPin === null) return;
      const d = h.board.drive(csPin);
      if (!d || d.v >= 2.5) phase = 0;
    },
    output(_, ctx) {
      return {
        channel: ctx.s.channel ?? 0,
        reading: ctx.s.reading ?? 0,
      };
    },
  };
});

// ─── 24LC256: 32 KB I2C EEPROM ───────────────────────────────────────────────
//
// Addressed by a 16-bit word address sent as the first two bytes of a write.
// A write with only those two bytes sets the pointer for a following read,
// which is how the part is used to read back what was stored.

const EEPROM_SIZE = 32768;

defineDevice('eeprom', (): Device => {
  const cells = new Uint8Array(EEPROM_SIZE);
  let pointer = 0;

  return {
    stamp(c, ctx) {
      c.stampResistance(ctx.node('VCC'), ctx.node('VSS'), 20000);

      const h = mcuHandle(ctx);
      if (!h) return;

      // A0–A2 select the low three bits of the address, so eight of these can
      // share one bus. A pin left unwired reads as grounded, which is what a
      // real board would do with a pull-down.
      const vss = c.v(ctx.node('VSS'));
      const high = (t: string) => c.v(ctx.node(t)) - vss > 2.5;
      const addr = 0x50 | (high('A0') ? 1 : 0) | (high('A1') ? 2 : 0) | (high('A2') ? 4 : 0);
      ctx.s.address = addr;

      const writeProtected = high('WP');
      ctx.s.writeProtected = writeProtected ? 1 : 0;

      h.board.i2cTargets.set(addr, {
        write: (bytes) => {
          if (bytes.length >= 2) {
            pointer = ((bytes[0] << 8) | bytes[1]) % EEPROM_SIZE;
          }
          if (writeProtected) return;
          for (let i = 2; i < bytes.length; i++) {
            cells[pointer] = bytes[i] & 0xff;
            pointer = (pointer + 1) % EEPROM_SIZE;
          }
          ctx.s.writes = (ctx.s.writes ?? 0) + Math.max(0, bytes.length - 2);
        },
        read: (n) => {
          const out: number[] = [];
          for (let i = 0; i < n; i++) {
            out.push(cells[pointer]);
            pointer = (pointer + 1) % EEPROM_SIZE;
          }
          ctx.s.reads = (ctx.s.reads ?? 0) + n;
          return out;
        },
      });
    },
    output(_, ctx) {
      return {
        address: ctx.s.address ?? 0x50,
        writeProtected: (ctx.s.writeProtected ?? 0) === 1,
        bytesWritten: ctx.s.writes ?? 0,
        bytesRead: ctx.s.reads ?? 0,
      };
    },
  };
});
