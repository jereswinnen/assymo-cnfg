import type { MaterialCategory } from '@/domain/catalog';
import type { BuildingType } from './types';

export type BuildingTray = 'primitive' | 'structural';
export type SnapKind = 'pole' | 'wall' | 'structural';

/** Describes where a kind's "primary material" lives on the entity, so the
 *  universal sidebar Material picker can read/write it without branching on
 *  type. New kinds declare a binding here instead of forking the picker. */
export type PrimaryMaterialBinding =
  /** Stored at `building.primaryMaterialId`; walls/doors/poles/fascia inherit
   *  from it. Mutated via `setBuildingPrimaryMaterial`. */
  | { source: 'primaryMaterialId' }
  /** Stored at `building.gateConfig.materialId`. Mutated via
   *  `updateGateConfig({ materialId })`. */
  | { source: 'gateConfig.materialId' };

export interface BuildingKindMeta {
  tray: BuildingTray;
  requiredCategories: readonly MaterialCategory[];
  productable: boolean;
  snapKind: SnapKind;
  /** Drives the universal sidebar Material picker. Each kind declares one
   *  category (which catalog the picker shows) and one binding (which entity
   *  field stores the selection). */
  primaryMaterial: {
    category: MaterialCategory;
    binding: PrimaryMaterialBinding;
  };
}

export const BUILDING_KIND_META = {
  overkapping: {
    tray: 'structural',
    requiredCategories: ['wall', 'roof-cover', 'floor'],
    productable: true,
    snapKind: 'structural',
    primaryMaterial: { category: 'wall', binding: { source: 'primaryMaterialId' } },
  },
  berging: {
    tray: 'structural',
    requiredCategories: ['wall', 'roof-cover', 'floor', 'door'],
    productable: true,
    snapKind: 'structural',
    primaryMaterial: { category: 'wall', binding: { source: 'primaryMaterialId' } },
  },
  paal: {
    tray: 'primitive',
    requiredCategories: ['wall'],
    productable: false,
    snapKind: 'pole',
    primaryMaterial: { category: 'wall', binding: { source: 'primaryMaterialId' } },
  },
  muur: {
    tray: 'primitive',
    requiredCategories: ['wall'],
    productable: false,
    snapKind: 'wall',
    primaryMaterial: { category: 'wall', binding: { source: 'primaryMaterialId' } },
  },
  poort: {
    tray: 'primitive',
    requiredCategories: ['gate'],
    productable: true,
    snapKind: 'wall',
    primaryMaterial: { category: 'gate', binding: { source: 'gateConfig.materialId' } },
  },
} as const satisfies Record<BuildingType, BuildingKindMeta>;

export function getBuildingKindMeta(type: BuildingType): BuildingKindMeta {
  return BUILDING_KIND_META[type];
}
