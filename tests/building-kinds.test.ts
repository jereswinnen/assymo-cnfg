import { describe, it, expect } from 'vite-plus/test';
import {
  BUILDING_KIND_META,
  getBuildingKindMeta,
  type BuildingType,
} from '@/domain/building';

const ALL_TYPES: BuildingType[] = ['overkapping', 'berging', 'paal', 'muur', 'poort'];

describe('BUILDING_KIND_META', () => {
  it('exposes a meta entry for every BuildingType', () => {
    for (const t of ALL_TYPES) {
      expect(BUILDING_KIND_META[t]).toBeDefined();
    }
  });

  it('describes poort as a productable primitive snapping like a wall, requiring the gate material category', () => {
    expect(getBuildingKindMeta('poort')).toEqual({
      tray: 'primitive',
      requiredCategories: ['gate'],
      productable: true,
      snapKind: 'wall',
    });
  });

  it('describes overkapping as a productable structural with wall+roof-cover+floor categories', () => {
    const meta = getBuildingKindMeta('overkapping');
    expect(meta.tray).toBe('structural');
    expect(meta.productable).toBe(true);
    expect(meta.snapKind).toBe('structural');
    expect([...meta.requiredCategories]).toEqual(['wall', 'roof-cover', 'floor']);
  });

  it('keeps the registry frozen at the type level (as const)', () => {
    // @ts-expect-error — registry entries are readonly literal types
    BUILDING_KIND_META.poort.tray = 'structural';
  });
});
