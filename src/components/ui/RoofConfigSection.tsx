'use client';

import { useConfigStore } from '@/store/useConfigStore';
import { ROOF_COVERINGS, TRIM_COLORS } from '@/lib/constants';
import { t } from '@/lib/i18n';
import ColorSwatches from './ColorSwatches';

export default function RoofConfigSection() {
  const roof = useConfigStore((s) => s.config.roof);
  const updateRoof = useConfigStore((s) => s.updateRoof);

  return (
    <div className="space-y-4">
      {/* Roof covering cards */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">
          {t('roof.covering')}
        </label>
        <div className="grid grid-cols-2 gap-2">
          {ROOF_COVERINGS.map((cov) => (
            <button
              key={cov.id}
              onClick={() => updateRoof({ coveringId: cov.id })}
              className={`flex items-center gap-2 rounded-lg border-2 px-3 py-2 transition-all ${
                roof.coveringId === cov.id
                  ? 'border-blue-600 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div
                className="h-6 w-6 rounded border border-gray-300"
                style={{ backgroundColor: cov.color }}
              />
              <div className="text-left">
                <div className={`text-xs font-medium ${roof.coveringId === cov.id ? 'text-blue-700' : 'text-gray-700'}`}>
                  {cov.label}
                </div>
                <div className="text-[10px] text-gray-400">€{cov.pricePerSqm}/m²</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Trim color swatches */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">
          {t('roof.trimColor')}
        </label>
        <ColorSwatches
          colors={TRIM_COLORS}
          selectedId={roof.trimColorId}
          onSelect={(id) => updateRoof({ trimColorId: id as typeof roof.trimColorId })}
        />
      </div>

      {/* Insulation toggle + thickness */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <input
            type="checkbox"
            checked={roof.insulation}
            onChange={(e) => updateRoof({ insulation: e.target.checked })}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          {t('roof.insulation')}
        </label>
        {roof.insulation && (
          <div className="ml-6 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">{t('roof.thickness')}</span>
              <span className="text-gray-500 tabular-nums">{roof.insulationThickness} mm</span>
            </div>
            <input
              type="range"
              min={50}
              max={300}
              step={10}
              value={roof.insulationThickness}
              onChange={(e) => updateRoof({ insulationThickness: parseInt(e.target.value) })}
              className="w-full accent-blue-600"
            />
          </div>
        )}
      </div>

      {/* Skylight toggle */}
      <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
        <input
          type="checkbox"
          checked={roof.hasSkylight}
          onChange={(e) => updateRoof({ hasSkylight: e.target.checked })}
          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        {t('roof.skylight')}
      </label>
    </div>
  );
}
