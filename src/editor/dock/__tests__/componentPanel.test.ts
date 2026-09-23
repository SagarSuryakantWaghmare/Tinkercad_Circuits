import { describe, expect, it } from 'vitest';

import '@/parts';
import { allParts } from '@/parts/registry';
import { groupByCategory } from '../ComponentPanel';

describe('groupByCategory', () => {
  it('lists every part exactly once', () => {
    const parts = allParts();
    const listed = groupByCategory(parts).flatMap((g) => g.items.map((p) => p.id));

    const seen = new Map<string, number>();
    for (const id of listed) seen.set(id, (seen.get(id) ?? 0) + 1);
    const twice = [...seen].filter(([, n]) => n > 1).map(([id]) => id);

    // The 74 series ICs each declare an altCategories of 'logic' alongside
    // their primary 'ics', and grouping by every declared category put them
    // under both headings of the same list.
    expect(twice).toEqual([]);
    expect(listed.length).toBe(parts.length);
  });

  it('keeps a part under its primary category', () => {
    const withAlt = allParts().find((p) => (p.altCategories?.length ?? 0) > 0);
    expect(withAlt).toBeDefined();

    const groups = groupByCategory([withAlt!]);
    expect(groups).toHaveLength(1);
    expect(groups[0].items.map((p) => p.id)).toEqual([withAlt!.id]);
  });
});
