import type { Design } from '@/state/design';
import type { StarterContent } from './index';

/**
 * Write a starter's parts, wiring and code into a design, replacing the parts
 * and wiring that were there. Shared by the dashboard, which builds a fresh
 * design around it, and the editor, which loads it over the open one.
 */
export function applyStarter(d: Design, name: string, content: StarterContent) {
  d.parts = {};
  d.wires = {};
  for (const p of content.parts) d.parts[p.id] = p;
  for (const w of content.wires) d.wires[w.id] = w;
  if (content.code) {
    d.code.text = content.code;
    d.code.language = 'arduino';
    d.code.mode = 'text';
    d.code.blocksAbandoned = true;
  }
  if (content.python) {
    d.code.python = content.python;
    d.code.language = 'micropython';
    d.code.mode = 'text';
    d.code.blocksAbandoned = true;
  }
  d.name = name;
}
