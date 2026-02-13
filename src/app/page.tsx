'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import ConfigPanel from '@/components/ui/ConfigPanel';
import SchematicView from '@/components/schematic/SchematicView';
import { t } from '@/lib/i18n';

const BuildingScene = dynamic(
  () => import('@/components/canvas/BuildingScene'),
  { ssr: false },
);

export default function Home() {
  const [viewMode, setViewMode] = useState<'3d' | 'plan'>('3d');

  return (
    <div className="relative h-screen">
      {/* Full-screen 3D Viewport */}
      {viewMode === '3d' && (
        <div className="absolute inset-0">
          <BuildingScene />
        </div>
      )}

      {/* Full-screen Floor Plan */}
      {viewMode === 'plan' && (
        <div className="absolute inset-0 bg-white">
          <div className="absolute inset-0 right-[440px]">
            <SchematicView />
          </div>
        </div>
      )}

      {/* Floating Config Panel */}
      <div className="absolute top-3 right-3 bottom-3 w-[420px] z-10">
        <ConfigPanel />
      </div>

      {/* View toggle button */}
      <div className="absolute bottom-4 left-4 z-10 flex gap-1 bg-background/80 backdrop-blur-xl rounded-xl shadow-md ring-1 ring-black/[0.08] p-1">
        <button
          onClick={() => setViewMode('3d')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
            viewMode === '3d'
              ? 'bg-foreground text-background shadow-sm'
              : 'text-foreground/60 hover:text-foreground/80'
          }`}
        >
          {/* 3D cube icon */}
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
          {/* Floor plan icon */}
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="1" y="1" width="14" height="14" rx="1" />
            <line x1="6" y1="1" x2="6" y2="15" />
            <line x1="6" y1="8" x2="15" y2="8" />
          </svg>
          {t('view.floorplan')}
        </button>
      </div>
    </div>
  );
}
