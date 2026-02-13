'use client';

import { useConfigStore } from '@/store/useConfigStore';
import { WALL_MATERIALS, FINISHES, DOOR_MATERIALS } from '@/lib/constants';
import { t } from '@/lib/i18n';
import type { WallId } from '@/types/building';

function SegmentedControl({
  options,
  value,
  onChange,
  size = 'sm',
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  size?: 'sm' | 'xs';
}) {
  return (
    <div className="flex rounded-lg bg-gray-100 p-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`flex-1 rounded-md font-medium transition-all ${
            size === 'xs' ? 'px-2 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'
          } ${
            value === opt.value
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

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
  const isGlass = wallCfg.materialId === 'glass';

  function handleChange(field: string, value: unknown) {
    updateWall(wallId, { [field]: value });
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="h-3 w-3 rounded-full bg-blue-600" />
        <h4 className="text-sm font-semibold text-gray-900">{label}</h4>
      </div>

      {/* Material selector — visual buttons */}
      <div>
        <label className="mb-1.5 block text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
          {t('surface.material')}
        </label>
        <div className="grid grid-cols-5 gap-1.5">
          {WALL_MATERIALS.map((m) => (
            <button
              key={m.id}
              onClick={() => {
                handleChange('materialId', m.id);
                if (m.id === 'glass') {
                  handleChange('hasDoor', false);
                  handleChange('hasWindow', false);
                  handleChange('windowCount', 0);
                }
              }}
              className={`flex flex-col items-center gap-1 rounded-lg p-2 transition-all ${
                wallCfg.materialId === m.id
                  ? 'bg-blue-50 ring-2 ring-blue-600'
                  : 'bg-gray-50 hover:bg-gray-100'
              }`}
            >
              <span
                className="h-6 w-6 rounded-md border border-gray-200"
                style={{
                  backgroundColor: m.id === 'glass' ? '#B8D4E3' : m.color,
                  opacity: m.id === 'glass' ? 0.5 : 1,
                }}
              />
              <span className="text-[10px] font-medium text-gray-600 leading-tight">{m.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Finish */}
      {!isGlass && (
        <div>
          <label className="mb-1.5 block text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
            {t('surface.finish')}
          </label>
          <SegmentedControl
            options={FINISHES.map((f) => ({ value: f, label: f }))}
            value={wallCfg.finish}
            onChange={(v) => handleChange('finish', v)}
            size="xs"
          />
        </div>
      )}

      {isGlass && (
        <p className="text-xs text-gray-400 italic">Glaswand van zijde tot zijde</p>
      )}

      {/* Door section */}
      {!isGlass && (
        <div className={`rounded-lg transition-all ${
          wallCfg.hasDoor ? 'bg-gray-50 p-3' : ''
        }`}>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={wallCfg.hasDoor}
              onChange={(e) => handleChange('hasDoor', e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            {t('surface.door')}
          </label>
          {wallCfg.hasDoor && (
            <div className="mt-3 space-y-2.5">
              <SegmentedControl
                options={DOOR_MATERIALS.map((m) => ({
                  value: m.id,
                  label: t(`surface.doorMaterial.${m.id}`),
                }))}
                value={wallCfg.doorMaterialId}
                onChange={(v) => handleChange('doorMaterialId', v)}
                size="xs"
              />
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <SegmentedControl
                    options={[
                      { value: 'enkel', label: t('surface.doorSize.enkel') },
                      { value: 'dubbel', label: t('surface.doorSize.dubbel') },
                    ]}
                    value={wallCfg.doorSize}
                    onChange={(v) => handleChange('doorSize', v)}
                    size="xs"
                  />
                </div>
                <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer select-none whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={wallCfg.doorHasWindow}
                    onChange={(e) => handleChange('doorHasWindow', e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  Raam
                </label>
              </div>
              <SegmentedControl
                options={[
                  { value: 'links', label: t('surface.doorPosition.links') },
                  { value: 'midden', label: t('surface.doorPosition.midden') },
                  { value: 'rechts', label: t('surface.doorPosition.rechts') },
                ]}
                value={wallCfg.doorPosition}
                onChange={(v) => handleChange('doorPosition', v)}
                size="xs"
              />
              <SegmentedControl
                options={[
                  { value: 'dicht', label: t('surface.doorSwing.dicht') },
                  { value: 'naar_binnen', label: t('surface.doorSwing.naar_binnen') },
                  { value: 'naar_buiten', label: t('surface.doorSwing.naar_buiten') },
                ]}
                value={wallCfg.doorSwing}
                onChange={(v) => handleChange('doorSwing', v)}
                size="xs"
              />
            </div>
          )}
        </div>
      )}

      {/* Windows section */}
      {!isGlass && (
        <div className={`rounded-lg transition-all ${
          wallCfg.hasWindow ? 'bg-gray-50 p-3' : ''
        }`}>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer select-none">
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
            <div className="mt-2.5">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-400">{t('surface.windowCount')}</span>
                <span className="font-semibold text-gray-700 tabular-nums">{wallCfg.windowCount}</span>
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
      )}
    </div>
  );
}
