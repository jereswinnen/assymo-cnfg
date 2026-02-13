'use client';

import { useConfigStore } from '@/store/useConfigStore';
import { ROOF_COVERINGS, TRIM_COLORS } from '@/lib/constants';
import { t } from '@/lib/i18n';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import ColorSwatches from './ColorSwatches';

export default function RoofConfigSection() {
  const roof = useConfigStore((s) => s.config.roof);
  const updateRoof = useConfigStore((s) => s.updateRoof);

  return (
    <div className="space-y-4">
      {/* Roof covering cards */}
      <div>
        <Label className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
          {t('roof.covering')}
        </Label>
        <div className="grid grid-cols-2 gap-2">
          {ROOF_COVERINGS.map((cov) => (
            <button
              key={cov.id}
              onClick={() => updateRoof({ coveringId: cov.id })}
              className={`flex items-center gap-2 rounded-md border px-3 py-2 text-left transition-all ${
                roof.coveringId === cov.id
                  ? 'border-primary bg-primary/5 ring-1 ring-primary'
                  : 'border-border hover:border-primary/40'
              }`}
            >
              <div
                className="h-6 w-6 shrink-0 rounded border border-border"
                style={{ backgroundColor: cov.color }}
              />
              <div>
                <div className={`text-xs font-medium ${roof.coveringId === cov.id ? 'text-primary' : 'text-foreground'}`}>
                  {cov.label}
                </div>
                <div className="text-[10px] text-muted-foreground">{'\u20AC'}{cov.pricePerSqm}/m{'\u00B2'}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Trim color swatches */}
      <div>
        <Label className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
          {t('roof.trimColor')}
        </Label>
        <ColorSwatches
          colors={TRIM_COLORS}
          selectedId={roof.trimColorId}
          onSelect={(id) => updateRoof({ trimColorId: id as typeof roof.trimColorId })}
        />
      </div>

      {/* Insulation toggle + thickness */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Checkbox
            id="roof-insulation"
            checked={roof.insulation}
            onCheckedChange={(checked) => updateRoof({ insulation: !!checked })}
          />
          <Label htmlFor="roof-insulation" className="cursor-pointer">
            {t('roof.insulation')}
          </Label>
        </div>
        {roof.insulation && (
          <div className="ml-6 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">{t('roof.thickness')}</span>
              <span className="text-sm text-muted-foreground tabular-nums">{roof.insulationThickness} mm</span>
            </div>
            <Slider
              min={50}
              max={300}
              step={10}
              value={[roof.insulationThickness]}
              onValueChange={([v]) => updateRoof({ insulationThickness: v })}
            />
          </div>
        )}
      </div>

      {/* Skylight toggle */}
      <div className="flex items-center gap-2">
        <Checkbox
          id="roof-skylight"
          checked={roof.hasSkylight}
          onCheckedChange={(checked) => updateRoof({ hasSkylight: !!checked })}
        />
        <Label htmlFor="roof-skylight" className="cursor-pointer">
          {t('roof.skylight')}
        </Label>
      </div>
    </div>
  );
}
