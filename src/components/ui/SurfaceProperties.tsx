'use client';

import { useConfigStore } from '@/store/useConfigStore';
import { MATERIALS, FINISHES } from '@/lib/constants';
import type { WallId, RoofId } from '@/types/building';

export default function SurfaceProperties() {
  const selectedElement = useConfigStore((s) => s.selectedElement);
  const config = useConfigStore((s) => s.config);
  const updateWall = useConfigStore((s) => s.updateWall);
  const updateRoof = useConfigStore((s) => s.updateRoof);

  if (!selectedElement) {
    return (
      <div className="rounded-lg bg-gray-50 border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
        Click a wall or roof to configure it
      </div>
    );
  }

  const isWall = selectedElement.type === 'wall';
  const surfaceCfg = isWall
    ? config.walls[selectedElement.id as WallId]
    : config.roofs[selectedElement.id as RoofId];

  const label = isWall
    ? `${(selectedElement.id as string).charAt(0).toUpperCase() + (selectedElement.id as string).slice(1)} Wall`
    : selectedElement.id === 'left-panel'
      ? 'Left Roof Panel'
      : 'Right Roof Panel';

  function handleChange(field: string, value: unknown) {
    if (!selectedElement) return;
    if (isWall) {
      updateWall(selectedElement.id as WallId, { [field]: value });
    } else {
      updateRoof(selectedElement.id as RoofId, { [field]: value });
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
        {label} Properties
      </h3>

      {/* Material */}
      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">Material</label>
        <select
          value={surfaceCfg.materialId}
          onChange={(e) => handleChange('materialId', e.target.value)}
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        >
          {MATERIALS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label} — €{m.pricePerSqm}/m²
            </option>
          ))}
        </select>
      </div>

      {/* Finish */}
      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">Finish</label>
        <select
          value={surfaceCfg.finish}
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
            checked={surfaceCfg.insulation}
            onChange={(e) => handleChange('insulation', e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          Insulation
        </label>
        {surfaceCfg.insulation && (
          <div className="ml-6 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Thickness</span>
              <span className="text-gray-500 tabular-nums">
                {surfaceCfg.insulationThickness} mm
              </span>
            </div>
            <input
              type="range"
              min={50}
              max={300}
              step={10}
              value={surfaceCfg.insulationThickness}
              onChange={(e) =>
                handleChange('insulationThickness', parseInt(e.target.value))
              }
              className="w-full accent-blue-600"
            />
          </div>
        )}
      </div>

      {/* Wall-specific options */}
      {isWall && 'hasDoor' in surfaceCfg && (
        <div className="space-y-2 border-t border-gray-200 pt-3">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <input
              type="checkbox"
              checked={(surfaceCfg as { hasDoor: boolean }).hasDoor}
              onChange={(e) => handleChange('hasDoor', e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            Door
          </label>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <input
              type="checkbox"
              checked={(surfaceCfg as { hasWindow: boolean }).hasWindow}
              onChange={(e) => {
                handleChange('hasWindow', e.target.checked);
                if (!e.target.checked) handleChange('windowCount', 0);
                else if ((surfaceCfg as { windowCount: number }).windowCount === 0)
                  handleChange('windowCount', 1);
              }}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            Windows
          </label>
          {(surfaceCfg as { hasWindow: boolean }).hasWindow && (
            <div className="ml-6 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Count</span>
                <span className="text-gray-500 tabular-nums">
                  {(surfaceCfg as { windowCount: number }).windowCount}
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={6}
                step={1}
                value={(surfaceCfg as { windowCount: number }).windowCount}
                onChange={(e) =>
                  handleChange('windowCount', parseInt(e.target.value))
                }
                className="w-full accent-blue-600"
              />
            </div>
          )}
        </div>
      )}

      {/* Roof-specific options */}
      {!isWall && 'hasSkylight' in surfaceCfg && (
        <div className="border-t border-gray-200 pt-3">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <input
              type="checkbox"
              checked={(surfaceCfg as { hasSkylight: boolean }).hasSkylight}
              onChange={(e) => handleChange('hasSkylight', e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            Skylight
          </label>
        </div>
      )}
    </div>
  );
}
