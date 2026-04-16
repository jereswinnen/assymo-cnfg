'use client';

import { useConfigStore } from '@/store/useConfigStore';
import { ROOF_COVERINGS } from '@/lib/constants';
import { ROOF_TRIM_CATALOG, resolveCatalog } from '@/lib/materials';
import { t } from '@/lib/i18n';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import SectionLabel from '@/components/ui/SectionLabel';

export default function RoofConfigSection() {
  const roof = useConfigStore((s) => s.roof);
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

      {/* Trim material — same options as wall materials */}
      <div className="space-y-2">
        <SectionLabel>{t('roof.trimColor')}</SectionLabel>
        <div className="grid grid-cols-5 gap-1.5">
          {resolveCatalog(ROOF_TRIM_CATALOG).map(({ atomId, atom }) => {
            const isSelected = roof.trimMaterialId === atomId;
            return (
              <button
                key={atomId}
                onClick={() => updateRoof({ trimMaterialId: atomId })}
                className={`flex flex-col items-center gap-1.5 rounded-lg border p-2 transition-all ${
                  isSelected
                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                    : 'border-border hover:border-primary/40'
                }`}
              >
                <span
                  className="h-7 w-7 rounded-md border border-border/50"
                  style={{
                    backgroundColor: atom.color,
                    opacity: atomId === 'glass' ? 0.6 : 1,
                  }}
                />
                <span className={`text-[10px] font-medium leading-tight ${
                  isSelected ? 'text-primary' : 'text-muted-foreground'
                }`}>
                  {t(atom.labelKey)}
                </span>
              </button>
            );
          })}
        </div>
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
