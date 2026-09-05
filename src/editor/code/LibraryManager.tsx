'use client';

import { useDesignStore } from '@/state/designStore';

/** The libraries the interpreter implements natively. */
export const LIBRARIES = [
  { id: 'Servo', header: 'Servo.h', blurb: 'Positional and continuous-rotation servo control.' },
  { id: 'LiquidCrystal', header: 'LiquidCrystal.h', blurb: 'Character LCDs on a 4- or 8-bit parallel bus.' },
  { id: 'Adafruit_LiquidCrystal', header: 'Adafruit_LiquidCrystal.h', blurb: 'Character LCDs over I²C or SPI.' },
  { id: 'Adafruit_NeoPixel', header: 'Adafruit_NeoPixel.h', blurb: 'Addressable WS2812 pixels, rings and strips.' },
  { id: 'SoftwareSerial', header: 'SoftwareSerial.h', blurb: 'A second serial port on any pair of pins.' },
  { id: 'Wire', header: 'Wire.h', blurb: 'I²C communication.' },
  { id: 'SPI', header: 'SPI.h', blurb: 'Serial Peripheral Interface.' },
  { id: 'EEPROM', header: 'EEPROM.h', blurb: '1 KB of non-volatile storage.' },
  { id: 'Stepper', header: 'Stepper.h', blurb: 'Unipolar and bipolar stepper motors.' },
  { id: 'TimerOne', header: 'TimerOne.h', blurb: 'Timer1 interrupts and PWM.' },
  { id: 'IRremote', header: 'IRremote.h', blurb: 'Send and receive infrared remote codes.' },
];

export function LibraryManager({ onClose }: { onClose: () => void }) {
  const libraries = useDesignStore((s) => s.design.code.libraries);
  const transact = useDesignStore((s) => s.transact);

  const toggle = (id: string, header: string) =>
    transact('Libraries', (d) => {
      const has = d.code.libraries.includes(id);
      d.code.libraries = has
        ? d.code.libraries.filter((l) => l !== id)
        : [...d.code.libraries, id];

      const include = `#include <${header}>`;
      if (has) {
        d.code.text = d.code.text
          .split('\n')
          .filter((l) => l.trim() !== include)
          .join('\n');
      } else if (!d.code.text.includes(include)) {
        d.code.text = `${include}\n${d.code.text}`;
      }
    });

  return (
    <div
      className="absolute inset-0 z-20 flex items-center justify-center bg-neutral-900/25 p-6"
      onClick={onClose}
    >
      <div
        className="flex max-h-full w-[460px] flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-neutral-200 px-4 py-2.5">
          <div>
            <h2 className="text-[13px] font-semibold text-neutral-900">Libraries</h2>
            <p className="text-[11.5px] text-neutral-500">
              Including one adds its <code className="font-mono">#include</code> to your sketch.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded px-2 py-1 text-[12px] text-neutral-500 hover:bg-neutral-100"
          >
            Done
          </button>
        </header>
        <ul className="min-h-0 flex-1 divide-y divide-neutral-100 overflow-auto">
          {LIBRARIES.map((lib) => {
            const on = libraries.includes(lib.id);
            return (
              <li key={lib.id} className="flex items-start gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-medium text-neutral-800">{lib.id}</p>
                  <p className="text-[11.5px] text-neutral-500">{lib.blurb}</p>
                  <code className="font-mono text-[11px] text-neutral-400">
                    #include &lt;{lib.header}&gt;
                  </code>
                </div>
                <button
                  onClick={() => toggle(lib.id, lib.header)}
                  className={`shrink-0 rounded-md border px-2.5 py-1 text-[11.5px] font-medium transition ${
                    on
                      ? 'border-sky-500 bg-sky-50 text-sky-700'
                      : 'border-neutral-300 text-neutral-700 hover:bg-neutral-50'
                  }`}
                >
                  {on ? 'Included' : 'Include'}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
