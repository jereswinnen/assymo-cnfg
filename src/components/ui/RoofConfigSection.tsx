'use client';

import { useMemo } from 'react';
import { useConfigStore } from '@/store/useConfigStore';
import { useTenant } from '@/lib/TenantProvider';
import { useTenantCatalogs } from '@/lib/useTenantCatalogs';
import { t } from '@/lib/i18n';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import SectionLabel from '@/components/ui/SectionLabel';
import MaterialSelect from '@/components/ui/MaterialSelect';
import { dakbakRange } from '@/domain/catalog';
import type { RoofCoveringId } from '@/domain/building';

function cm(meters: number): string {
  return `${Math.round(meters * 100)} cm`;
}

export default function RoofConfigSection() {
  const roof = useConfigStore((s) => s.roof);
  const updateRoof = useConfigStore((s) => s.updateRoof);
  const buildings = useConfigStore((s) => s.buildings);
  const productBuilding = buildings.find((b) => b.sourceProductId);
  const { roofTrim, roofCover, wall: wallCatalog, sourceProduct } = useTenantCatalogs(
    {
      roofTrim: roof.trimMaterialId,
      roofCover: roof.coveringId,
      wall: roof.innerCladdingSlug ?? undefined,
    },
    productBuilding?.sourceProductId,
  );

  const { catalog: { materials } } = useTenant();
  const middenlaagCatalog = useMemo(
    () => materials.filter((m) => m.categories.includes('middenlaag') && !m.archivedAt),
    [materials],
  );

  const range = dakbakRange(sourceProduct ?? null);
  const heightLocked   = range.height.min === range.height.max;
  const overhangLocked = range.overhang.min === range.overhang.max;
  const isFlat = roof.type === 'flat';

  const middenlaagSlug = roof.middenlaagSlug ?? null;
  const innerSlug = roof.innerCladdingSlug ?? null;

  const middenlaagRow = middenlaagSlug
    ? middenlaagCatalog.find((m) => m.slug === middenlaagSlug) ?? null
    : null;
  const middenlaagPricing = middenlaagRow?.pricing.middenlaag ?? null;
  const middenlaagSpec: string | null =
    !middenlaagRow || !middenlaagPricing
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

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <SectionLabel>{t('roof.covering')}</SectionLabel>
        <MaterialSelect
          catalog={roofCover}
          value={roof.coveringId}
          onChange={(atomId) => updateRoof({ coveringId: atomId as RoofCoveringId })}
          category="roof-cover"
          showPrice
          ariaLabel={t('roof.covering')}
        />
        {sourceProduct?.constraints.allowedMaterialsBySlot?.roofCovering?.length ? (
          <p className="mt-1 text-xs text-muted-foreground">
            {t('configurator.picker.kitRestricted')}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <SectionLabel>{t('roof.trimColor')}</SectionLabel>
        <MaterialSelect
          catalog={roofTrim}
          value={roof.trimMaterialId}
          onChange={(atomId) => updateRoof({ trimMaterialId: atomId })}
          category="roof-trim"
          ariaLabel={t('roof.trimColor')}
        />
        {sourceProduct?.constraints.allowedMaterialsBySlot?.roofTrim?.length ? (
          <p className="mt-1 text-xs text-muted-foreground">
            {t('configurator.picker.kitRestricted')}
          </p>
        ) : null}
      </div>

      {isFlat && (
        <>
          <div className="space-y-2">
            <SectionLabel>{t('roof.fasciaHeight')}</SectionLabel>
            {heightLocked ? (
              <p className="text-sm text-muted-foreground">
                {t('roof.fasciaLocked', { value: cm(range.height.min) })}
              </p>
            ) : (
              <>
                <Slider
                  min={range.height.min}
                  max={range.height.max}
                  step={0.01}
                  value={[roof.fasciaHeight]}
                  onValueChange={([v]) => updateRoof({ fasciaHeight: v })}
                />
                <p className="text-xs text-muted-foreground">{cm(roof.fasciaHeight)}</p>
              </>
            )}
            {sourceProduct?.constraints.dakbak ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {t('configurator.picker.kitRestricted')}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <SectionLabel>{t('roof.fasciaOverhang')}</SectionLabel>
            {overhangLocked ? (
              <p className="text-sm text-muted-foreground">
                {t('roof.fasciaLocked', { value: cm(range.overhang.min) })}
              </p>
            ) : (
              <>
                <Slider
                  min={range.overhang.min}
                  max={range.overhang.max}
                  step={0.01}
                  value={[roof.fasciaOverhang]}
                  onValueChange={([v]) => updateRoof({ fasciaOverhang: v })}
                />
                <p className="text-xs text-muted-foreground">{cm(roof.fasciaOverhang)}</p>
              </>
            )}
          </div>
        </>
      )}

      {!isFlat && (
        <p className="text-xs text-muted-foreground">{t('roof.fasciaPitchedNotice')}</p>
      )}

      <div className="flex items-center gap-2">
        <Checkbox
          id="roof-skylight"
          checked={roof.hasSkylight}
          onCheckedChange={(checked) => updateRoof({ hasSkylight: !!checked })}
        />
        <Label htmlFor="roof-skylight" className="cursor-pointer font-medium">
          {t('roof.skylight')}
        </Label>
      </div>

      {/* Middenlaag (timber framing / insulation panel inside the roof envelope) */}
      {middenlaagSlug == null ? (
        <button
          type="button"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors text-left"
          onClick={() => {
            const seed = middenlaagCatalog[0]?.slug;
            if (!seed) return;
            updateRoof({ middenlaagSlug: seed });
          }}
        >
          {t('roof.addMiddenlaag')}
        </button>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <SectionLabel>{t('roof.section.middenlaag')}</SectionLabel>
            <button
              type="button"
              className="text-[11px] text-muted-foreground hover:text-foreground transition-colors underline"
              onClick={() => updateRoof({ middenlaagSlug: null })}
            >
              {t('wallProperties.removeMiddenlaag')}
            </button>
          </div>
          <MaterialSelect
            catalog={middenlaagCatalog.map((m) => ({ atomId: m.slug }))}
            value={middenlaagSlug}
            category="middenlaag"
            onChange={(atomId) => updateRoof({ middenlaagSlug: atomId })}
            ariaLabel={t('roof.section.middenlaag')}
          />
          {middenlaagSpec && (
            <p className="text-[11px] text-muted-foreground italic">{middenlaagSpec}</p>
          )}
        </div>
      )}

      {/* Inner cladding ("binnenbekleding") — sloped slab below the framing */}
      {innerSlug == null ? (
        <button
          type="button"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors text-left"
          onClick={() => {
            const seed = wallCatalog[0]?.atomId;
            if (!seed) return;
            updateRoof({ innerCladdingSlug: seed });
          }}
        >
          {t('roof.addBinnenbekleding')}
        </button>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <SectionLabel>{t('roof.section.binnenbekleding')}</SectionLabel>
            <button
              type="button"
              className="text-[11px] text-muted-foreground hover:text-foreground transition-colors underline"
              onClick={() => updateRoof({ innerCladdingSlug: null })}
            >
              {t('wallProperties.removeInner')}
            </button>
          </div>
          <MaterialSelect
            catalog={wallCatalog}
            value={innerSlug}
            category="wall"
            onChange={(atomId) => updateRoof({ innerCladdingSlug: atomId })}
            showPrice
            ariaLabel={t('roof.section.binnenbekleding')}
          />
        </div>
      )}
    </div>
  );
}
