'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import CapsuleToolbar from '@/components/ui/CapsuleToolbar';
import SchematicView from '@/components/schematic/SchematicView';
import { exportFloorPlan } from '@/components/schematic/exportFloorPlan';
import { useConfigStore } from '@/store/useConfigStore';
import { t } from '@/lib/i18n';

const BuildingScene = dynamic(
  () => import('@/components/canvas/BuildingScene'),
  { ssr: false },
);

function ViewToggle({
  viewMode,
  setViewMode,
}: {
  viewMode: '3d' | 'plan';
  setViewMode: (v: '3d' | 'plan') => void;
}) {
  const buildings = useConfigStore((s) => s.buildings);
  const connections = useConfigStore((s) => s.connections);
  const roof = useConfigStore((s) => s.roof);

  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-1 bg-background/80 backdrop-blur-xl rounded-xl shadow-md ring-1 ring-black/[0.08] p-1">
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
          2D
        </button>
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
      </div>

      {viewMode === 'plan' && (
        <button
          onClick={() => exportFloorPlan(buildings, connections, roof)}
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
  const [viewMode, setViewMode] = useState<'3d' | 'plan'>('plan');

  return (
    <div className="relative h-dvh">
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
        <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
      </div>

      <CapsuleToolbar />
    </div>
  );
}
