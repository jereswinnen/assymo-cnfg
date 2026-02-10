'use client';

import dynamic from 'next/dynamic';
import ConfigPanel from '@/components/ui/ConfigPanel';

const BuildingScene = dynamic(
  () => import('@/components/canvas/BuildingScene'),
  { ssr: false },
);

export default function Home() {
  return (
    <div className="flex h-screen flex-col lg:flex-row">
      {/* 3D Viewport */}
      <div className="flex-1 min-h-[50vh] lg:min-h-0">
        <BuildingScene />
      </div>

      {/* Config Panel */}
      <div className="w-full lg:w-[380px] lg:min-w-[380px] border-t lg:border-t-0 lg:border-l border-gray-200 overflow-y-auto">
        <ConfigPanel />
      </div>
    </div>
  );
}
