'use client';

import { useState } from 'react';
import { useConfigStore } from '@/store/useConfigStore';
import { randomId } from '@/domain/random';
import { useTenant } from '@/lib/TenantProvider';
import { t } from '@/lib/i18n';
import {
  WIN_W, WIN_W_DEFAULT, WIN_H_DEFAULT, WIN_SILL_DEFAULT,
  getWallLength, findBestNewPosition, DOOR_W, DOUBLE_DOOR_W,
  EDGE_CLEARANCE, OPENING_GAP,
} from '@/domain/building';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, X } from 'lucide-react';
import type { WallId, WallWindow } from '@/domain/building';
import { resolveWindowControls } from '@/domain/openings';
import { useUIStore } from '@/store/useUIStore';
import type { WindowMeta } from '@/domain/supplier';

interface WindowConfigProps {
  wallId: WallId;
  buildingId: string;
}

export default function WindowConfig({ wallId, buildingId }: WindowConfigProps) {
  const wallCfg = useConfigStore((s) => {
    const b = s.buildings.find(b => b.id === buildingId);
    return b?.walls[wallId] ?? null;
  });
  const building = useConfigStore((s) => s.buildings.find(b => b.id === buildingId));
  const updateBuildingWall = useConfigStore((s) => s.updateBuildingWall);
  const setWindowSupplierProduct = useConfigStore((s) => s.setWindowSupplierProduct);
  const setWallWindowSegmentOverride = useConfigStore((s) => s.setWallWindowSegmentOverride);
  const windowAnimations = useUIStore((s) => s.windowAnimations);
  const toggleWindowOpen = useUIStore((s) => s.toggleWindowOpen);

  const { supplierCatalog } = useTenant();
  const supplierWindows = supplierCatalog.products.filter(
    (p) => p.kind === 'window' && p.archivedAt === null,
  );
  const [modeOverrides, setModeOverrides] = useState<Record<string, 'custom' | 'catalog'>>({});

  if (!wallCfg || !building) return null;

  const windows = wallCfg.windows ?? [];
  const hasWindows = windows.length > 0;
  const wallLength = getWallLength(wallId, building.dimensions);

  const usableLen = wallLength - 2 * EDGE_CLEARANCE;
  const maxWindows = Math.max(0, Math.floor(usableLen / (WIN_W + OPENING_GAP)));

  function addWindow() {
    const existingOpenings: { position: number; width: number }[] = windows.map(w => ({
      position: w.position,
      width: w.width ?? WIN_W,
    }));
    if (wallCfg!.hasDoor) {
      const dw = wallCfg!.doorSize === 'dubbel' ? DOUBLE_DOOR_W : DOOR_W;
      existingOpenings.push({ position: wallCfg!.doorPosition ?? 0.5, width: dw });
    }
    const pos = findBestNewPosition(wallLength, WIN_W, existingOpenings);
    const win: WallWindow = {
      id: randomId(),
      position: pos,
      width: WIN_W_DEFAULT,
      height: WIN_H_DEFAULT,
      sillHeight: WIN_SILL_DEFAULT,
    };
    updateBuildingWall(buildingId, wallId, { windows: [...windows, win] });
  }

  function removeWindow(id: string) {
    updateBuildingWall(buildingId, wallId, {
      windows: windows.filter(w => w.id !== id),
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-medium text-sm">{t('surface.windows')}</span>
        {windows.length < maxWindows && (
          <button
            onClick={addWindow}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Toevoegen
          </button>
        )}
      </div>
      {hasWindows && (
        <div className="space-y-2">
          {windows.map((win, i) => {
            const w = win.width ?? WIN_W_DEFAULT;
            const h = win.height ?? WIN_H_DEFAULT;
            const derivedMode: 'custom' | 'catalog' = win.supplierProductId ? 'catalog' : 'custom';
            const mode = modeOverrides[win.id] ?? derivedMode;
            const activeProduct = win.supplierProductId
              ? supplierCatalog.products.find(p => p.id === win.supplierProductId) ?? null
              : null;
            const activeSupplier = activeProduct
              ? supplierCatalog.suppliers.find(s => s.id === activeProduct.supplierId) ?? null
              : null;

            const dimLabel = activeProduct
              ? `${activeProduct.widthMm} × ${activeProduct.heightMm} mm`
              : `${(w * 100).toFixed(0)} × ${(h * 100).toFixed(0)}`;

            return (
              <div
                key={win.id}
                className="rounded-lg border border-border/50 bg-background overflow-hidden"
              >
                {/* Header row */}
                <div className="flex items-center justify-between px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-4 rounded-sm border border-sky-300 bg-sky-50" />
                    <span className="text-sm">Raam {i + 1}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {dimLabel}
                    </span>
                    <button
                      onClick={() => removeWindow(win.id)}
                      className="text-muted-foreground/50 hover:text-destructive transition-colors p-0.5 -mr-1"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Mode tabs */}
                <div className="border-t border-border/50 px-3 py-2 bg-muted/20">
                  <Tabs
                    value={mode}
                    onValueChange={(v) => {
                      const next = v as 'custom' | 'catalog';
                      setModeOverrides((prev) => ({ ...prev, [win.id]: next }));
                      if (next === 'custom') {
                        setWindowSupplierProduct(buildingId, wallId, win.id, null);
                      }
                    }}
                  >
                    <TabsList className="w-full">
                      <TabsTrigger value="custom" className="flex-1 text-xs">
                        {t('configurator.window.tab.custom')}
                      </TabsTrigger>
                      <TabsTrigger value="catalog" className="flex-1 text-xs">
                        {t('configurator.window.tab.catalog')}
                      </TabsTrigger>
                    </TabsList>

                    {/* Eigen keuze — no extra controls for now; dimensions are fixed presets */}
                    <TabsContent value="custom" className="mt-2">
                      <p className="text-[11px] text-muted-foreground">
                        {t('configurator.supplier.picker.dimensions', { width: Math.round(w * 1000), height: Math.round(h * 1000) })}
                      </p>
                    </TabsContent>

                    {/* Uit catalogus */}
                    <TabsContent value="catalog" className="mt-2 space-y-2">
                      {supplierWindows.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-1">
                          {t('configurator.supplier.picker.empty')}
                        </p>
                      ) : (
                        <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                          {supplierWindows.map((prod) => {
                            const supplier = supplierCatalog.suppliers.find(s => s.id === prod.supplierId);
                            const isSelected = win.supplierProductId === prod.id;
                            return (
                              <Card
                                key={prod.id}
                                className={`cursor-pointer transition-colors ${isSelected ? 'ring-2 ring-primary border-primary' : 'hover:bg-muted/30'}`}
                                onClick={() => setWindowSupplierProduct(buildingId, wallId, win.id, prod.id)}
                              >
                                <CardContent className="p-2 flex gap-2 items-start">
                                  {prod.heroImage ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={prod.heroImage}
                                      alt={prod.name}
                                      className="w-10 h-10 object-cover rounded shrink-0"
                                    />
                                  ) : (
                                    <div className="w-10 h-10 rounded bg-muted shrink-0" />
                                  )}
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs font-medium truncate">{prod.name}</p>
                                    {supplier && (
                                      <p className="text-[11px] text-muted-foreground truncate">{supplier.name}</p>
                                    )}
                                    <p className="text-[11px] text-muted-foreground">
                                      {t('configurator.supplier.picker.dimensions', { width: prod.widthMm, height: prod.heightMm })}
                                    </p>
                                    <p className="text-[11px] font-medium">
                                      {t('configurator.supplier.picker.price', { price: (prod.priceCents / 100).toFixed(0) })}
                                    </p>
                                  </div>
                                </CardContent>
                              </Card>
                            );
                          })}
                        </div>
                      )}
                      {activeProduct && activeSupplier && (
                        <p className="text-[11px] text-muted-foreground">
                          {t('configurator.supplier.lockInfo', {
                            supplier: activeSupplier.name,
                            width: activeProduct.widthMm,
                            height: activeProduct.heightMm,
                          })}
                        </p>
                      )}
                      {win.supplierProductId && (
                        <button
                          onClick={() => setWindowSupplierProduct(buildingId, wallId, win.id, null)}
                          className="text-xs text-muted-foreground hover:text-foreground transition-colors underline"
                        >
                          {t('configurator.supplier.clearSelection')}
                        </button>
                      )}
                    </TabsContent>
                  </Tabs>
                </div>

                {(() => {
                  const product = activeProduct;
                  if (!product) return null;
                  const productMeta = product.meta as WindowMeta;
                  const segEnabled = !!productMeta.segments?.enabled;
                  const sfEnabled = !!productMeta.schuifraam?.enabled;
                  if (!segEnabled && !sfEnabled) return null;

                  const ctrl = resolveWindowControls(win, product);
                  const overrideValue = win.segmentCountOverride;
                  const declaredMax = productMeta.segments?.maxCount ?? 8;
                  const maxOptions = Math.max(declaredMax, overrideValue ?? 0);
                  const isAuto = overrideValue === undefined;
                  const autoCount = ctrl.segments.count;

                  return (
                    <div className="border-t border-border/50 px-3 py-2 space-y-2">
                      <p className="text-[11px] font-medium text-muted-foreground">
                        {t('configurator.window.controls.section')}
                      </p>

                      {segEnabled && (
                        <div className="space-y-1">
                          <p className="text-xs">{t('configurator.window.controls.segments')}</p>
                          <div className="flex flex-wrap gap-1">
                            <button
                              type="button"
                              onClick={() => setWallWindowSegmentOverride(buildingId, wallId, win.id, null)}
                              className={`px-2 py-0.5 rounded text-xs border ${
                                isAuto
                                  ? 'bg-foreground text-background border-foreground'
                                  : 'border-border hover:bg-muted/50'
                              }`}
                            >
                              {isAuto
                                ? t('configurator.window.controls.segments.autoHint', { count: autoCount })
                                : t('configurator.window.controls.segments.auto')}
                            </button>
                            {Array.from({ length: maxOptions + 1 }, (_, n) => (
                              <button
                                key={n}
                                type="button"
                                onClick={() => setWallWindowSegmentOverride(buildingId, wallId, win.id, n)}
                                className={`px-2 py-0.5 rounded text-xs border tabular-nums ${
                                  !isAuto && overrideValue === n
                                    ? 'bg-foreground text-background border-foreground'
                                    : 'border-border hover:bg-muted/50'
                                }`}
                              >
                                {n}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {sfEnabled && (
                        <button
                          type="button"
                          onClick={() => toggleWindowOpen(win.id)}
                          className="text-xs px-2 py-1 rounded border border-border hover:bg-muted/50"
                        >
                          {windowAnimations[win.id]?.open
                            ? t('configurator.window.controls.schuifraam.close')
                            : t('configurator.window.controls.schuifraam.open')}
                        </button>
                      )}
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      )}
      {!hasWindows && (
        <button
          onClick={addWindow}
          className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-border/70 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:border-border transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Raam toevoegen
        </button>
      )}
    </div>
  );
}
