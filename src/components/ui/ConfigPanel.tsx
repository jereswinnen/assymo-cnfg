'use client';

import DimensionsControl from './DimensionsControl';
import SurfaceProperties from './SurfaceProperties';
import QuoteSummary from './QuoteSummary';
import { useConfigStore } from '@/store/useConfigStore';

export default function ConfigPanel() {
  const resetConfig = useConfigStore((s) => s.resetConfig);

  return (
    <aside className="flex h-full flex-col overflow-y-auto bg-white">
      <div className="border-b border-gray-200 px-5 py-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Configurator</h2>
          <button
            onClick={resetConfig}
            className="text-xs font-medium text-gray-500 hover:text-red-600 transition-colors"
          >
            Reset
          </button>
        </div>
      </div>

      <div className="flex-1 space-y-6 p-5">
        <DimensionsControl />

        <div className="border-t border-gray-200 pt-4">
          <SurfaceProperties />
        </div>

        <div className="border-t border-gray-200 pt-4">
          <QuoteSummary />
        </div>
      </div>
    </aside>
  );
}
