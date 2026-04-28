'use client';

import { useConfigStore } from '@/store/useConfigStore';
import { useUIStore, selectSingleBuildingId } from '@/store/useUIStore';
import { useTenantCatalogs } from '@/lib/useTenantCatalogs';
import { t } from '@/lib/i18n';
import { getConstraints } from '@/domain/building';
import SectionLabel from '@/components/ui/SectionLabel';
import MaterialSelect from '@/components/ui/MaterialSelect';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { GateSwingDirection } from '@/domain/building';

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export default function GateConfigPanel() {
  const selectedBuildingId = useUIStore(selectSingleBuildingId);
  const selectedBuilding = useConfigStore((s) =>
    selectedBuildingId ? s.buildings.find((b) => b.id === selectedBuildingId) ?? null : null,
  );
  const updateGateConfig = useConfigStore((s) => s.updateGateConfig);
  const { gate: gateCatalog } = useTenantCatalogs(
    { gate: selectedBuilding?.gateConfig?.materialId ?? null },
  );

  if (
    !selectedBuildingId ||
    !selectedBuilding ||
    selectedBuilding.type !== 'poort' ||
    !selectedBuilding.gateConfig
  ) {
    return (
      <div className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
        {t('sidebar.emptyState')}
      </div>
    );
  }

  const { gateConfig } = selectedBuilding;
  const constraints = getConstraints('poort');
  const widthMinMm = Math.round(constraints.width.min * 1000);
  const widthMaxMm = Math.round(constraints.width.max * 1000);
  const heightMinMm = Math.round(constraints.height.min * 1000);
  const heightMaxMm = Math.round(constraints.height.max * 1000);

  const partWidthM = gateConfig.partWidthMm / 1000;
  const heightM = gateConfig.heightMm / 1000;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <SectionLabel>{t('configurator.gate.parts')}</SectionLabel>
        <ToggleGroup
          type="single"
          value={String(gateConfig.partCount)}
          onValueChange={(v) => {
            if (v !== '1' && v !== '2') return;
            updateGateConfig(selectedBuildingId, { partCount: Number(v) as 1 | 2 });
          }}
          className="w-full"
          variant="outline"
          size="sm"
        >
          <ToggleGroupItem value="1" className="flex-1 text-xs">
            {t('configurator.gate.parts.one')}
          </ToggleGroupItem>
          <ToggleGroupItem value="2" className="flex-1 text-xs">
            {t('configurator.gate.parts.two')}
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="space-y-2">
        <Label htmlFor="gate-part-width">{t('configurator.gate.partWidth')}</Label>
        <div className="flex items-center gap-2">
          <Input
            id="gate-part-width"
            type="number"
            inputMode="decimal"
            min={constraints.width.min}
            max={constraints.width.max}
            step={constraints.width.step}
            value={partWidthM}
            onChange={(e) => {
              const parsed = parseFloat(e.target.value.replace(',', '.'));
              if (Number.isNaN(parsed)) return;
              const clampedMm = clamp(Math.round(parsed * 1000), widthMinMm, widthMaxMm);
              updateGateConfig(selectedBuildingId, { partWidthMm: clampedMm });
            }}
            className="w-24"
          />
          <span className="text-sm text-muted-foreground">m</span>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="gate-height">{t('configurator.gate.height')}</Label>
        <div className="flex items-center gap-2">
          <Input
            id="gate-height"
            type="number"
            inputMode="decimal"
            min={constraints.height.min}
            max={constraints.height.max}
            step={constraints.height.step}
            value={heightM}
            onChange={(e) => {
              const parsed = parseFloat(e.target.value.replace(',', '.'));
              if (Number.isNaN(parsed)) return;
              const clampedMm = clamp(Math.round(parsed * 1000), heightMinMm, heightMaxMm);
              updateGateConfig(selectedBuildingId, { heightMm: clampedMm });
            }}
            className="w-24"
          />
          <span className="text-sm text-muted-foreground">m</span>
        </div>
      </div>

      <div className="space-y-2">
        <SectionLabel>{t('configurator.gate.material')}</SectionLabel>
        <MaterialSelect
          catalog={gateCatalog}
          value={gateConfig.materialId}
          onChange={(atomId) =>
            updateGateConfig(selectedBuildingId, { materialId: atomId })
          }
          category="gate"
          showPrice
          ariaLabel={t('configurator.gate.material')}
        />
      </div>

      <div className="space-y-2">
        <SectionLabel>{t('configurator.gate.swing')}</SectionLabel>
        <ToggleGroup
          type="single"
          value={gateConfig.swingDirection}
          onValueChange={(v) => {
            if (v !== 'inward' && v !== 'outward' && v !== 'sliding') return;
            updateGateConfig(selectedBuildingId, { swingDirection: v as GateSwingDirection });
          }}
          className="w-full"
          variant="outline"
          size="sm"
        >
          <ToggleGroupItem value="inward" className="flex-1 text-xs">
            {t('configurator.gate.swing.inward')}
          </ToggleGroupItem>
          <ToggleGroupItem value="outward" className="flex-1 text-xs">
            {t('configurator.gate.swing.outward')}
          </ToggleGroupItem>
          <ToggleGroupItem value="sliding" className="flex-1 text-xs">
            {t('configurator.gate.swing.sliding')}
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
        <Label htmlFor="gate-motorized" className="cursor-pointer text-sm">
          {t('configurator.gate.motorized')}
        </Label>
        <Switch
          id="gate-motorized"
          checked={gateConfig.motorized}
          onCheckedChange={(checked) =>
            updateGateConfig(selectedBuildingId, { motorized: checked })
          }
        />
      </div>
    </div>
  );
}
