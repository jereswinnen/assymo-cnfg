'use client';

import { useConfigStore } from '@/store/useConfigStore';
import { t } from '@/lib/i18n';
import type { BuildingType, RoofType } from '@/types/building';

const BUILDING_TYPES: { id: BuildingType; icon: React.ReactNode }[] = [
  {
    id: 'overkapping',
    icon: (
      <svg viewBox="0 0 48 48" className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth={2}>
        <line x1="6" y1="14" x2="42" y2="14" />
        <line x1="6" y1="14" x2="6" y2="38" />
        <line x1="42" y1="14" x2="42" y2="38" />
        <line x1="16" y1="14" x2="16" y2="38" />
        <line x1="32" y1="14" x2="32" y2="38" />
      </svg>
    ),
  },
  {
    id: 'berging',
    icon: (
      <svg viewBox="0 0 48 48" className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth={2}>
        <rect x="6" y="14" width="36" height="24" />
        <line x1="6" y1="14" x2="24" y2="6" />
        <line x1="42" y1="14" x2="24" y2="6" />
        <rect x="18" y="26" width="12" height="12" />
      </svg>
    ),
  },
  {
    id: 'combined',
    icon: (
      <svg viewBox="0 0 48 48" className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth={2}>
        <line x1="4" y1="14" x2="44" y2="14" />
        <rect x="4" y="14" width="20" height="24" />
        <line x1="24" y1="14" x2="24" y2="38" />
        <line x1="34" y1="14" x2="34" y2="38" />
        <line x1="44" y1="14" x2="44" y2="38" />
      </svg>
    ),
  },
];

const ROOF_TYPES: { id: RoofType; labelKey: string; icon: React.ReactNode }[] = [
  {
    id: 'flat',
    labelKey: 'roofType.flat',
    icon: (
      <svg viewBox="0 0 40 28" className="h-6 w-9" fill="none" stroke="currentColor" strokeWidth={1.8}>
        {/* Flat roof: box with flat top */}
        <rect x="4" y="6" width="32" height="18" rx="1" />
        <line x1="2" y1="6" x2="38" y2="6" strokeWidth={2.5} />
      </svg>
    ),
  },
  {
    id: 'pitched',
    labelKey: 'roofType.pitched',
    icon: (
      <svg viewBox="0 0 40 28" className="h-6 w-9" fill="none" stroke="currentColor" strokeWidth={1.8}>
        {/* Pitched roof: box with triangle top */}
        <rect x="4" y="12" width="32" height="12" rx="1" />
        <polyline points="2,12 20,2 38,12" strokeWidth={2.5} strokeLinejoin="round" />
      </svg>
    ),
  },
];

export default function BuildingTypeSelector() {
  const buildingType = useConfigStore((s) => s.config.buildingType);
  const roofType = useConfigStore((s) => s.config.roof.type);
  const setBuildingType = useConfigStore((s) => s.setBuildingType);
  const setRoofType = useConfigStore((s) => s.setRoofType);

  return (
    <div className="space-y-4">
      {/* Building type cards */}
      <div className="grid grid-cols-3 gap-2">
        {BUILDING_TYPES.map(({ id, icon }) => (
          <button
            key={id}
            onClick={() => setBuildingType(id)}
            className={`flex flex-col items-center gap-2 rounded-lg border-2 p-3 transition-all ${
              buildingType === id
                ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-200'
                : 'border-gray-200 hover:border-gray-300 bg-white'
            }`}
          >
            <div className={buildingType === id ? 'text-blue-600' : 'text-gray-500'}>
              {icon}
            </div>
            <span className={`text-xs font-medium ${buildingType === id ? 'text-blue-700' : 'text-gray-600'}`}>
              {t(`buildingType.${id}`)}
            </span>
          </button>
        ))}
      </div>

      {/* Roof type toggle */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">
          {t('roofType.label')}
        </label>
        <div className="grid grid-cols-2 gap-2">
          {ROOF_TYPES.map(({ id, labelKey, icon }) => (
            <button
              key={id}
              onClick={() => setRoofType(id)}
              className={`flex items-center justify-center gap-2 rounded-lg border-2 px-3 py-2.5 text-sm font-medium transition-all ${
                roofType === id
                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              <span className={roofType === id ? 'text-blue-600' : 'text-gray-400'}>
                {icon}
              </span>
              {t(labelKey)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
