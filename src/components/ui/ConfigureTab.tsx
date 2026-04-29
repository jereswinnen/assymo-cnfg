'use client';

import { useEffect } from 'react';
import { useConfigStore, getEffectiveHeight } from '@/store/useConfigStore';
import { useUIStore, selectSingleBuildingId } from "@/store/useUIStore";
import { useTenant } from '@/lib/TenantProvider';
import { applyProductDefaults } from '@/domain/catalog';
import { t } from '@/lib/i18n';
import { ChevronDown } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import DimensionsControl from './DimensionsControl';
import BuildingMaterialSection from './BuildingMaterialSection';
import RoofConfigSection from './RoofConfigSection';
import FloorConfigSection from './FloorConfigSection';
import WallSelector from './WallSelector';
import SurfaceProperties from './SurfaceProperties';
import QuoteSummary from './QuoteSummary';
import GateConfigPanel from './GateConfigPanel';
import { BUILDING_KIND_META, type BuildingType, type ConfigSection } from '@/domain/building';

/** Presentation metadata per section, keyed by id. The set of sections a
 *  given building shows lives in `BUILDING_KIND_META[type].sections` —
 *  this object only tells the UI how to render each one. */
const SECTION_DEFS: Record<ConfigSection, { labelKey: string; icon: string }> = {
  dimensions: { labelKey: 'sidebar.section.dimensions', icon: '📐' },
  material:   { labelKey: 'sidebar.section.material',   icon: '🎨' },
  structure:  { labelKey: 'sidebar.section.structure',  icon: '🏗' },
  walls:      { labelKey: 'sidebar.section.walls',      icon: '🧱' },
  gate:       { labelKey: 'sidebar.section.gate',       icon: '🚪' },
  quote:      { labelKey: 'sidebar.section.quote',      icon: '💰' },
};

function MuurWallAutoSelect({ buildingId }: { buildingId: string }) {
  const selectElement = useUIStore((s) => s.selectElement);

  useEffect(() => {
    const sel = useUIStore.getState().selectedElement;
    const isAlreadySelected = sel?.type === 'wall' && sel.buildingId === buildingId;
    if (!isAlreadySelected) {
      selectElement({ type: 'wall', id: 'front', buildingId });
    }
  }, [buildingId, selectElement]);

  return null;
}

function WallsContent({ buildingType, buildingId }: { buildingType: BuildingType; buildingId: string }) {
  if (buildingType === 'muur') {
    return (
      <div className="space-y-4">
        <MuurWallAutoSelect buildingId={buildingId} />
        <SurfaceProperties />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <WallSelector />
      <SurfaceProperties />
    </div>
  );
}

function ConnectionToggles() {
  const buildings = useConfigStore((s) => s.buildings);
  const connections = useConfigStore((s) => s.connections);
  const selectedBuildingId = useUIStore(selectSingleBuildingId);
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

function ResetPolesButton() {
  const selectedBuildingId = useUIStore(selectSingleBuildingId);
  const selectedBuilding = useConfigStore((s) =>
    selectedBuildingId ? s.buildings.find(b => b.id === selectedBuildingId) ?? null : null,
  );
  const resetBuildingPoles = useConfigStore((s) => s.resetBuildingPoles);

  if (!selectedBuilding || selectedBuilding.type !== 'overkapping' || !selectedBuilding.poles) return null;

  return (
    <button
      onClick={() => resetBuildingPoles(selectedBuilding.id)}
      className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-border/70 py-2 text-xs text-muted-foreground hover:text-foreground hover:border-border transition-colors"
    >
      {t('structure.resetPoles')}
    </button>
  );
}

function CornerBracesToggle() {
  const selectedBuildingId = useUIStore(selectSingleBuildingId);
  const selectedBuilding = useConfigStore((s) =>
    selectedBuildingId ? s.buildings.find(b => b.id === selectedBuildingId) ?? null : null,
  );
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
  const selectedBuildingId = useUIStore(selectSingleBuildingId);
  const selectedBuilding = useConfigStore((s) =>
    selectedBuildingId ? s.buildings.find(b => b.id === selectedBuildingId) ?? null : null,
  );
  const defaultHeight = useConfigStore((s) => s.defaultHeight);
  const activeSection = useUIStore((s) => s.activeConfigSection);
  const setActiveSection = useUIStore((s) => s.setActiveConfigSection);
  const resetBuildingToDefaults = useConfigStore((s) => s.resetBuildingToDefaults);
  const { catalog } = useTenant();
  const sourceProduct = selectedBuilding?.sourceProductId
    ? catalog.products.find((p) => p.id === selectedBuilding.sourceProductId) ?? null
    : null;

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

  const visibleSections = BUILDING_KIND_META[selectedBuilding.type].sections;

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

      {/* Bouwset chip + Herstel standaarden */}
      {sourceProduct && (
        <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2 text-xs">
          <span className="font-medium">
            {t('configurator.building.kitChip', { name: sourceProduct.name })}
          </span>
          <button
            type="button"
            className="text-primary underline"
            onClick={() => {
              resetBuildingToDefaults(selectedBuilding!.id, applyProductDefaults(sourceProduct));
            }}
          >
            {t('configurator.building.resetDefaults')}
          </button>
        </div>
      )}

      {/* Accordion sections — visibility comes from
          BUILDING_KIND_META[type].sections; presentation from SECTION_DEFS. */}
      {visibleSections.map((id) => {
        const { labelKey, icon } = SECTION_DEFS[id];
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
                {id === 'material' && <BuildingMaterialSection />}
                {id === 'structure' && (
                  <>
                    <RoofConfigSection />
                    {(selectedBuilding.type === 'berging' || selectedBuilding.type === 'overkapping') && (
                      <FloorConfigSection />
                    )}
                    <CornerBracesToggle />
                    <ResetPolesButton />
                    <ConnectionToggles />
                  </>
                )}
                {id === 'walls' && (
                  <WallsContent
                    buildingType={selectedBuilding.type}
                    buildingId={selectedBuilding.id}
                  />
                )}
                {id === 'gate' && <GateConfigPanel />}
                {id === 'quote' && <QuoteSummary />}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
