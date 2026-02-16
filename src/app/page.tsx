'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import ConfigPanel from '@/components/ui/ConfigPanel';
import SchematicView from '@/components/schematic/SchematicView';
import { exportFloorPlan } from '@/components/schematic/exportFloorPlan';
import { useConfigStore } from '@/store/useConfigStore';
import { t } from '@/lib/i18n';
import type { BuildingConfig } from '@/types/building';

const BuildingScene = dynamic(
  () => import('@/components/canvas/BuildingScene'),
  { ssr: false },
);

function ViewToggle({
  viewMode,
  setViewMode,
  config,
}: {
  viewMode: '3d' | 'plan';
  setViewMode: (v: '3d' | 'plan') => void;
  config: BuildingConfig;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-1 bg-background/80 backdrop-blur-xl rounded-xl shadow-md ring-1 ring-black/[0.08] p-1">
        <button
          onClick={() => setViewMode('3d')}
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
        <button
          onClick={() => setViewMode('plan')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
            viewMode === 'plan'
              ? 'bg-foreground text-background shadow-sm'
              : 'text-foreground/60 hover:text-foreground/80'
          }`}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="1" y="1" width="14" height="14" rx="1" />
            <line x1="6" y1="1" x2="6" y2="15" />
            <line x1="6" y1="8" x2="15" y2="8" />
          </svg>
          {t('view.floorplan')}
        </button>
      </div>

      {viewMode === 'plan' && (
        <button
          onClick={() => exportFloorPlan(config)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium bg-background/80 backdrop-blur-xl shadow-md ring-1 ring-black/[0.08] text-foreground/70 hover:text-foreground hover:bg-background/90 transition-all"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 10v3a1 1 0 001 1h10a1 1 0 001-1v-3" />
            <path d="M8 2v8" />
            <path d="M5 7l3 3 3-3" />
          </svg>
          {t('export.button')}
        </button>
      )}
    </div>
  );
}

export default function Home() {
  const [viewMode, setViewMode] = useState<'3d' | 'plan'>('3d');
  const config = useConfigStore((s) => s.config);

  return (
    <>
      {/* ── Vertical split: mobile + tablet (< 1024px) ── */}
      <div className="flex flex-col h-dvh lg:hidden">
        {/* Viewer */}
        <div className="relative h-[42vh] md:h-[50vh] min-h-0 shrink-0">
          {viewMode === '3d' && <BuildingScene />}
          {viewMode === 'plan' && (
            <div className="absolute inset-0 bg-white">
              <SchematicView />
            </div>
          )}
        </div>

        {/* Toolbar */}
        <div className="flex items-center px-3 py-2 bg-muted/50 border-y border-border/50">
          <ViewToggle viewMode={viewMode} setViewMode={setViewMode} config={config} />
        </div>

        {/* Config panel */}
        <div className="flex-1 min-h-0 overflow-hidden rounded-t-2xl bg-background shadow-[0_-4px_24px_rgba(0,0,0,0.08)]">
          <ConfigPanel />
        </div>
      </div>

      {/* ── Desktop layout: floating panel (>= 1024px) ── */}
      <div className="relative h-dvh hidden lg:block">
        {viewMode === '3d' && (
          <div className="absolute inset-0">
            <BuildingScene />
          </div>
        )}

        {viewMode === 'plan' && (
          <div className="absolute inset-0 bg-white">
            <div className="absolute inset-0 right-[440px]">
              <SchematicView />
            </div>
          </div>
        )}

        <div className="absolute top-3 right-3 bottom-3 w-[420px] z-10">
          <ConfigPanel />
        </div>

        <div className="absolute bottom-4 left-4 z-20">
          <ViewToggle viewMode={viewMode} setViewMode={setViewMode} config={config} />
        </div>
      </div>
    </>
  );
}
