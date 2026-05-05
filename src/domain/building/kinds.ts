import type { MaterialCategory } from '@/domain/catalog';
import type { BuildingType } from './types';

export type BuildingTray = 'primitive' | 'structural';
export type SnapKind = 'pole' | 'wall' | 'structural';

/** Sidebar accordion sections. The labels and components for each
 *  section live in `ConfigureTab`; this enum is the contract the
 *  registry uses to declare visibility per kind. */
export type ConfigSection =
  | 'dimensions'
  | 'material'
  | 'dak'
  | 'structure'
  | 'walls'
  | 'gate'
  | 'quote';

/** Discriminant for the universal Material picker. Each kind stores its
 *  material in one of two places — extend the union if a future kind
 *  needs a third storage path. The store's `setEntityMaterial` action
 *  consumes this directly. */
export type MaterialBindingKind = 'building' | 'gate';

export interface BuildingKindMeta {
  tray: BuildingTray;
  snapKind: SnapKind;
  productable: boolean;
  requiredCategories: readonly MaterialCategory[];
  /** Drives the universal sidebar Material picker. */
  material: {
    /** Catalog category the picker uses (and the spawn-time default
     *  lookup keys against). */
    category: MaterialCategory;
    /** Where on the entity the selection is stored. */
    kind: MaterialBindingKind;
  };
  /** Drives the universal sidebar Dimensions picker — which axes are
   *  exposed for this kind, where the height value is stored (scene-default
   *  vs per-building override), and whether an orientation toggle (horizontal
   *  vs vertical) applies. Constraints (min/max) come from `getConstraints(type)`
   *  and product overrides as today. */
  dimensions: {
    width: boolean;
    depth: boolean;
    height: boolean;
    /** `'default'` writes through `setDefaultHeight` (scene-level); `'override'`
     *  writes through `setHeightOverride` (per-building). Reflects today's
     *  behaviour: structural kinds share a scene-default; primitives have
     *  per-instance heights. */
    heightSource: 'default' | 'override';
    /** Show the horizontal/vertical orientation toggle (today: muur + poort). */
    orientation: boolean;
  };
  /** Sidebar accordion sections this kind shows, in order. */
  sections: readonly ConfigSection[];
}

export const BUILDING_KIND_META = {
  overkapping: {
    tray: 'structural',
    snapKind: 'structural',
    productable: true,
    requiredCategories: ['wall', 'roof-cover', 'floor'],
    material: { category: 'wall', kind: 'building' },
    dimensions: { width: true, depth: true, height: true, heightSource: 'default', orientation: false },
    sections: ['dimensions', 'material', 'dak', 'structure', 'quote'],
  },
  berging: {
    tray: 'structural',
    snapKind: 'structural',
    productable: true,
    requiredCategories: ['wall', 'roof-cover', 'floor', 'door'],
    material: { category: 'wall', kind: 'building' },
    dimensions: { width: true, depth: true, height: true, heightSource: 'default', orientation: false },
    sections: ['dimensions', 'material', 'dak', 'structure', 'walls', 'quote'],
  },
  paal: {
    tray: 'primitive',
    snapKind: 'pole',
    productable: false,
    requiredCategories: ['wall'],
    material: { category: 'wall', kind: 'building' },
    dimensions: { width: false, depth: false, height: true, heightSource: 'override', orientation: false },
    sections: ['dimensions', 'material', 'structure', 'quote'],
  },
  muur: {
    tray: 'primitive',
    snapKind: 'wall',
    productable: false,
    requiredCategories: ['wall'],
    material: { category: 'wall', kind: 'building' },
    dimensions: { width: true, depth: false, height: true, heightSource: 'override', orientation: true },
    sections: ['dimensions', 'material', 'structure', 'walls', 'quote'],
  },
  poort: {
    tray: 'primitive',
    snapKind: 'wall',
    productable: true,
    requiredCategories: ['gate'],
    material: { category: 'gate', kind: 'gate' },
    dimensions: { width: true, depth: false, height: true, heightSource: 'override', orientation: true },
    sections: ['dimensions', 'material', 'gate', 'quote'],
  },
} as const satisfies Record<BuildingType, BuildingKindMeta>;

export function getBuildingKindMeta(type: BuildingType): BuildingKindMeta {
  return BUILDING_KIND_META[type];
}
