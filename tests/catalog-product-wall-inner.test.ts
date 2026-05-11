import { describe, it, expect } from 'vite-plus/test';
import { applyProductDefaults, validateProductCreate } from '@/domain/catalog';
import type { ProductRow, MaterialRow } from '@/domain/catalog';

function makeProduct(extras: Partial<ProductRow> = {}): ProductRow {
  return {
    id: 'p1', tenantId: 't1', kind: 'berging', slug: 'std', name: 'Std',
    description: null,
    heroImage: null, basePriceCents: 0, sortOrder: 0,
    archivedAt: null, createdAt: '2026-01-01', updatedAt: '2026-01-01',
    defaults: { materials: { wallCladding: 'wood', wallCladdingInner: 'osb' } },
    constraints: {},
    ...extras,
  };
}

function makeMaterial(slug: string, category: 'wall' | 'roof-cover' = 'wall'): MaterialRow {
  return {
    id: `m-${slug}`, tenantId: 't1', categories: [category], slug, name: slug,
    color: '#888', textures: null, tileSize: null,
    pricing: category === 'wall' ? { wall: { perSqm: 50 } } : { 'roof-cover': { perSqm: 30 } },
    flags: {},
    archivedAt: null,
    createdAt: '2026-01-01', updatedAt: '2026-01-01',
  };
}

describe('applyProductDefaults — inner cladding', () => {
  it('surfaces wallCladdingInner on the returned defaults', () => {
    const out = applyProductDefaults(makeProduct());
    expect(out.materialIdInner).toBe('osb');
  });

  it('returns no inner field when the product omits wallCladdingInner', () => {
    const p = makeProduct();
    delete p.defaults.materials!.wallCladdingInner;
    const out = applyProductDefaults(p);
    expect(out.materialIdInner).toBeUndefined();
  });
});

describe('validateProductCreate — inner cladding', () => {
  it('accepts wallCladdingInner as a valid slot (slug passes slot-name check)', () => {
    const r = validateProductCreate(
      {
        kind: 'berging', slug: 'p', name: 'P', basePriceCents: 0,
        defaults: { materials: { wallCladdingInner: 'osb' } }, constraints: {},
      },
      [makeMaterial('osb', 'wall')],
    );
    // The slot-name iterator accepts 'wallCladdingInner' as a known ProductSlot.
    // Material-category cross-checking for non-poort slots is DB-enforced.
    expect(r.ok).toBe(true);
  });

  it('rejects an unknown slot name in defaults.materials', () => {
    const r = validateProductCreate(
      {
        kind: 'berging', slug: 'p', name: 'P', basePriceCents: 0,
        defaults: { materials: { unknownSlot: 'osb' } as never }, constraints: {},
      },
      [],
    );
    expect(r.ok).toBe(false);
  });
});
