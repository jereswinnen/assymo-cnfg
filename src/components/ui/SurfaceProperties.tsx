'use client';

import { useMemo } from 'react';
import { useConfigStore } from '@/store/useConfigStore';
import { useUIStore } from "@/store/useUIStore";
import { getEffectiveWallMaterial } from '@/domain/materials';
import { useTenantCatalogs } from '@/lib/useTenantCatalogs';
import { useTenant } from '@/lib/TenantProvider';
import { t } from '@/lib/i18n';
import { Checkbox } from '@/components/ui/checkbox';
import SectionLabel from '@/components/ui/SectionLabel';
import MaterialSelect from '@/components/ui/MaterialSelect';
import DoorConfig from '@/components/ui/DoorConfig';
import WindowConfig from '@/components/ui/WindowConfig';
import type { WallId } from '@/domain/building';

export default function SurfaceProperties() {
  const selectedElement = useUIStore((s) => s.selectedElement);
  const buildings = useConfigStore((s) => s.buildings);
  const updateBuildingWall = useConfigStore((s) => s.updateBuildingWall);
  const selectedBuilding = selectedElement?.type === 'wall'
    ? buildings.find((bb) => bb.id === selectedElement.buildingId) ?? null
    : null;
  const selectedWall = selectedElement?.type === 'wall' && selectedBuilding
    ? (() => {
        const cfg = selectedBuilding.walls[selectedElement.id as WallId];
        return cfg ? getEffectiveWallMaterial(cfg, selectedBuilding, buildings) : null;
      })()
    : null;
  const { wall: wallCatalog, sourceProduct } = useTenantCatalogs(
    { wall: selectedWall },
    selectedBuilding?.sourceProductId,
  );
  const { catalog: { materials } } = useTenant();
  const middenlaagCatalog = useMemo(
    () => materials.filter(m => m.categories.includes('middenlaag') && !m.archivedAt),
    [materials],
  );

  if (!selectedElement || selectedElement.type !== 'wall') {
    return (
      <div className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
        {t('wall.select')}
      </div>
    );
  }

  const wallId = selectedElement.id as WallId;
  const buildingId = selectedElement.buildingId;
  const building = buildings.find(b => b.id === buildingId);
  const wallCfg = building?.walls[wallId];
  if (!wallCfg) return null;

  const innerSlug = wallCfg.materialIdInner ?? null;
  const middenlaagSlug = wallCfg.materialIdMiddenlaag ?? null;
  const middenlaagRow = middenlaagSlug
    ? middenlaagCatalog.find(m => m.slug === middenlaagSlug) ?? null
    : null;
  const middenlaagPricing = middenlaagRow?.pricing.middenlaag ?? null;
  const middenlaagSpec: string | null = !middenlaagRow || !middenlaagPricing
    ? null
    : middenlaagPricing.kind === 'panel'
      ? t('wallProperties.middenlaagPanelSpec', {
          name: middenlaagRow.name,
          thickness: middenlaagPricing.thicknessMm,
        })
      : t('wallProperties.middenlaagFrameSpec', {
          name: middenlaagRow.name,
          width: middenlaagPricing.beamWidthMm,
          depth: middenlaagPricing.thicknessMm,
          spacing: middenlaagPricing.beamSpacingMm,
        });

  const label = t(`wall.${wallId}`);
  const effectiveMaterial = building ? getEffectiveWallMaterial(wallCfg, building, buildings) : 'wood';
  const currentWallEntry = wallCatalog.find(e => e.atomId === effectiveMaterial);
  const isGlass = currentWallEntry?.clearsOpenings === true;

  function handleChange(field: string, value: unknown) {
    updateBuildingWall(buildingId, wallId, { [field]: value });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-primary" />
        <span className="text-sm font-semibold text-foreground">{label}</span>
      </div>

      {/* Outer cladding */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <SectionLabel>{t('wallProperties.outer')}</SectionLabel>
          <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer select-none">
            <Checkbox
              checked={wallCfg.materialId !== undefined}
              onCheckedChange={(checked) => {
                handleChange('materialId', checked ? effectiveMaterial : undefined);
              }}
            />
            {t('material.override')}
          </label>
        </div>
        <MaterialSelect
          catalog={wallCatalog}
          value={effectiveMaterial}
          disabled={wallCfg.materialId === undefined}
          category="wall"
          onChange={(atomId) => {
            handleChange('materialId', atomId);
            const entry = wallCatalog.find(e => e.atomId === atomId);
            if (entry?.clearsOpenings) {
              handleChange('hasDoor', false);
              handleChange('windows', []);
            }
          }}
          showPrice
          ariaLabel={t('wallProperties.outer')}
        />
        {sourceProduct?.constraints.allowedMaterialsBySlot?.wallCladding?.length ? (
          <p className="mt-1 text-xs text-muted-foreground">
            {t('configurator.picker.kitRestricted')}
          </p>
        ) : null}
        {wallCfg.materialId === undefined && (
          <p className="text-[11px] text-muted-foreground italic">{t('material.inherit')}</p>
        )}
      </div>

      {/* Middenlaag */}
      {middenlaagSlug == null ? (
        <button
          type="button"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors text-left"
          onClick={() => {
            const seed = middenlaagCatalog[0]?.slug;
            if (!seed) return;
            updateBuildingWall(buildingId, wallId, { materialIdMiddenlaag: seed });
          }}
        >
          {t('wallProperties.addMiddenlaag')}
        </button>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <SectionLabel>{t('wallProperties.middenlaag')}</SectionLabel>
            <button
              type="button"
              className="text-[11px] text-muted-foreground hover:text-foreground transition-colors underline"
              onClick={() => updateBuildingWall(buildingId, wallId, { materialIdMiddenlaag: null })}
            >
              {t('wallProperties.removeMiddenlaag')}
            </button>
          </div>
          <MaterialSelect
            catalog={middenlaagCatalog.map(m => ({ atomId: m.slug }))}
            value={middenlaagSlug}
            category="middenlaag"
            onChange={(atomId) => updateBuildingWall(buildingId, wallId, { materialIdMiddenlaag: atomId })}
            ariaLabel={t('wallProperties.middenlaag')}
          />
          {middenlaagSpec && (
            <p className="text-[11px] text-muted-foreground italic">{middenlaagSpec}</p>
          )}
        </div>
      )}

      {/* Inner cladding */}
      {innerSlug == null ? (
        <button
          type="button"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors text-left"
          onClick={() => {
            const seed =
              wallCatalog.find(e => e.atomId === building?.primaryMaterialId)?.atomId
              ?? wallCatalog[0]?.atomId;
            if (!seed) return;
            updateBuildingWall(buildingId, wallId, { materialIdInner: seed });
          }}
        >
          {t('wallProperties.addInner')}
        </button>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <SectionLabel>{t('wallProperties.inner')}</SectionLabel>
            <button
              type="button"
              className="text-[11px] text-muted-foreground hover:text-foreground transition-colors underline"
              onClick={() => updateBuildingWall(buildingId, wallId, { materialIdInner: null })}
            >
              {t('wallProperties.removeInner')}
            </button>
          </div>
          {/* NOTE: inner picker reuses the same wallCatalog as outer (same allow-list).
              Per-slot narrowing for wallCladdingInner is deferred to a future task. */}
          <MaterialSelect
            catalog={wallCatalog}
            value={innerSlug}
            category="wall"
            onChange={(atomId) => updateBuildingWall(buildingId, wallId, { materialIdInner: atomId })}
            showPrice
            ariaLabel={t('wallProperties.inner')}
          />
        </div>
      )}

      {isGlass && (
        <p className="text-xs text-muted-foreground italic">Glaswand van zijde tot zijde</p>
      )}

      {!isGlass && <DoorConfig wallId={wallId} buildingId={buildingId} />}
      {!isGlass && <WindowConfig wallId={wallId} buildingId={buildingId} />}
    </div>
  );
}
