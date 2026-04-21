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
  const productBuilding = buildings.find((b) => b.sourceProductId);
  const { roofTrim, roofCover } = useTenantCatalogs(
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
          showPrice
          ariaLabel={t('roof.covering')}
        />
      </div>

      <div className="space-y-2">
        <SectionLabel>{t('roof.trimColor')}</SectionLabel>
        <MaterialSelect
          catalog={roofTrim}
          value={roof.trimMaterialId}
          onChange={(atomId) => updateRoof({ trimMaterialId: atomId })}
          ariaLabel={t('roof.trimColor')}
        />
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
