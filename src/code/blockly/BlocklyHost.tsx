'use client';

import { useEffect, useRef } from 'react';
import * as Blockly from 'blockly/core';
import 'blockly/blocks';
import * as En from 'blockly/msg/en';
import { defineBlocks } from './blocks';
import { defineMicrobitBlocks } from './microbitBlocks';
import { generateSketch } from './generator';
import { generateMicropython } from './pythonGenerator';
import { DEFAULT_WORKSPACE, TOOLBOX } from './toolbox';
import { MICROBIT_DEFAULT_WORKSPACE, MICROBIT_TOOLBOX } from './microbitToolbox';
import type { CodeLanguage } from '@/state/design';

let initialised = false;
function initOnce() {
  if (initialised) return;
  Blockly.setLocale(En as unknown as Record<string, string>);
  // Both sets are defined once; the toolbox decides which are offered, and the
  // generic Control/Math/Variables blocks are shared by both languages.
  defineBlocks();
  defineMicrobitBlocks();
  initialised = true;
}

/** Light theme matched to the editor chrome. */
const theme = Blockly.Theme.defineTheme('circuitlab', {
  name: 'circuitlab',
  base: Blockly.Themes.Classic,
  componentStyles: {
    workspaceBackgroundColour: '#f7f8fa',
    toolboxBackgroundColour: '#ffffff',
    toolboxForegroundColour: '#374151',
    flyoutBackgroundColour: '#f2f4f7',
    flyoutForegroundColour: '#374151',
    flyoutOpacity: 1,
    scrollbarColour: '#cbd0d6',
    insertionMarkerColour: '#3b8ed7',
    insertionMarkerOpacity: 0.4,
    cursorColour: '#3b8ed7',
  },
  fontStyle: { family: 'ui-sans-serif, system-ui, sans-serif', size: 11 },
});

export function BlocklyHost({
  xml,
  onChange,
  language = 'arduino',
  readOnly = false,
}: {
  xml: string;
  onChange: (state: { xml: string; code: string }) => void;
  language?: CodeLanguage;
  readOnly?: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const wsRef = useRef<Blockly.WorkspaceSvg | null>(null);
  const onChangeRef = useRef(onChange);
  // Keep the latest callback reachable from the long-lived editor instance
  // without tearing it down on every render.
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    initOnce();
    const el = host.current;
    if (!el) return;

    const micro = language === 'micropython';
    const ws = Blockly.inject(el, {
      toolbox: micro ? MICROBIT_TOOLBOX : TOOLBOX,
      theme,
      readOnly,
      renderer: 'zelos',
      trashcan: true,
      sounds: false,
      zoom: { controls: true, wheel: true, startScale: 0.85, minScale: 0.4, maxScale: 2 },
      grid: { spacing: 24, length: 2, colour: '#e3e6ea', snap: true },
      move: { scrollbars: true, drag: true, wheel: true },
    });
    wsRef.current = ws;

    // Load the saved workspace, or seed the blink example on a fresh design.
    const seed = micro ? MICROBIT_DEFAULT_WORKSPACE : DEFAULT_WORKSPACE;
    try {
      Blockly.serialization.workspaces.load(xml ? JSON.parse(xml) : seed, ws);
    } catch {
      Blockly.serialization.workspaces.load(seed, ws);
    }

    const emit = () => {
      const state = JSON.stringify(Blockly.serialization.workspaces.save(ws));
      onChangeRef.current({
        xml: state,
        code: micro ? generateMicropython(ws) : generateSketch(ws),
      });
    };

    const listener = (e: Blockly.Events.Abstract) => {
      // Only structural edits change the program.
      if (e.isUiEvent) return;
      if (ws.isDragging()) return;
      emit();
    };
    ws.addChangeListener(listener);
    // Publish the initial program so the sketch and the blocks start in sync.
    emit();

    const ro = new ResizeObserver(() => Blockly.svgResize(ws));
    ro.observe(el);

    return () => {
      ro.disconnect();
      ws.removeChangeListener(listener);
      ws.dispose();
      wsRef.current = null;
    };
    // The workspace owns its state after mount; `xml` is only the seed. A
    // language change rebuilds it, which is what swaps the toolbox.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly, language]);

  return <div ref={host} className="h-full w-full" />;
}
