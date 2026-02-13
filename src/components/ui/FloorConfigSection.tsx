'use client';

import { useConfigStore } from '@/store/useConfigStore';
import { FLOOR_MATERIALS } from '@/lib/constants';
import { t } from '@/lib/i18n';

export default function FloorConfigSection() {
  const floorMaterialId = useConfigStore((s) => s.config.floor.materialId);
  const updateFloor = useConfigStore((s) => s.updateFloor);

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500">{t('floor.material')}</p>
      <div className="grid grid-cols-2 gap-2">
        {FLOOR_MATERIALS.map((m) => (
          <button
            key={m.id}
            onClick={() => updateFloor({ materialId: m.id })}
            className={`rounded-lg border-2 px-3 py-2.5 text-sm font-medium transition-all text-left ${
              floorMaterialId === m.id
                ? 'border-blue-600 bg-blue-50 text-blue-700'
                : 'border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
          >
            <span className="flex items-center gap-2">
              {m.id !== 'geen' && (
                <span
                  className="inline-block h-4 w-4 rounded-sm border border-gray-300"
                  style={{ backgroundColor: m.color }}
                />
              )}
              {m.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
