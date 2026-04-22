'use client';

import { Suspense, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import Sidebar from '@/components/ui/ConfiguratorSidebar';
import SchematicView from '@/components/schematic/SchematicView';
import { useUIStore } from '@/store/useUIStore';
import { useConfigStore } from '@/store/useConfigStore';
import { useTenant } from '@/lib/TenantProvider';
import { applyProductDefaults } from '@/domain/catalog';
import { t } from '@/lib/i18n';
import { useUndoRedo } from '@/hooks/useUndoRedo';
import { useGPUQuality } from '@/hooks/useGPUQuality';

const BuildingScene = dynamic(
  () => import('@/components/canvas/BuildingScene'),
  { ssr: false },
);

/** Reads `?product=<slug>`, `?code=<code>`, or `?fresh=1` from the URL on
 *  first mount and hydrates the scene accordingly. Precedence:
 *   - `product`: instantiate one building from that product's defaults.
 *   - `code`: fetch the saved scene from `/api/configs/[code]` and load it.
 *   - `fresh`: reset the store to an empty canvas (used by "Bouw van nul"
 *     so persisted state doesn't bleed in).
 *  No-query navigation preserves whatever the persist middleware rehydrated.
 *  Extracted into its own component because useSearchParams() requires a
 *  Suspense boundary in the App Router. */
function SceneHydration() {
  const { catalog } = useTenant();
  const params = useSearchParams();
  const productSlug = params.get('product');
  const code = params.get('code');
  const fresh = params.get('fresh');
  const replaceWithProduct = useConfigStore((s) => s.replaceWithProduct);
  const resetConfig = useConfigStore((s) => s.resetConfig);
  const loadState = useConfigStore((s) => s.loadState);

  useEffect(() => {
    if (productSlug) {
      const product = catalog.products.find((p) => p.slug === productSlug);
      if (!product) return;
      const defaults = applyProductDefaults(product);
      replaceWithProduct(defaults);
      return;
    }
    if (code) {
      let cancelled = false;
      fetch(`/api/configs/${code}`)
        .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
        .then((body) => {
          if (cancelled) return;
          const d = body.data as {
            buildings: Parameters<typeof loadState>[0];
            connections: Parameters<typeof loadState>[1];
            roof: Parameters<typeof loadState>[2];
            defaultHeight?: number;
          };
          loadState(d.buildings, d.connections, d.roof, d.defaultHeight);
        })
        .catch(() => {
          // Silent fail — leaves whatever was persisted in place.
        });
      return () => { cancelled = true; };
    }
    if (fresh) {
      resetConfig();
    }
    // Only run once on initial mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

function ViewToggle() {
  const viewMode = useUIStore((s) => s.viewMode);
  const setViewMode = useUIStore((s) => s.setViewMode);
  const selectedElement = useUIStore((s) => s.selectedElement);
  const selectElement = useUIStore((s) => s.selectElement);
  const isElevationMode = selectedElement?.type === 'wall';

  return (
    <div className="flex items-center gap-2">
      {isElevationMode && (
        <div className="bg-background/80 backdrop-blur-xl rounded-xl shadow-md ring-1 ring-black/[0.08] p-1">
          <button
            onClick={() => selectElement(null)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-foreground/60 hover:text-foreground/80 transition-all"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="8" x2="4" y2="8" />
              <polyline points="8 4 4 8 8 12" />
            </svg>
            {t('view.backToFloorplan')}
          </button>
        </div>
      )}
      <div className="flex gap-1 bg-background/80 backdrop-blur-xl rounded-xl shadow-md ring-1 ring-black/[0.08] p-1">
        <button
          onClick={() => { if (isElevationMode) selectElement(null); setViewMode('plan'); }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
            viewMode === 'plan' && !isElevationMode
              ? 'bg-foreground text-background shadow-sm'
              : 'text-foreground/60 hover:text-foreground/80'
          }`}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="1" y="1" width="14" height="14" rx="1" />
            <line x1="6" y1="1" x2="6" y2="15" />
            <line x1="6" y1="8" x2="15" y2="8" />
          </svg>
          2D
        </button>
        <button
          onClick={() => { if (isElevationMode) selectElement(null); setViewMode('split'); }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
            viewMode === 'split'
              ? 'bg-foreground text-background shadow-sm'
              : 'text-foreground/60 hover:text-foreground/80'
          }`}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="1" y="1" width="14" height="14" rx="1" />
            <line x1="8" y1="1" x2="8" y2="15" />
          </svg>
          Split
        </button>
        <button
          onClick={() => { if (isElevationMode) selectElement(null); setViewMode('3d'); }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
            viewMode === '3d'
              ? 'bg-foreground text-background shadow-sm'
              : 'text-foreground/60 hover:text-foreground/80'
          }`}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 1L14.5 4.75V11.25L8 15L1.5 11.25V4.75L8 1Z" />
            <path d="M8 15V8" />
            <path d="M14.5 4.75L8 8L1.5 4.75" />
          </svg>
          3D
        </button>
      </div>
    </div>
  );
}

export default function ConfiguratorClient() {
  useUndoRedo();
  useGPUQuality();
  const viewMode = useUIStore((s) => s.viewMode);

  // Note: h-full (not h-dvh) here — the BrandedShell's <main> provides
  // the remaining-viewport sizing below the header. Using h-dvh would
  // double-count the header and cause vertical overflow.
  return (
    <div className="relative h-full flex">
      {/* Hydrate the scene from ?product=<slug> when the store is empty. */}
      <Suspense fallback={null}>
        <SceneHydration />
      </Suspense>
      {viewMode === 'split' ? (
        <>
          <div className="w-1/2 relative border-r border-black/10">
            <div className="absolute inset-0 bg-white">
              <SchematicView />
            </div>
            <div className="absolute top-3 left-3 z-20">
              <ViewToggle />
            </div>
          </div>
          <div className="flex-1 relative">
            <div className="absolute inset-0">
              <BuildingScene />
            </div>
          </div>
        </>
      ) : (
        <div className="flex-1 relative">
          {viewMode === '3d' && (
            <div className="absolute inset-0">
              <BuildingScene />
            </div>
          )}
          {viewMode === 'plan' && (
            <div className="absolute inset-0 bg-white">
              <SchematicView />
            </div>
          )}
          <div className="absolute top-3 left-3 z-20">
            <ViewToggle />
          </div>
        </div>
      )}
      <Sidebar />
    </div>
  );
}
