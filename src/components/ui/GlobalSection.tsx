'use client';

import { useConfigStore } from '@/store/useConfigStore';
import { useTenant } from '@/lib/TenantProvider';
import { useTenantCatalogs } from '@/lib/useTenantCatalogs';
import { t } from '@/lib/i18n';
import SectionLabel from '@/components/ui/SectionLabel';
import MaterialSelect from '@/components/ui/MaterialSelect';
import { Button } from '@/components/ui/button';

/** Scene-wide settings — sits at the top of the configurator sidebar
 *  regardless of which (or whether any) building is selected. Two knobs:
 *  - Materiaal: a single wall material applied to every building.
 *  - Paaldikte: the scene's post / lumber cross-section, picked from the
 *    tenant's presets (admin-owned list).
 *  Per-building tweaks go through their own accordion sections; this
 *  section is the one-click cascade for the common case where every
 *  building in the scene shares the same finish + lumber. */
export default function GlobalSection() {
  const buildings = useConfigStore((s) => s.buildings);
  const setGlobalPrimaryMaterial = useConfigStore((s) => s.setGlobalPrimaryMaterial);
  const setScenePostSizeMm = useConfigStore((s) => s.setScenePostSizeMm);
  const sceneMm = useConfigStore((s) => s.postSizeMm);
  const { geometry } = useTenant();

  // Show every wall-category material the tenant has. The hook keeps the
  // current selection visible even when it's archived (legacy scenes).
  const firstBuilding = buildings.find(
    (b) => b.type !== 'poort' && b.type !== 'paal',
  );
  const currentMaterial = firstBuilding?.primaryMaterialId ?? '';
  const catalogs = useTenantCatalogs(
    currentMaterial ? { wall: currentMaterial } : {},
  );
  const wallCatalog = catalogs.wall;

  // Distinct materials currently used in the scene — when >1 we surface a
  // small hint so the user knows the picker will collapse them.
  const distinctMaterials = new Set(
    buildings.filter((b) => b.type !== 'poort').map((b) => b.primaryMaterialId),
  );
  const isMixed = distinctMaterials.size > 1;

  // Effective Paaldikte: the override when set, tenant default otherwise.
  const effectiveMm = sceneMm ?? geometry.postSizeMm;

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="px-3 py-2 text-sm font-medium text-muted-foreground bg-muted/30">
        <span className="flex items-center gap-2">
          <span>🌐</span>
          <span>{t('sidebar.section.global')}</span>
        </span>
      </div>
      <div className="px-3 py-3 border-t border-border space-y-4">
        {wallCatalog && wallCatalog.length > 0 && (
          <div className="space-y-2">
            <SectionLabel>{t('sidebar.global.material')}</SectionLabel>
            <MaterialSelect
              catalog={wallCatalog}
              value={currentMaterial}
              onChange={(id) => setGlobalPrimaryMaterial(id)}
              category="wall"
              showPrice
              ariaLabel={t('sidebar.global.material')}
            />
            <p className="text-[11px] text-muted-foreground leading-snug">
              {isMixed
                ? t('sidebar.global.material.mixed')
                : t('sidebar.global.material.help')}
            </p>
          </div>
        )}

        <div className="space-y-2">
          <SectionLabel>{t('sidebar.global.postSize')}</SectionLabel>
          <div className="flex flex-wrap gap-1">
            {geometry.postSizePresetsMm.map((preset) => (
              <Button
                key={preset}
                type="button"
                size="sm"
                variant={effectiveMm === preset ? 'default' : 'outline'}
                onClick={() => setScenePostSizeMm(preset)}
              >
                {preset}
              </Button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground leading-snug">
            {t('sidebar.global.postSize.help', {
              defaultMm: geometry.postSizeMm.toString(),
            })}
          </p>
        </div>
      </div>
    </div>
  );
}
