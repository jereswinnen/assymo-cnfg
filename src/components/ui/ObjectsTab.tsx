'use client';

import { useMemo } from 'react';
import { useConfigStore, getEffectiveHeight } from '@/store/useConfigStore';
import { useUIStore, selectSingleBuildingId } from "@/store/useUIStore";
import { t } from '@/lib/i18n';
import { useTenant } from '@/lib/TenantProvider';
import { applyProductDefaults, type MaterialCategory } from '@/domain/catalog';
import type { BuildingType } from '@/domain/building';
import { BUILDING_KIND_META } from '@/domain/building/kinds';
import { filterTrayEntries } from '@/lib/tray';

const TRAY_VIEW: Record<BuildingType, { icon: string }> = {
  paal:        { icon: '📍' },
  muur:        { icon: '🧱' },
  poort:       { icon: '🚪' },
  berging:     { icon: '🏠' },
  overkapping: { icon: '☂️' },
};

export default function ObjectsTab() {
  const buildings = useConfigStore((s) => s.buildings);
  const selectedBuildingId = useUIStore(selectSingleBuildingId);
  const defaultHeight = useConfigStore((s) => s.defaultHeight);
  const addBuilding = useConfigStore((s) => s.addBuilding);
  const removeBuilding = useConfigStore((s) => s.removeBuilding);
  const selectBuilding = useUIStore((s) => s.selectBuilding);
  const viewMode = useUIStore((s) => s.viewMode);
  const { catalog } = useTenant();
  const hasProducts = catalog.products.length > 0;

  const availableCategories = useMemo<ReadonlySet<MaterialCategory>>(() => {
    const set = new Set<MaterialCategory>();
    for (const m of catalog.materials) {
      if (m.archivedAt) continue;
      for (const c of m.categories) set.add(c);
    }
    return set;
  }, [catalog.materials]);

  const { primitives: primitiveEntries, structurals: structuralEntries } = useMemo(
    () => filterTrayEntries(BUILDING_KIND_META, availableCategories),
    [availableCategories],
  );

  const handleDragStart = (e: React.DragEvent, type: BuildingType) => {
    e.dataTransfer.setData('application/building-type', type);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const canAdd = viewMode !== '3d';

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-3 space-y-4 pb-6">
        {/* Hint text */}
        <p className="text-xs text-muted-foreground uppercase tracking-wider">
          {canAdd ? t('sidebar.catalog.dragHint') : t('sidebar.catalog.switchTo2D')}
        </p>

        {/* Bouwsets — product cards (shown only when tenant has products) */}
        {hasProducts && (
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">
              {t('configurator.tray.kits')}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {catalog.products.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  disabled={!canAdd}
                  onClick={() => {
                    if (!canAdd) return;
                    const defaults = applyProductDefaults(p);
                    addBuilding(p.kind, undefined, defaults);
                  }}
                  className={`rounded-lg border border-border p-2 text-left select-none transition-all ${
                    canAdd
                      ? 'hover:border-primary/40 hover:bg-primary/5 cursor-pointer'
                      : 'opacity-50 cursor-not-allowed'
                  }`}
                >
                  {p.heroImage && (
                    <img
                      src={p.heroImage}
                      alt=""
                      className="mb-2 aspect-[4/3] w-full rounded object-cover"
                    />
                  )}
                  <div className="text-xs font-medium text-foreground">{p.name}</div>
                  {p.basePriceCents > 0 && (
                    <div className="text-[11px] text-muted-foreground">
                      {t('landing.product.fromPrice', { amount: Math.floor(p.basePriceCents / 100).toString() })}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Losse elementen — primitives (paal + muur always; overkapping + berging as fallback) */}
        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">
            {t('configurator.tray.primitives')}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {primitiveEntries.map(({ type }) => (
              <div
                key={type}
                draggable={canAdd}
                onDragStart={(e) => handleDragStart(e, type)}
                onClick={() => {
                  if (canAdd) addBuilding(type);
                }}
                className={`flex flex-col items-center gap-1 rounded-lg border border-border p-3 select-none transition-all ${
                  canAdd
                    ? 'cursor-grab hover:border-primary/40 hover:bg-primary/5'
                    : 'opacity-50 cursor-not-allowed'
                }`}
              >
                <span className="text-xl">{TRAY_VIEW[type].icon}</span>
                <span className="text-xs font-medium text-muted-foreground">
                  {t(`building.name.${type}`)}
                </span>
              </div>
            ))}
            {!hasProducts && structuralEntries.map(({ type }) => (
              <div
                key={type}
                draggable={canAdd}
                onDragStart={(e) => handleDragStart(e, type)}
                onClick={() => {
                  if (canAdd) addBuilding(type);
                }}
                className={`flex flex-col items-center gap-1 rounded-lg border border-border p-3 select-none transition-all ${
                  canAdd
                    ? 'cursor-grab hover:border-primary/40 hover:bg-primary/5'
                    : 'opacity-50 cursor-not-allowed'
                }`}
              >
                <span className="text-xl">{TRAY_VIEW[type].icon}</span>
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
                  <button
                    onClick={(e) => { e.stopPropagation(); removeBuilding(b.id); }}
                    className="text-xs text-muted-foreground hover:text-destructive transition-colors px-1"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

    </div>
  );
}
