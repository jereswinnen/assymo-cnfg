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
    const meta = getBuildingKindMeta('poort');
    expect(meta.tray).toBe('primitive');
    expect([...meta.requiredCategories]).toEqual(['gate']);
    expect(meta.productable).toBe(true);
    expect(meta.snapKind).toBe('wall');
    expect(meta.material.category).toBe('gate');
    expect(meta.material.kind).toBe('gate');
    expect(meta.dimensions).toEqual({
      width: true,
      depth: false,
      height: true,
      heightSource: 'override',
      orientation: true,
    });
    expect([...meta.sections]).toEqual(['dimensions', 'material', 'gate', 'quote']);
  });

  it('describes overkapping as a productable structural with wall+roof-cover+floor categories', () => {
    const meta = getBuildingKindMeta('overkapping');
    expect(meta.tray).toBe('structural');
    expect(meta.productable).toBe(true);
    expect(meta.snapKind).toBe('structural');
    expect([...meta.requiredCategories]).toEqual(['wall', 'roof-cover', 'floor']);
    expect(meta.material).toEqual({ category: 'wall', kind: 'building' });
    expect(meta.dimensions).toEqual({
      width: true,
      depth: true,
      height: true,
      heightSource: 'default',
      orientation: false,
    });
    expect([...meta.sections]).toEqual(['dimensions', 'material', 'structure', 'quote']);
  });

  it('every kind declares a material descriptor + dimensions + sections', () => {
    for (const t of ALL_TYPES) {
      const meta = getBuildingKindMeta(t);
      expect(meta.material).toBeDefined();
      expect(meta.material.category).toBeDefined();
      expect(['building', 'gate']).toContain(meta.material.kind);
      expect(meta.dimensions).toBeDefined();
      expect(meta.sections.length).toBeGreaterThan(0);
    }
  });

  it('paal exposes only the height axis with override storage', () => {
    expect(getBuildingKindMeta('paal').dimensions).toEqual({
      width: false,
      depth: false,
      height: true,
      heightSource: 'override',
      orientation: false,
    });
  });

  it('muur and poort expose width + height with orientation toggle', () => {
    expect(getBuildingKindMeta('muur').dimensions.orientation).toBe(true);
    expect(getBuildingKindMeta('poort').dimensions.orientation).toBe(true);
    expect(getBuildingKindMeta('muur').dimensions.heightSource).toBe('override');
    expect(getBuildingKindMeta('poort').dimensions.heightSource).toBe('override');
  });

  it('structural kinds share a scene-default height (heightSource=default)', () => {
    expect(getBuildingKindMeta('overkapping').dimensions.heightSource).toBe('default');
    expect(getBuildingKindMeta('berging').dimensions.heightSource).toBe('default');
  });

  it('keeps the registry frozen at the type level (as const)', () => {
    // @ts-expect-error — registry entries are readonly literal types
    BUILDING_KIND_META.poort.tray = 'structural';
  });
});
