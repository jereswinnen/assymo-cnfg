'use client';

import { useEffect } from 'react';
import { useConfigStore, getEffectiveHeight } from '@/store/useConfigStore';
import { t } from '@/lib/i18n';
import { ChevronDown } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import DimensionsControl from './DimensionsControl';
import RoofConfigSection from './RoofConfigSection';
import FloorConfigSection from './FloorConfigSection';
import WallSelector from './WallSelector';
import SurfaceProperties from './SurfaceProperties';
import DoorConfig from './DoorConfig';
import WindowConfig from './WindowConfig';
import QuoteSummary from './QuoteSummary';
import type { BuildingType } from '@/types/building';

type ConfigSection = 'dimensions' | 'structure' | 'walls' | 'quote';

const SECTIONS: { id: ConfigSection; labelKey: string; icon: string; showFor?: BuildingType[] }[] = [
  { id: 'dimensions', labelKey: 'sidebar.section.dimensions', icon: '📐' },
  { id: 'structure', labelKey: 'sidebar.section.structure', icon: '🏗' },
  { id: 'walls', labelKey: 'sidebar.section.walls', icon: '🧱', showFor: ['berging', 'muur'] },
  { id: 'quote', labelKey: 'sidebar.section.quote', icon: '💰' },
];

function MuurWallAutoSelect({ buildingId }: { buildingId: string }) {
  const selectElement = useConfigStore((s) => s.selectElement);
  const selectedElement = useConfigStore((s) => s.selectedElement);

  useEffect(() => {
    const isAlreadySelected = selectedElement?.type === 'wall' && selectedElement.buildingId === buildingId;
    if (!isAlreadySelected) {
      selectElement({ type: 'wall', id: 'front', buildingId });
    }
  }, [buildingId, selectElement, selectedElement]);

  return null;
}

function WallsContent({ buildingType, buildingId }: { buildingType: BuildingType; buildingId: string }) {
  const selectedElement = useConfigStore((s) => s.selectedElement);
  const wallId = selectedElement?.type === 'wall' && selectedElement.buildingId === buildingId
    ? selectedElement.id
    : null;

  if (buildingType === 'muur') {
    return (
      <div className="space-y-4">
        <MuurWallAutoSelect buildingId={buildingId} />
        <SurfaceProperties />
        {wallId && <DoorConfig wallId={wallId} buildingId={buildingId} />}
        {wallId && <WindowConfig wallId={wallId} buildingId={buildingId} />}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <WallSelector />
      <SurfaceProperties />
      {wallId && <DoorConfig wallId={wallId} buildingId={buildingId} />}
      {wallId && <WindowConfig wallId={wallId} buildingId={buildingId} />}
    </div>
  );
}

function ConnectionToggles() {
  const buildings = useConfigStore((s) => s.buildings);
  const connections = useConfigStore((s) => s.connections);
  const selectedBuildingId = useConfigStore((s) => s.selectedBuildingId);
  const toggleConnectionOpen = useConfigStore((s) => s.toggleConnectionOpen);

  const selectedConnections = connections.filter(
    c => c.buildingAId === selectedBuildingId || c.buildingBId === selectedBuildingId,
  );

  if (selectedConnections.length === 0) return null;

  return (
    <div className="space-y-2 mt-4">
      <p className="text-xs text-muted-foreground uppercase tracking-wider">{t('sidebar.connections')}</p>
      {selectedConnections.map((c) => {
        const otherId = c.buildingAId === selectedBuildingId ? c.buildingBId : c.buildingAId;
        const otherBuilding = buildings.find(b => b.id === otherId);
        const otherTypeIndex = otherBuilding ? buildings.filter(x => x.type === otherBuilding.type).indexOf(otherBuilding) + 1 : 0;
        const side = c.buildingAId === selectedBuildingId ? c.sideA : c.sideB;
        return (
          <div key={`${c.buildingAId}-${c.sideA}-${c.buildingBId}-${c.sideB}`} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
            <span className="text-sm text-foreground">
              {t(`wall.${side}`)} — {otherBuilding ? `${t(`building.name.${otherBuilding.type}`)} ${otherTypeIndex}` : '?'}
            </span>
            <Switch
              checked={c.isOpen}
              onCheckedChange={() => toggleConnectionOpen(c.buildingAId, c.sideA, c.buildingBId, c.sideB)}
            />
          </div>
        );
      })}
    </div>
  );
}

function CornerBracesToggle() {
  const selectedBuilding = useConfigStore((s) => {
    const b = s.buildings.find(b => b.id === s.selectedBuildingId);
    return b ?? null;
  });
  const toggleBuildingBraces = useConfigStore((s) => s.toggleBuildingBraces);

  if (!selectedBuilding || selectedBuilding.type === 'paal' || selectedBuilding.type === 'muur') return null;

  return (
    <div className="flex items-start gap-3 rounded-lg border border-border p-3">
      <svg viewBox="0 0 24 24" className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth={2}>
        <line x1="4" y1="4" x2="4" y2="20" />
        <line x1="4" y1="4" x2="20" y2="4" />
        <line x1="4" y1="12" x2="12" y2="4" strokeWidth={2.5} />
      </svg>
      <div className="flex-1">
        <label htmlFor="corner-braces" className="text-sm cursor-pointer">
          {t('structure.cornerBraces')}
        </label>
        <p className="text-xs text-muted-foreground">{t('structure.cornerBraces.desc')}</p>
      </div>
      <input
        id="corner-braces"
        type="checkbox"
        checked={selectedBuilding.hasCornerBraces}
        onChange={() => toggleBuildingBraces(selectedBuilding.id)}
        className="mt-1"
      />
    </div>
  );
}

export default function ConfigureTab() {
  const buildings = useConfigStore((s) => s.buildings);
  const selectedBuilding = useConfigStore((s) => {
    const b = s.buildings.find(b => b.id === s.selectedBuildingId);
    return b ?? null;
  });
  const defaultHeight = useConfigStore((s) => s.defaultHeight);
  const activeSection = useConfigStore((s) => s.activeConfigSection);
  const setActiveSection = useConfigStore((s) => s.setActiveConfigSection);

  if (!selectedBuilding) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground p-6 text-center">
        {t('sidebar.emptyState')}
      </div>
    );
  }

  const effectiveH = getEffectiveHeight(selectedBuilding, defaultHeight);
  const typeLabel = t(`building.name.${selectedBuilding.type}`);
  const typeIndex = buildings.filter(x => x.type === selectedBuilding.type).findIndex(x => x.id === selectedBuilding.id) + 1;

  const visibleSections = SECTIONS.filter(
    s => !s.showFor || s.showFor.includes(selectedBuilding.type),
  );

  const toggleSection = (id: ConfigSection) => {
    setActiveSection(activeSection === id ? null : id);
  };

  return (
    <div className="p-3 space-y-2">
      {/* Selected object header */}
      <div className="flex items-center gap-2 rounded-lg bg-primary/5 border border-primary/20 px-3 py-2">
        <span className="text-lg">
          {selectedBuilding.type === 'berging' ? '🏠' :
           selectedBuilding.type === 'overkapping' ? '☂️' :
           selectedBuilding.type === 'paal' ? '📍' : '🧱'}
        </span>
        <div>
          <span className="text-sm font-semibold text-primary">{typeLabel} {typeIndex}</span>
          <span className="block text-[11px] text-muted-foreground tabular-nums">
            {selectedBuilding.type === 'paal'
              ? `${effectiveH.toFixed(1)}m`
              : selectedBuilding.type === 'muur'
              ? `${selectedBuilding.dimensions.width.toFixed(1)} × ${effectiveH.toFixed(1)}m`
              : `${selectedBuilding.dimensions.width.toFixed(1)} × ${selectedBuilding.dimensions.depth.toFixed(1)} × ${effectiveH.toFixed(1)}m`
            }
          </span>
        </div>
      </div>

      {/* Accordion sections */}
      {visibleSections.map(({ id, labelKey, icon }) => {
        const isOpen = activeSection === id;
        return (
          <div key={id} className="rounded-lg border border-border overflow-hidden">
            <button
              onClick={() => toggleSection(id)}
              className={`w-full flex items-center justify-between px-3 py-2 text-sm font-medium transition-colors ${
                isOpen ? 'bg-primary/5 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              <span className="flex items-center gap-2">
                <span>{icon}</span>
                <span>{t(labelKey)}</span>
              </span>
              <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
              <div className="px-3 py-3 border-t border-border space-y-4">
                {id === 'dimensions' && <DimensionsControl />}
                {id === 'structure' && (
                  <>
                    <RoofConfigSection />
                    {(selectedBuilding.type === 'berging') && (
                      <FloorConfigSection />
                    )}
                    <CornerBracesToggle />
                    <ConnectionToggles />
                  </>
                )}
                {id === 'walls' && (
                  <WallsContent
                    buildingType={selectedBuilding.type}
                    buildingId={selectedBuilding.id}
                  />
                )}
                {id === 'quote' && <QuoteSummary />}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
