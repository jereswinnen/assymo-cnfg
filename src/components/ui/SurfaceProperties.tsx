'use client';

import { useConfigStore } from '@/store/useConfigStore';
import { WALL_MATERIALS, FINISHES } from '@/lib/constants';
import { t } from '@/lib/i18n';
import type { WallId } from '@/types/building';

export default function SurfaceProperties() {
  const selectedElement = useConfigStore((s) => s.selectedElement);
  const config = useConfigStore((s) => s.config);
  const updateWall = useConfigStore((s) => s.updateWall);

  if (!selectedElement || selectedElement.type !== 'wall') {
    return (
      <div className="rounded-lg bg-gray-50 border border-dashed border-gray-300 p-4 text-center text-sm text-gray-500">
        {t('wall.select')}
      </div>
    );
  }

  const wallId = selectedElement.id as WallId;
  const wallCfg = config.walls[wallId];
  if (!wallCfg) return null;

  const label = t(`wall.${wallId}`);

  function handleChange(field: string, value: unknown) {
    updateWall(wallId, { [field]: value });
  }

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold text-gray-900">
        {label} — {t('surface.properties')}
      </h4>

      {/* Material */}
      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">{t('surface.material')}</label>
        <select
          value={wallCfg.materialId}
          onChange={(e) => handleChange('materialId', e.target.value)}
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        >
          {WALL_MATERIALS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label} — €{m.pricePerSqm}/m²
            </option>
          ))}
        </select>
      </div>

      {/* Finish */}
      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">{t('surface.finish')}</label>
        <select
          value={wallCfg.finish}
          onChange={(e) => handleChange('finish', e.target.value)}
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        >
          {FINISHES.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </div>

      {/* Insulation */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <input
            type="checkbox"
            checked={wallCfg.insulation}
            onChange={(e) => handleChange('insulation', e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          {t('surface.insulation')}
        </label>
        {wallCfg.insulation && (
          <div className="ml-6 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">{t('surface.thickness')}</span>
              <span className="text-gray-500 tabular-nums">{wallCfg.insulationThickness} mm</span>
            </div>
            <input
              type="range"
              min={50}
              max={300}
              step={10}
              value={wallCfg.insulationThickness}
              onChange={(e) => handleChange('insulationThickness', parseInt(e.target.value))}
              className="w-full accent-blue-600"
            />
          </div>
        )}
      </div>

      {/* Door & Windows */}
      <div className="space-y-2 border-t border-gray-200 pt-3">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <input
            type="checkbox"
            checked={wallCfg.hasDoor}
            onChange={(e) => handleChange('hasDoor', e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          {t('surface.door')}
        </label>
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <input
            type="checkbox"
            checked={wallCfg.hasWindow}
            onChange={(e) => {
              handleChange('hasWindow', e.target.checked);
              if (!e.target.checked) handleChange('windowCount', 0);
              else if (wallCfg.windowCount === 0) handleChange('windowCount', 1);
            }}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          {t('surface.windows')}
        </label>
        {wallCfg.hasWindow && (
          <div className="ml-6 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">{t('surface.windowCount')}</span>
              <span className="text-gray-500 tabular-nums">{wallCfg.windowCount}</span>
            </div>
            <input
              type="range"
              min={1}
              max={6}
              step={1}
              value={wallCfg.windowCount}
              onChange={(e) => handleChange('windowCount', parseInt(e.target.value))}
              className="w-full accent-blue-600"
            />
          </div>
        )}
      </div>
    </div>
  );
}
