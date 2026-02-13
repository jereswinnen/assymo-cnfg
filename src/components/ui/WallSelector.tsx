'use client';

import { useConfigStore } from '@/store/useConfigStore';
import { getAvailableWallIds, isOverkappingWall, OVERKAPPING_WALL_IDS } from '@/lib/constants';
import { t } from '@/lib/i18n';
import type { WallId } from '@/types/building';

export default function WallSelector() {
  const buildingType = useConfigStore((s) => s.config.buildingType);
  const walls = useConfigStore((s) => s.config.walls);
  const selectedElement = useConfigStore((s) => s.selectedElement);
  const selectElement = useConfigStore((s) => s.selectElement);
  const addOverkappingWall = useConfigStore((s) => s.addOverkappingWall);
  const removeOverkappingWall = useConfigStore((s) => s.removeOverkappingWall);

  const wallIds = getAvailableWallIds(buildingType);

  if (wallIds.length === 0) {
    return (
      <div className="rounded-lg bg-gray-50 border border-dashed border-gray-300 p-4 text-center text-sm text-gray-500">
        {t('walls.disabled')}
      </div>
    );
  }

  const selectedWallId = selectedElement?.type === 'wall' ? selectedElement.id : null;
  const bergingWallIds = wallIds.filter((id) => !isOverkappingWall(id));
  const showOverkapping = buildingType === 'combined';

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">{t('wall.clickToSelect')}</p>

      {/* Berging walls — always present */}
      <div className="flex flex-wrap gap-2">
        {bergingWallIds.map((id: WallId) => (
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

      {/* Overkapping walls — optional with add/remove */}
      {showOverkapping && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Overkapping wanden</p>
          <div className="flex flex-wrap gap-2">
            {OVERKAPPING_WALL_IDS.map((id) => {
              const exists = !!walls[id];
              if (exists) {
                return (
                  <div key={id} className="flex items-center gap-1">
                    <button
                      onClick={() => selectElement({ type: 'wall', id })}
                      className={`rounded-lg border-2 px-3 py-2 text-sm font-medium transition-all ${
                        selectedWallId === id
                          ? 'border-blue-600 bg-blue-50 text-blue-700'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      {t(`wall.${id}`)}
                    </button>
                    <button
                      onClick={() => removeOverkappingWall(id)}
                      className="rounded-lg border-2 border-red-200 px-1.5 py-2 text-sm text-red-500 hover:bg-red-50 hover:border-red-300 transition-all"
                      title="Verwijderen"
                    >
                      &times;
                    </button>
                  </div>
                );
              }
              return (
                <button
                  key={id}
                  onClick={() => addOverkappingWall(id)}
                  className="rounded-lg border-2 border-dashed border-gray-300 px-3 py-2 text-sm font-medium text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-all"
                >
                  + {t(`wall.${id}`)}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
