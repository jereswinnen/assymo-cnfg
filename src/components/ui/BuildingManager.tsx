'use client';

import { useConfigStore } from '@/store/useConfigStore';
import { t } from '@/lib/i18n';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import SectionLabel from '@/components/ui/SectionLabel';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { BuildingType, RoofType } from '@/types/building';

const ROOF_TYPES: { id: RoofType; label: string; icon: React.ReactNode }[] = [
  {
    id: 'flat',
    label: 'roofType.flat',
    icon: (
      <svg viewBox="0 0 40 28" className="h-5 w-7" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <rect x="4" y="6" width="32" height="18" rx="1" />
        <line x1="2" y1="6" x2="38" y2="6" strokeWidth={2.5} />
      </svg>
    ),
  },
  {
    id: 'pitched',
    label: 'roofType.pitched',
    icon: (
      <svg viewBox="0 0 40 28" className="h-5 w-7" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <rect x="4" y="12" width="32" height="12" rx="1" />
        <polyline points="2,12 20,2 38,12" strokeWidth={2.5} strokeLinejoin="round" />
      </svg>
    ),
  },
];

export default function BuildingManager() {
  const buildings = useConfigStore((s) => s.buildings);
  const connections = useConfigStore((s) => s.connections);
  const selectedBuildingId = useConfigStore((s) => s.selectedBuildingId);
  const roofType = useConfigStore((s) => s.roof.type);
  const addBuilding = useConfigStore((s) => s.addBuilding);
  const removeBuilding = useConfigStore((s) => s.removeBuilding);
  const selectBuilding = useConfigStore((s) => s.selectBuilding);
  const toggleBuildingBraces = useConfigStore((s) => s.toggleBuildingBraces);
  const toggleConnectionOpen = useConfigStore((s) => s.toggleConnectionOpen);
  const setRoofType = useConfigStore((s) => s.setRoofType);

  const selectedBuilding = buildings.find(b => b.id === selectedBuildingId);
  const selectedConnections = connections.filter(
    c => c.buildingAId === selectedBuildingId || c.buildingBId === selectedBuildingId,
  );

  return (
    <div className="space-y-4">
      {/* Building list */}
      <div className="space-y-1">
        {buildings.map((b, i) => {
          const isSelected = b.id === selectedBuildingId;
          const typeLabel = t(`building.name.${b.type}`);
          return (
            <div
              key={b.id}
              onClick={() => selectBuilding(b.id)}
              className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 cursor-pointer transition-all ${
                isSelected
                  ? 'border-primary bg-primary/5 ring-1 ring-primary'
                  : 'border-border hover:border-primary/40'
              }`}
            >
              <BuildingIcon type={b.type} isSelected={isSelected} />
              <div className="flex-1 min-w-0">
                <span className={`text-sm font-medium ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                  {typeLabel} {i + 1}
                </span>
                <span className="block text-[11px] text-muted-foreground tabular-nums">
                  {b.dimensions.width.toFixed(1)} × {b.dimensions.depth.toFixed(1)} × {b.dimensions.height.toFixed(1)} m
                </span>
              </div>
              {buildings.length > 1 && (
                <button
                  onClick={(e) => { e.stopPropagation(); removeBuilding(b.id); }}
                  className="text-xs text-muted-foreground hover:text-destructive transition-colors px-1"
                >
                  {t('building.delete')}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Add buttons */}
      <div className="grid grid-cols-2 gap-1.5">
        <button
          onClick={() => addBuilding('berging')}
          className="rounded-lg border border-dashed border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:border-primary/40 hover:text-primary transition-all"
        >
          + {t('building.add.berging')}
        </button>
        <button
          onClick={() => addBuilding('overkapping')}
          className="rounded-lg border border-dashed border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:border-primary/40 hover:text-primary transition-all"
        >
          + {t('building.add.overkapping')}
        </button>
      </div>

      {/* Roof type toggle (shared) */}
      <div className="space-y-2">
        <SectionLabel>{t('roofType.label')}</SectionLabel>
        <ToggleGroup
          type="single"
          value={roofType}
          onValueChange={(v) => { if (v) setRoofType(v as RoofType); }}
          className="w-full"
          variant="outline"
        >
          {ROOF_TYPES.map(({ id, label, icon }) => (
            <ToggleGroupItem key={id} value={id} className="flex-1 gap-2">
              <span className={roofType === id ? 'text-primary-foreground' : 'text-muted-foreground'}>
                {icon}
              </span>
              {t(label)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {/* Corner braces toggle for selected building */}
      {selectedBuilding && (
        <div className="flex items-start gap-3 rounded-lg border border-border p-3">
          <svg viewBox="0 0 24 24" className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth={2}>
            <line x1="4" y1="4" x2="4" y2="20" />
            <line x1="4" y1="4" x2="20" y2="4" />
            <line x1="4" y1="12" x2="12" y2="4" strokeWidth={2.5} />
          </svg>
          <div className="flex-1">
            <Label htmlFor="corner-braces" className="cursor-pointer">
              {t('structure.cornerBraces')}
            </Label>
            <p className="text-xs text-muted-foreground">{t('structure.cornerBraces.desc')}</p>
          </div>
          <Checkbox
            id="corner-braces"
            checked={selectedBuilding.hasCornerBraces}
            onCheckedChange={() => toggleBuildingBraces(selectedBuilding.id)}
          />
        </div>
      )}

      {/* Snap connection toggles */}
      {selectedConnections.length > 0 && (
        <div className="space-y-2">
          <SectionLabel>Verbindingen</SectionLabel>
          {selectedConnections.map((c) => {
            const otherId = c.buildingAId === selectedBuildingId ? c.buildingBId : c.buildingAId;
            const otherBuilding = buildings.find(b => b.id === otherId);
            const otherIdx = buildings.findIndex(b => b.id === otherId);
            const side = c.buildingAId === selectedBuildingId ? c.sideA : c.sideB;
            return (
              <div key={`${c.buildingAId}-${c.sideA}-${c.buildingBId}-${c.sideB}`} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                <span className="text-sm text-foreground">
                  {t(`wall.${side}`)} — {otherBuilding ? `${t(`building.name.${otherBuilding.type}`)} ${otherIdx + 1}` : '?'}
                </span>
                <Switch
                  checked={c.isOpen}
                  onCheckedChange={() => toggleConnectionOpen(c.buildingAId, c.sideA, c.buildingBId, c.sideB)}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function BuildingIcon({ type, isSelected }: { type: BuildingType; isSelected: boolean }) {
  const cls = `h-5 w-5 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`;
  if (type === 'overkapping') {
    return (
      <svg viewBox="0 0 48 48" className={cls} fill="none" stroke="currentColor" strokeWidth={2.5}>
        <line x1="6" y1="14" x2="42" y2="14" />
        <line x1="6" y1="14" x2="6" y2="38" />
        <line x1="42" y1="14" x2="42" y2="38" />
        <line x1="24" y1="14" x2="24" y2="38" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 48 48" className={cls} fill="none" stroke="currentColor" strokeWidth={2.5}>
      <rect x="6" y="14" width="36" height="24" />
      <rect x="18" y="26" width="12" height="12" />
    </svg>
  );
}
