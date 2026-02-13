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
      <p className="text-xs text-gray-400">{t('wall.clickToSelect')}</p>

      {/* Berging walls */}
      <div className="grid grid-cols-2 gap-1.5">
        {bergingWallIds.map((id: WallId) => (
          <button
            key={id}
            onClick={() => selectElement({ type: 'wall', id })}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-all ${
              selectedWallId === id
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {t(`wall.${id}`)}
          </button>
        ))}
      </div>

      {/* Overkapping walls */}
      {showOverkapping && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
            Overkapping
          </p>
          {OVERKAPPING_WALL_IDS.map((id) => {
            const exists = !!walls[id];
            const isSelected = selectedWallId === id;
            const label = t(`wall.${id}`).replace('Overkapping ', '');

            return (
              <div
                key={id}
                className={`flex items-center justify-between rounded-lg px-3 py-2 transition-all ${
                  isSelected
                    ? 'bg-blue-600 text-white'
                    : exists
                      ? 'bg-gray-100 text-gray-700'
                      : 'bg-gray-50 text-gray-400'
                }`}
              >
                <button
                  onClick={() => exists ? selectElement({ type: 'wall', id }) : addOverkappingWall(id)}
                  className="flex-1 text-left text-sm font-medium"
                >
                  {label}
                </button>
                {exists ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeOverkappingWall(id);
                    }}
                    className={`ml-2 rounded-md px-1.5 py-0.5 text-xs font-medium transition-colors ${
                      isSelected
                        ? 'text-blue-200 hover:text-white hover:bg-blue-500'
                        : 'text-gray-400 hover:text-red-500 hover:bg-red-50'
                    }`}
                  >
                    Verwijder
                  </button>
                ) : (
                  <span className="text-xs font-medium text-gray-300">+ Toevoegen</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
