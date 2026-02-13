'use client';

import { useConfigStore } from '@/store/useConfigStore';
import { t } from '@/lib/i18n';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import SectionLabel from '@/components/ui/SectionLabel';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { BuildingType, RoofType } from '@/types/building';

const BUILDING_TYPES: { id: BuildingType; icon: React.ReactNode }[] = [
  {
    id: 'overkapping',
    icon: (
      <svg viewBox="0 0 48 48" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth={2}>
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
      <svg viewBox="0 0 48 48" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth={2}>
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
      <svg viewBox="0 0 48 48" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth={2}>
        <line x1="4" y1="14" x2="44" y2="14" />
        <rect x="4" y="14" width="20" height="24" />
        <line x1="24" y1="14" x2="24" y2="38" />
        <line x1="34" y1="14" x2="34" y2="38" />
        <line x1="44" y1="14" x2="44" y2="38" />
      </svg>
    ),
  },
];

const ROOF_TYPES: { id: RoofType; label: string; icon: React.ReactNode }[] = [
  {
    id: 'flat',
    label: 'roofType.flat',
    icon: (
      <svg viewBox="0 0 40 28" className="h-5 w-7" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <rect x="4" y="6" width="32" height="18" rx="1" />
        <line x1="2" y1="6" x2="38" y2="6" strokeWidth={2.5} />
      </svg>
    ),
  },
  {
    id: 'pitched',
    label: 'roofType.pitched',
    icon: (
      <svg viewBox="0 0 40 28" className="h-5 w-7" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <rect x="4" y="12" width="32" height="12" rx="1" />
        <polyline points="2,12 20,2 38,12" strokeWidth={2.5} strokeLinejoin="round" />
      </svg>
    ),
  },
];

export default function BuildingTypeSelector() {
  const buildingType = useConfigStore((s) => s.config.buildingType);
  const roofType = useConfigStore((s) => s.config.roof.type);
  const hasCornerBraces = useConfigStore((s) => s.config.hasCornerBraces);
  const setBuildingType = useConfigStore((s) => s.setBuildingType);
  const setRoofType = useConfigStore((s) => s.setRoofType);
  const toggleCornerBraces = useConfigStore((s) => s.toggleCornerBraces);

  return (
    <div className="space-y-4">
      {/* Building type cards */}
      <div className="grid grid-cols-3 gap-2">
        {BUILDING_TYPES.map(({ id, icon }) => {
          const isSelected = buildingType === id;
          return (
            <button
              key={id}
              onClick={() => setBuildingType(id)}
              className={`flex flex-col items-center gap-1.5 rounded-lg border p-3 transition-all ${
                isSelected
                  ? 'border-primary bg-primary/5 ring-1 ring-primary'
                  : 'border-border hover:border-primary/40'
              }`}
            >
              <div className={isSelected ? 'text-primary' : 'text-muted-foreground'}>
                {icon}
              </div>
              <span className={`text-xs font-medium ${isSelected ? 'text-primary' : 'text-muted-foreground'}`}>
                {t(`buildingType.${id}`)}
              </span>
            </button>
          );
        })}
      </div>

      {/* Roof type toggle */}
      <div className="space-y-2">
        <SectionLabel>{t('roofType.label')}</SectionLabel>
        <ToggleGroup
          type="single"
          value={roofType}
          onValueChange={(v) => { if (v) setRoofType(v as RoofType); }}
          className="w-full"
          variant="outline"
        >
          {ROOF_TYPES.map(({ id, label, icon }) => (
            <ToggleGroupItem
              key={id}
              value={id}
              className="flex-1 gap-2"
            >
              <span className={roofType === id ? 'text-primary-foreground' : 'text-muted-foreground'}>
                {icon}
              </span>
              {t(label)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {/* Corner braces toggle */}
      <div className="flex items-start gap-3 rounded-lg border border-border p-3">
        <svg viewBox="0 0 24 24" className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth={2}>
          <line x1="4" y1="4" x2="4" y2="20" />
          <line x1="4" y1="4" x2="20" y2="4" />
          <line x1="4" y1="12" x2="12" y2="4" strokeWidth={2.5} />
        </svg>
        <div className="flex-1">
          <Label htmlFor="corner-braces" className="cursor-pointer">
            {t('structure.cornerBraces')}
          </Label>
          <p className="text-xs text-muted-foreground">{t('structure.cornerBraces.desc')}</p>
        </div>
        <Checkbox
          id="corner-braces"
          checked={hasCornerBraces}
          onCheckedChange={() => toggleCornerBraces()}
        />
      </div>
    </div>
  );
}
