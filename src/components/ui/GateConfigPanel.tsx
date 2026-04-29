'use client';

import { useConfigStore } from '@/store/useConfigStore';
import { useUIStore, selectSingleBuildingId } from '@/store/useUIStore';
import { useTenantCatalogs, useTenantSupplierProducts } from '@/lib/useTenantCatalogs';
import { t } from '@/lib/i18n';
import SectionLabel from '@/components/ui/SectionLabel';
import MaterialSelect from '@/components/ui/MaterialSelect';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { GateSwingDirection } from '@/domain/building';
import type { GateMeta, GateMetaOption } from '@/domain/supplier';

const NAKED_VALUE = '__naked__';

function optionLabel(opt: GateMetaOption): string {
  if (opt.labelKey) {
    const translated = t(opt.labelKey);
    if (translated !== opt.labelKey) return translated;
  }
  return opt.label ?? opt.sku;
}

export default function GateConfigPanel() {
  const selectedBuildingId = useUIStore(selectSingleBuildingId);
  const selectedBuilding = useConfigStore((s) =>
    selectedBuildingId ? s.buildings.find((b) => b.id === selectedBuildingId) ?? null : null,
  );
  const updateGateConfig = useConfigStore((s) => s.updateGateConfig);
  const updateBuildingDimensions = useConfigStore((s) => s.updateBuildingDimensions);
  const { gate: gateCatalog } = useTenantCatalogs(
    { gate: selectedBuilding?.gateConfig?.materialId ?? null },
  );
  const gateSupplierProducts = useTenantSupplierProducts('gate');

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
  const sku = gateConfig.supplierProductId
    ? gateSupplierProducts.find((p) => p.id === gateConfig.supplierProductId)
    : undefined;
  const meta = (sku?.meta ?? {}) as GateMeta;

  const partCountLocked =
    !!sku && meta.partCount !== undefined && meta.partCount !== 'configurable';
  const allowedSwings: GateSwingDirection[] | null =
    sku && meta.swingDirections && meta.swingDirections.length > 0
      ? meta.swingDirections
      : null;
  const motorForcedOn = !!sku && meta.motorized === true;
  const motorForcedOff = !!sku && meta.motorized === false;
  const motorOptional =
    !sku || meta.motorized === undefined || meta.motorized === 'optional';

  const onPickSku = (value: string) => {
    if (value === NAKED_VALUE || value === '') {
      updateGateConfig(selectedBuildingId, {
        supplierProductId: null,
        selectedColorSku: null,
        selectedLockSku: null,
        selectedHandleSku: null,
      });
      return;
    }
    const next = gateSupplierProducts.find((p) => p.id === value);
    if (!next) return;
    const nextMeta = next.meta as GateMeta;
    const patch: Parameters<typeof updateGateConfig>[1] = {
      supplierProductId: next.id,
      selectedColorSku: null,
      selectedLockSku: null,
      selectedHandleSku: null,
    };
    if (nextMeta.motorized === true) patch.motorized = true;
    if (nextMeta.motorized === false) patch.motorized = false;
    if (
      nextMeta.swingDirections &&
      nextMeta.swingDirections.length > 0 &&
      !nextMeta.swingDirections.includes(gateConfig.swingDirection)
    ) {
      patch.swingDirection = nextMeta.swingDirections[0];
    }
    if (nextMeta.partCount === 1 || nextMeta.partCount === 2) {
      patch.partCount = nextMeta.partCount;
    }
    updateGateConfig(selectedBuildingId, patch);
    if (nextMeta.defaultDimensions) {
      updateBuildingDimensions(selectedBuildingId, {
        width: nextMeta.defaultDimensions.widthMm / 1000,
        height: nextMeta.defaultDimensions.heightMm / 1000,
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <SectionLabel>{t('configurator.gate.supplierProduct')}</SectionLabel>
        <Select
          value={gateConfig.supplierProductId ?? NAKED_VALUE}
          onValueChange={onPickSku}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NAKED_VALUE}>
              {t('configurator.gate.naked')}
            </SelectItem>
            {gateSupplierProducts.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

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
          disabled={partCountLocked}
        >
          <ToggleGroupItem value="1" className="flex-1 text-xs">
            {t('configurator.gate.parts.one')}
          </ToggleGroupItem>
          <ToggleGroupItem value="2" className="flex-1 text-xs">
            {t('configurator.gate.parts.two')}
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {!sku && (
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
      )}

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
          {(['inward', 'outward', 'sliding'] as const).map((dir) => {
            const enabled = !allowedSwings || allowedSwings.includes(dir);
            return (
              <ToggleGroupItem
                key={dir}
                value={dir}
                disabled={!enabled}
                className="flex-1 text-xs"
              >
                {t(`configurator.gate.swing.${dir}`)}
              </ToggleGroupItem>
            );
          })}
        </ToggleGroup>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
        <Label htmlFor="gate-motorized" className="cursor-pointer text-sm">
          {t('configurator.gate.motorized')}
        </Label>
        <Switch
          id="gate-motorized"
          checked={gateConfig.motorized}
          disabled={motorForcedOn || motorForcedOff}
          onCheckedChange={(checked) =>
            updateGateConfig(selectedBuildingId, { motorized: checked })
          }
        />
      </div>
      {sku && !motorOptional && (
        <p className="text-xs text-muted-foreground -mt-2 px-3">
          {motorForcedOn
            ? t('configurator.gate.motor.forcedOn')
            : t('configurator.gate.motor.forcedOff')}
        </p>
      )}

      {sku && meta.availableColors && meta.availableColors.length > 0 && (
        <div className="space-y-2">
          <SectionLabel>{t('configurator.gate.color')}</SectionLabel>
          <Select
            value={gateConfig.selectedColorSku ?? ''}
            onValueChange={(v) =>
              updateGateConfig(selectedBuildingId, { selectedColorSku: v || null })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder={t('configurator.gate.option.placeholder')} />
            </SelectTrigger>
            <SelectContent>
              {meta.availableColors.map((opt) => (
                <SelectItem key={opt.sku} value={opt.sku}>
                  {optionLabel(opt)}
                  {opt.ralCode ? ` (${opt.ralCode})` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {sku && meta.availableLocks && meta.availableLocks.length > 0 && (
        <div className="space-y-2">
          <SectionLabel>{t('configurator.gate.lock')}</SectionLabel>
          <Select
            value={gateConfig.selectedLockSku ?? ''}
            onValueChange={(v) =>
              updateGateConfig(selectedBuildingId, { selectedLockSku: v || null })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder={t('configurator.gate.option.placeholder')} />
            </SelectTrigger>
            <SelectContent>
              {meta.availableLocks.map((opt) => (
                <SelectItem key={opt.sku} value={opt.sku}>
                  {optionLabel(opt)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {sku && meta.availableHandles && meta.availableHandles.length > 0 && (
        <div className="space-y-2">
          <SectionLabel>{t('configurator.gate.handle')}</SectionLabel>
          <Select
            value={gateConfig.selectedHandleSku ?? ''}
            onValueChange={(v) =>
              updateGateConfig(selectedBuildingId, { selectedHandleSku: v || null })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder={t('configurator.gate.option.placeholder')} />
            </SelectTrigger>
            <SelectContent>
              {meta.availableHandles.map((opt) => (
                <SelectItem key={opt.sku} value={opt.sku}>
                  {optionLabel(opt)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
