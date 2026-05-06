import type {
  BuildingEntity,
  Orientation,
  RoofConfig,
  SnapConnection,
} from '@/domain/building';
import {
  DEFAULT_PRIMARY_MATERIAL,
  DEFAULT_FASCIA_HEIGHT,
  DEFAULT_FASCIA_OVERHANG,
} from '@/domain/building';
import type { ConfigData } from './types';
import { CONFIG_VERSION } from './types';

/** Building shape as it may arrive from older codes or DB rows — fields
 *  added by later schema revisions are optional and get backfilled. */
export type LegacyBuilding =
  Omit<BuildingEntity, 'primaryMaterialId' | 'orientation' | 'heightOverride'>
  & Partial<Pick<BuildingEntity, 'primaryMaterialId' | 'orientation' | 'heightOverride'>>;

/** Roof shape as it may arrive from older codes — fields added by later
 *  schema revisions are optional and get backfilled. */
export type LegacyRoof =
  Omit<RoofConfig, 'fasciaHeight' | 'fasciaOverhang'>
  & Partial<Pick<RoofConfig, 'fasciaHeight' | 'fasciaOverhang'>>;

/** Top-level shape accepted by the migrator: later fields are optional. */
export interface LegacyConfig {
  version?: number;
  buildings: LegacyBuilding[];
  connections: SnapConnection[];
  roof: LegacyRoof;
  defaultHeight?: number;
}

export function migrateBuilding(b: LegacyBuilding): BuildingEntity {
  return {
    ...b,
    primaryMaterialId: b.primaryMaterialId ?? DEFAULT_PRIMARY_MATERIAL,
    orientation: b.orientation ?? ('horizontal' satisfies Orientation),
    heightOverride: b.heightOverride ?? null,
  };
}

function migrateRoof(roof: LegacyRoof): RoofConfig {
  return {
    ...roof,
    fasciaHeight: roof.fasciaHeight ?? DEFAULT_FASCIA_HEIGHT,
    fasciaOverhang: roof.fasciaOverhang ?? DEFAULT_FASCIA_OVERHANG,
  };
}

/** Normalize any accepted legacy input into a current-version ConfigData.
 *  Unknown/missing fields get sensible defaults; the output is safe to
 *  feed back into the rest of the domain without further guards. */
export function migrateConfig(raw: LegacyConfig): ConfigData {
  const buildings = raw.buildings.map(migrateBuilding);
  const structural = buildings.find((b) => b.type !== 'paal' && b.type !== 'muur' && b.type !== 'poort');
  const defaultHeight = raw.defaultHeight ?? structural?.dimensions.height ?? 3;

  return {
    version: CONFIG_VERSION,
    buildings,
    connections: raw.connections,
    roof: migrateRoof(raw.roof),
    defaultHeight,
  };
}
