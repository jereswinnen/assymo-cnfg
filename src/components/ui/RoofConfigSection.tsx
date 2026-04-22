'use client';

import { useConfigStore } from '@/store/useConfigStore';
import { useTenantCatalogs } from '@/lib/useTenantCatalogs';
import { t } from '@/lib/i18n';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import SectionLabel from '@/components/ui/SectionLabel';
import MaterialSelect from '@/components/ui/MaterialSelect';
import type { RoofCoveringId } from '@/domain/building';

export default function RoofConfigSection() {
  const roof = useConfigStore((s) => s.roof);
  const updateRoof = useConfigStore((s) => s.updateRoof);
  const buildings = useConfigStore((s) => s.buildings);
  // Roof is scene-level, but products can each carry their own roofCovering /
  // roofTrim allow-list. With multiple product-sourced buildings we apply the
  // first one's constraints — expected usage today is one structural product
  // per scene. Revisit when multi-product scenes become common.
  const productBuilding = buildings.find((b) => b.sourceProductId);
  const { roofTrim, roofCover, sourceProduct } = useTenantCatalogs(
    {
      roofTrim: roof.trimMaterialId,
      roofCover: roof.coveringId,
    },
    productBuilding?.sourceProductId,
  );

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
