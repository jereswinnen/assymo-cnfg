import type { BuildingEntity, RoofConfig, SnapConnection } from '@/domain/building';

/** Current schema version of the serialized config. Bump when `ConfigData`
 *  changes shape in a non-backward-compatible way; add a migration step
 *  in `migrate.ts` for the previous version. */
export const CONFIG_VERSION = 1;

/** Canonical serialized shape of a configurator scene. Matches what the
 *  base58 codec round-trips and what the API / DB will store. Contains
 *  no UI state — selections, sidebar toggles, drag state, and view
 *  mode all live on the client-side `useUIStore`. */
export interface ConfigData {
  version: number;
  buildings: BuildingEntity[];
  connections: SnapConnection[];
  roof: RoofConfig;
  defaultHeight: number;
}
