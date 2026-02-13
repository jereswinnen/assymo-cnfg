'use client';

import { useConfigStore } from '@/store/useConfigStore';
import { ROOF_COVERINGS, TRIM_COLORS } from '@/lib/constants';
import { t } from '@/lib/i18n';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import SectionLabel from '@/components/ui/SectionLabel';
import ColorSwatches from './ColorSwatches';

export default function RoofConfigSection() {
  const roof = useConfigStore((s) => s.config.roof);
  const updateRoof = useConfigStore((s) => s.updateRoof);

  return (
    <div className="space-y-5">
      {/* Roof covering cards */}
      <div className="space-y-2">
        <SectionLabel>{t('roof.covering')}</SectionLabel>
        <div className="grid grid-cols-2 gap-1.5">
          {ROOF_COVERINGS.map((cov) => {
            const isSelected = roof.coveringId === cov.id;
            return (
              <button
                key={cov.id}
                onClick={() => updateRoof({ coveringId: cov.id })}
                className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-all ${
                  isSelected
                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                    : 'border-border hover:border-primary/40'
                }`}
              >
                <div
                  className="h-6 w-6 shrink-0 rounded-md border border-border/50"
                  style={{ backgroundColor: cov.color }}
                />
                <div>
                  <div className={`text-xs font-medium ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                    {cov.label}
                  </div>
                  <div className="text-[10px] text-muted-foreground">{'\u20AC'}{cov.pricePerSqm}/m{'\u00B2'}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Trim color swatches */}
      <div className="space-y-2">
        <SectionLabel>{t('roof.trimColor')}</SectionLabel>
        <ColorSwatches
          colors={TRIM_COLORS}
          selectedId={roof.trimColorId}
          onSelect={(id) => updateRoof({ trimColorId: id as typeof roof.trimColorId })}
        />
      </div>

      {/* Skylight toggle */}
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
