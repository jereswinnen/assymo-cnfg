'use client';

import { useConfigStore } from '@/store/useConfigStore';
import { getAvailableWallIds } from '@/lib/constants';
import { t } from '@/lib/i18n';
import type { WallId } from '@/types/building';

export default function WallSelector() {
  const buildingType = useConfigStore((s) => s.config.buildingType);
  const selectedElement = useConfigStore((s) => s.selectedElement);
  const selectElement = useConfigStore((s) => s.selectElement);

  const wallIds = getAvailableWallIds(buildingType);

  if (wallIds.length === 0) {
    return (
      <div className="rounded-lg bg-gray-50 border border-dashed border-gray-300 p-4 text-center text-sm text-gray-500">
        {t('walls.disabled')}
      </div>
    );
  }

  const selectedWallId = selectedElement?.type === 'wall' ? selectedElement.id : null;

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500">{t('wall.clickToSelect')}</p>
      <div className="flex flex-wrap gap-2">
        {wallIds.map((id: WallId) => (
          <button
            key={id}
            onClick={() => selectElement({ type: 'wall', id })}
            className={`rounded-lg border-2 px-3 py-2 text-sm font-medium transition-all ${
              selectedWallId === id
                ? 'border-blue-600 bg-blue-50 text-blue-700'
                : 'border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
          >
            {t(`wall.${id}`)}
          </button>
        ))}
      </div>
    </div>
  );
}
