import { describe, it, expect } from 'vite-plus/test';
import { filterTrayEntries } from '@/lib/tray';
import { BUILDING_KIND_META } from '@/domain/building/kinds';
import type { MaterialCategory } from '@/domain/catalog';

const ALL: ReadonlySet<MaterialCategory> = new Set([
  'wall',
  'roof-cover',
  'roof-trim',
  'floor',
  'door',
  'gate',
]);

describe('filterTrayEntries', () => {
  it('shows all five entries when every category is available', () => {
    const { primitives, structurals } = filterTrayEntries(BUILDING_KIND_META, ALL);
    const primTypes = primitives.map((e) => e.type).sort();
    const structTypes = structurals.map((e) => e.type).sort();
    expect(primTypes).toEqual(['muur', 'paal', 'poort']);
    expect(structTypes).toEqual(['berging', 'overkapping']);
  });

  it('drops poort when gate materials are absent', () => {
    const without = new Set<MaterialCategory>(['wall', 'roof-cover', 'roof-trim', 'floor', 'door']);
    const { primitives } = filterTrayEntries(BUILDING_KIND_META, without);
    expect(primitives.map((e) => e.type).sort()).toEqual(['muur', 'paal']);
  });

  it('drops every primitive (paal/muur/poort) when wall+gate are absent', () => {
    const noWallNoGate = new Set<MaterialCategory>(['roof-cover', 'roof-trim', 'floor', 'door']);
    const { primitives, structurals } = filterTrayEntries(BUILDING_KIND_META, noWallNoGate);
    expect(primitives).toEqual([]);
    expect(structurals.map((e) => e.type).sort()).toEqual([]);
  });

  it('drops berging when door is absent but keeps overkapping', () => {
    const noDoor = new Set<MaterialCategory>(['wall', 'roof-cover', 'roof-trim', 'floor', 'gate']);
    const { structurals } = filterTrayEntries(BUILDING_KIND_META, noDoor);
    expect(structurals.map((e) => e.type)).toEqual(['overkapping']);
  });
});
