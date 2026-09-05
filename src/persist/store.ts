'use client';

import { del, get, keys, set } from 'idb-keyval';
import type { Design } from '@/state/design';

/**
 * Local-first storage. Designs live in IndexedDB in this browser — there is no
 * server in this build — with a small index kept alongside so the dashboard can
 * list them without deserialising every document.
 */

const KEY = (id: string) => `design:${id}`;
const INDEX = 'design-index';

export interface DesignSummary {
  id: string;
  name: string;
  updatedAt: number;
  createdAt: number;
  parts: number;
  wires: number;
  /** Data-URI thumbnail of the canvas, refreshed on save. */
  thumbnail?: string;
}

export async function saveDesign(design: Design, thumbnail?: string) {
  await set(KEY(design.id), design);
  const index = await loadIndex();
  const summary: DesignSummary = {
    id: design.id,
    name: design.name,
    updatedAt: design.updatedAt,
    createdAt: design.createdAt,
    parts: Object.keys(design.parts).length,
    wires: Object.keys(design.wires).length,
    thumbnail: thumbnail ?? index.find((d) => d.id === design.id)?.thumbnail,
  };
  const next = [summary, ...index.filter((d) => d.id !== design.id)];
  await set(INDEX, next);
}

export async function loadDesign(id: string): Promise<Design | undefined> {
  return (await get<Design>(KEY(id))) ?? undefined;
}

export async function loadIndex(): Promise<DesignSummary[]> {
  const list = (await get<DesignSummary[]>(INDEX)) ?? [];
  return [...list].sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function deleteDesign(id: string) {
  await del(KEY(id));
  await set(INDEX, (await loadIndex()).filter((d) => d.id !== id));
}

/** Rebuild the index from the raw keys — recovery if the index is ever lost. */
export async function rebuildIndex(): Promise<DesignSummary[]> {
  const ks = (await keys()) as string[];
  const summaries: DesignSummary[] = [];
  for (const k of ks) {
    if (typeof k !== 'string' || !k.startsWith('design:')) continue;
    const d = await get<Design>(k);
    if (!d) continue;
    summaries.push({
      id: d.id,
      name: d.name,
      updatedAt: d.updatedAt,
      createdAt: d.createdAt,
      parts: Object.keys(d.parts).length,
      wires: Object.keys(d.wires).length,
    });
  }
  await set(INDEX, summaries);
  return summaries;
}
