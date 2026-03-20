'use client';

import { useConfigStore, getEffectiveHeight } from '@/store/useConfigStore';
import { exportFloorPlan } from '@/components/schematic/exportFloorPlan';
import { t } from '@/lib/i18n';
import { RotateCcw, Download } from 'lucide-react';
import ConfigCodeDialog from './ConfigCodeDialog';
import type { BuildingType } from '@/types/building';

const CATALOG_ITEMS: { type: BuildingType; icon: string }[] = [
  { type: 'berging', icon: '🏠' },
  { type: 'overkapping', icon: '☂️' },
  { type: 'paal', icon: '📍' },
  { type: 'muur', icon: '🧱' },
];

export default function ObjectsTab() {
  const buildings = useConfigStore((s) => s.buildings);
  const selectedBuildingId = useConfigStore((s) => s.selectedBuildingId);
  const defaultHeight = useConfigStore((s) => s.defaultHeight);
  const addBuilding = useConfigStore((s) => s.addBuilding);
  const removeBuilding = useConfigStore((s) => s.removeBuilding);
  const selectBuilding = useConfigStore((s) => s.selectBuilding);
  const resetConfig = useConfigStore((s) => s.resetConfig);
  const viewMode = useConfigStore((s) => s.viewMode);

  const handleDragStart = (e: React.DragEvent, type: BuildingType) => {
    e.dataTransfer.setData('application/building-type', type);
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Catalog grid */}
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
            {viewMode === 'plan' ? t('sidebar.catalog.dragHint') : t('sidebar.catalog.switchTo2D')}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {CATALOG_ITEMS.map(({ type, icon }) => (
              <div
                key={type}
                draggable={viewMode === 'plan'}
                onDragStart={(e) => handleDragStart(e, type)}
                onClick={() => {
                  if (viewMode === 'plan') addBuilding(type);
                }}
                className={`flex flex-col items-center gap-1 rounded-lg border border-border p-3 select-none transition-all ${
                  viewMode === 'plan'
                    ? 'cursor-grab hover:border-primary/40 hover:bg-primary/5'
                    : 'opacity-50 cursor-not-allowed'
                }`}
              >
                <span className="text-xl">{icon}</span>
                <span className="text-xs font-medium text-muted-foreground">
                  {t(`building.name.${type}`)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Placed objects list */}
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
            {t('sidebar.placed')} ({buildings.length})
          </p>
          <div className="space-y-1">
            {buildings.map((b) => {
              const isSelected = b.id === selectedBuildingId;
              const typeLabel = t(`building.name.${b.type}`);
              // Per-type numbering: count how many of this type appear before this one
              const typeIndex = buildings.filter(x => x.type === b.type).indexOf(b) + 1;
              const effectiveH = getEffectiveHeight(b, defaultHeight);
              const structuralCount = buildings.filter(x => x.type !== 'paal' && x.type !== 'muur').length;
              const canDelete = b.type === 'paal' || b.type === 'muur' || structuralCount > 1;

              return (
                <div
                  key={b.id}
                  onClick={() => selectBuilding(b.id)}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer transition-all ${
                    isSelected
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'border-border hover:border-primary/40'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <span className={`text-sm font-medium ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                      {typeLabel} {typeIndex}
                    </span>
                    <span className="block text-[11px] text-muted-foreground tabular-nums">
                      {b.type === 'paal'
                        ? `${effectiveH.toFixed(1)}m`
                        : b.type === 'muur'
                        ? `${b.dimensions.width.toFixed(1)} × ${effectiveH.toFixed(1)}m`
                        : `${b.dimensions.width.toFixed(1)} × ${b.dimensions.depth.toFixed(1)} × ${effectiveH.toFixed(1)}m`
                      }
                    </span>
                  </div>
                  {canDelete && (
                    <button
                      onClick={(e) => { e.stopPropagation(); removeBuilding(b.id); }}
                      className="text-xs text-muted-foreground hover:text-destructive transition-colors px-1"
                    >
                      ✕
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer: Reset + ConfigCode + Export */}
      <SidebarFooter resetConfig={resetConfig} viewMode={viewMode} />
    </div>
  );
}

function SidebarFooter({ resetConfig, viewMode }: { resetConfig: () => void; viewMode: string }) {
  const buildings = useConfigStore((s) => s.buildings);
  const connections = useConfigStore((s) => s.connections);
  const roof = useConfigStore((s) => s.roof);
  const defaultHeight = useConfigStore((s) => s.defaultHeight);

  return (
    <div className="shrink-0 border-t border-border p-3 flex items-center gap-2">
      <button
        onClick={resetConfig}
        className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
      >
        <RotateCcw className="h-3.5 w-3.5" />
        {t('app.reset')}
      </button>
      <ConfigCodeDialog />
      {viewMode === 'plan' && (
        <button
          onClick={() => exportFloorPlan(buildings, connections, roof, defaultHeight)}
          className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground transition-colors ml-auto"
        >
          <Download className="h-3.5 w-3.5" />
          {t('export.button')}
        </button>
      )}
    </div>
  );
}
