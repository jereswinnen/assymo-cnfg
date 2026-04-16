import type { BuildingEntity, RoofConfig, SnapConnection } from '@/domain/building';

/** Canonical serialized shape of a configurator scene. Matches what the
 *  base58 codec round-trips and what the API / DB will store. Contains
 *  no UI state — selections, sidebar toggles, drag state, and view
 *  mode all live on the client-side `useUIStore`. */
export interface ConfigData {
  buildings: BuildingEntity[];
  connections: SnapConnection[];
  roof: RoofConfig;
  defaultHeight: number;
}
