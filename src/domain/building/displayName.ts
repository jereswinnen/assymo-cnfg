import { t } from '@/lib/i18n';
import type { BuildingEntity } from './types';

/** Resolve the display name for a building. Returns the trimmed user-supplied
 *  override when present, otherwise falls back to the type-default i18n label
 *  (`building.name.<type>`). Pure — safe to call from server-rendered surfaces
 *  (PDF export, order snapshots) and from the client schematic alike. */
export function getBuildingDisplayName(
  b: Pick<BuildingEntity, 'name' | 'type'>,
): string {
  const trimmed = b.name?.trim();
  return trimmed && trimmed.length > 0
    ? trimmed
    : t(`building.name.${b.type}`);
}
