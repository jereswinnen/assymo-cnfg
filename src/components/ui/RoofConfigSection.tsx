'use client';

import { useConfigStore } from '@/store/useConfigStore';
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
  const { roofTrim, roofCover, sourceProduct } = useTenantCatalogs(
    {
      roofTrim: roof.trimMaterialId,
      roofCover: roof.coveringId,
    },
    productBuilding?.sourceProductId,
  );

  const range = dakbakRange(sourceProduct ?? null);
  const heightLocked   = range.height.min === range.height.max;
  const overhangLocked = range.overhang.min === range.overhang.max;
  const isFlat = roof.type === 'flat';

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
    </div>
  );
}
