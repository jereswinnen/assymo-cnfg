import type { MaterialCategory } from '@/domain/catalog';
import type { BuildingType } from './types';

export type BuildingTray = 'primitive' | 'structural';
export type SnapKind = 'pole' | 'wall' | 'structural';

export interface BuildingKindMeta {
  tray: BuildingTray;
  requiredCategories: readonly MaterialCategory[];
  productable: boolean;
  snapKind: SnapKind;
}

export const BUILDING_KIND_META = {
  overkapping: { tray: 'structural', requiredCategories: ['wall', 'roof-cover', 'floor'],         productable: true,  snapKind: 'structural' },
  berging:     { tray: 'structural', requiredCategories: ['wall', 'roof-cover', 'floor', 'door'], productable: true,  snapKind: 'structural' },
  paal:        { tray: 'primitive',  requiredCategories: ['wall'],                                 productable: false, snapKind: 'pole' },
  muur:        { tray: 'primitive',  requiredCategories: ['wall'],                                 productable: false, snapKind: 'wall' },
  poort:       { tray: 'primitive',  requiredCategories: ['gate'],                                 productable: true,  snapKind: 'wall' },
} as const satisfies Record<BuildingType, BuildingKindMeta>;

export function getBuildingKindMeta(type: BuildingType): BuildingKindMeta {
  return BUILDING_KIND_META[type];
}
