'use client';

import { getPartDef } from '@/parts/registry';
import { originOf, sizeOf } from '@/parts/types';
import { migrateDesign, type Design } from '@/state/design';
import { transformedBounds, unionRect, type Rect } from '@/lib/geometry';

/** Trigger a browser download for a blob. */
function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const safeName = (s: string) => s.replace(/[^\w\-. ]+/g, '_').trim() || 'circuit';

// ─── Native format ───────────────────────────────────────────────────────────

export function exportDesignJson(design: Design) {
  download(
    new Blob([JSON.stringify(design, null, 2)], { type: 'application/json' }),
    `${safeName(design.name)}.circuit.json`,
  );
}

export async function importDesignJson(file: File): Promise<Design> {
  const text = await file.text();
  const parsed = JSON.parse(text) as Design;
  if (!parsed || typeof parsed !== 'object' || !parsed.parts) {
    throw new Error('That file is not a CircuitLab design.');
  }
  return migrateDesign(parsed);
}

// ─── Sketch ──────────────────────────────────────────────────────────────────

export function exportSketch(design: Design) {
  download(new Blob([design.code.text], { type: 'text/plain' }), `${safeName(design.name)}.ino`);
}

// ─── Component list ──────────────────────────────────────────────────────────

/** Bill of materials, grouped by part type and key properties. */
export function componentList(design: Design) {
  const rows = new Map<string, { name: string; detail: string; count: number }>();
  for (const id in design.parts) {
    const inst = design.parts[id];
    const def = getPartDef(inst.type);
    if (!def) continue;
    const detail = (def.props ?? [])
      .map((p) => `${p.label}: ${inst.props[p.key]}`)
      .join('; ');
    const key = `${def.name}|${detail}`;
    const row = rows.get(key);
    if (row) row.count++;
    else rows.set(key, { name: def.name, detail, count: 1 });
  }
  return [...rows.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function exportComponentCsv(design: Design) {
  const rows = componentList(design);
  const csv = [
    'Quantity,Component,Details',
    ...rows.map((r) => `${r.count},"${r.name}","${r.detail.replace(/"/g, '""')}"`),
  ].join('\n');
  download(new Blob([csv], { type: 'text/csv' }), `${safeName(design.name)}-components.csv`);
}

// ─── Images ──────────────────────────────────────────────────────────────────

function contentBounds(design: Design): Rect | null {
  let box: Rect | null = null;
  for (const id in design.parts) {
    const inst = design.parts[id];
    const def = getPartDef(inst.type);
    if (!def) continue;
    box = unionRect(
      box,
      transformedBounds(
        sizeOf(def, inst.props as never),
        originOf(def, inst.props as never),
        { x: inst.x, y: inst.y },
        inst.rotation,
        inst.mirrored,
      ),
    );
  }
  return box;
}

/**
 * Snapshot the live canvas.
 *
 * The scene is already SVG, so exporting is a matter of cloning the scene
 * group into a standalone document sized to the design's bounding box — no
 * re-rendering, and the output is resolution-independent.
 */
export function canvasSvg(design: Design, pad = 40): string | null {
  const source = document.querySelector<SVGSVGElement>('svg.circuitlab-canvas');
  if (!source) return null;
  const scene = source.querySelector<SVGGElement>('g[data-scene]');
  if (!scene) return null;

  const b = contentBounds(design);
  if (!b) return null;

  const clone = scene.cloneNode(true) as SVGGElement;
  clone.removeAttribute('transform');
  // Drop interaction-only layers from the export.
  clone.querySelectorAll('[data-export="false"]').forEach((n) => n.remove());

  const x = b.x - pad;
  const y = b.y - pad;
  const w = b.w + pad * 2;
  const h = b.h + pad * 2;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(w)}" height="${Math.round(h)}"`,
    ` viewBox="${x} ${y} ${w} ${h}">`,
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#ffffff"/>`,
    clone.outerHTML,
    '</svg>',
  ].join('');
}

export function exportSvg(design: Design) {
  const svg = canvasSvg(design);
  if (!svg) throw new Error('Nothing to export yet — place a component first.');
  download(new Blob([svg], { type: 'image/svg+xml' }), `${safeName(design.name)}.svg`);
}

export async function renderPng(design: Design, scale = 2): Promise<Blob> {
  const svg = canvasSvg(design);
  if (!svg) throw new Error('Nothing to export yet — place a component first.');

  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Could not rasterise the canvas.'));
    img.src = url;
  });

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG encoding failed.'))), 'image/png');
  });
}

export async function exportPng(design: Design) {
  download(await renderPng(design), `${safeName(design.name)}.png`);
}

/** Small data-URI thumbnail for the dashboard. */
export async function makeThumbnail(design: Design): Promise<string | undefined> {
  try {
    const svg = canvasSvg(design, 20);
    if (!svg) return undefined;
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('thumb'));
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    });
    const canvas = document.createElement('canvas');
    const targetW = 320;
    const ratio = img.height / Math.max(1, img.width);
    canvas.width = targetW;
    canvas.height = Math.max(1, Math.round(targetW * ratio));
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#f4f5f6';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/webp', 0.7);
  } catch {
    return undefined;
  }
}
