'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { EditorRoot } from '@/editor/EditorRoot';

/**
 * The editor is one static page addressed by `?id=`, rather than a dynamic
 * `/editor/[id]` route. That keeps the whole app a static export with no
 * server rendering — which is what lets it be served from a file share, or
 * opened offline once cached.
 */
function EditorWithId() {
  const id = useSearchParams().get('id') ?? undefined;
  return <EditorRoot designId={id} />;
}

export default function EditorPage() {
  return (
    <Suspense fallback={<div className="h-full w-full bg-neutral-50" />}>
      <EditorWithId />
    </Suspense>
  );
}
