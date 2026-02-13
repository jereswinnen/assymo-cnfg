'use client';

import dynamic from 'next/dynamic';
import ConfigPanel from '@/components/ui/ConfigPanel';

const BuildingScene = dynamic(
  () => import('@/components/canvas/BuildingScene'),
  { ssr: false },
);

export default function Home() {
  return (
    <div className="relative h-screen">
      {/* Full-screen 3D Viewport */}
      <div className="absolute inset-0">
        <BuildingScene />
      </div>

      {/* Floating Config Panel */}
      <div className="absolute top-3 right-3 bottom-3 w-[420px] z-10">
        <ConfigPanel />
      </div>
    </div>
  );
}
