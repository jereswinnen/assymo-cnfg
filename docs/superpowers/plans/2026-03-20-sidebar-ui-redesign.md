# Sidebar UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the floating CapsuleToolbar with a persistent right-side sidebar featuring Objects/Configure tabs, drag-and-drop object placement, keyboard shortcuts, and a mobile bottom sheet.

**Architecture:** New `Sidebar` component with two tabs replaces `CapsuleToolbar`. Existing config panels (DimensionsControl, RoofConfigSection, etc.) are recomposed into accordion sections. Store gains sidebar state (`sidebarTab`, `sidebarCollapsed`, `activeConfigSection`, `viewMode`). SchematicView gets HTML drag-and-drop support for placing new objects from the sidebar catalog.

**Tech Stack:** React 19, Next.js 16, Zustand, TailwindCSS 4, RadixUI (Accordion), Lucide icons

**Spec:** `docs/superpowers/specs/2026-03-20-sidebar-ui-redesign.md`

---

## Chunk 1: Store Changes & Sidebar Shell

### Task 1: Update Zustand Store

**Files:**
- Modify: `src/store/useConfigStore.ts`

- [ ] **Step 1: Add new state fields to ConfigState interface**

Add after line 41 (`defaultHeight: number;`):

```typescript
sidebarTab: 'objects' | 'configure';
sidebarCollapsed: boolean;
activeConfigSection: 'dimensions' | 'structure' | 'walls' | 'quote' | null;
viewMode: 'plan' | '3d';
```

Add new action signatures after line 72 (`setOrientation`):

```typescript
setSidebarTab: (tab: 'objects' | 'configure') => void;
setSidebarCollapsed: (collapsed: boolean) => void;
setActiveConfigSection: (section: 'dimensions' | 'structure' | 'walls' | 'quote' | null) => void;
setViewMode: (mode: 'plan' | '3d') => void;
```

Remove from interface:
- `activeAccordionSection: number;` (line 38)
- `setAccordionSection: (n: number) => void;` (line 67)

- [ ] **Step 2: Add initial values and action implementations**

Add initial values after `defaultHeight: 3,` (line 120):

```typescript
sidebarTab: 'objects',
sidebarCollapsed: false,
activeConfigSection: 'dimensions',
viewMode: 'plan',
```

Remove:
- `activeAccordionSection: 2,` (line 117)
- `setAccordionSection: (n) => set({ activeAccordionSection: n }),` (line 245)

Add action implementations:

```typescript
setSidebarTab: (tab) => set({ sidebarTab: tab }),
setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
setActiveConfigSection: (section) => set({ activeConfigSection: section }),
setViewMode: (mode) => set({ viewMode: mode }),
```

- [ ] **Step 3: Update `selectBuilding` to switch sidebar tab and expand**

Replace line 157:
```typescript
selectBuilding: (id) => set({
  selectedBuildingId: id,
  ...(id ? { sidebarTab: 'configure' as const, sidebarCollapsed: false } : {}),
}),
```

- [ ] **Step 4: Update `removeBuilding` to clear selection and switch tab**

In `removeBuilding` (line 137-155), replace lines 148-153:

```typescript
const selectedBuildingId =
  state.selectedBuildingId === id ? null : state.selectedBuildingId;
const selectedElement =
  state.selectedBuildingId === id ? null : state.selectedElement;
const sidebarTab =
  state.selectedBuildingId === id ? 'objects' as const : state.sidebarTab;
return { buildings, connections, selectedBuildingId, selectedElement, sidebarTab };
```

- [ ] **Step 5: Update `selectElement` to use named config sections**

Replace `selectElement` (lines 230-239):

```typescript
selectElement: (element) =>
  set((state) => ({
    selectedElement: element,
    selectedBuildingId:
      element?.type === 'wall' ? element.buildingId : state.selectedBuildingId,
    activeConfigSection:
      element?.type === 'wall' ? 'walls' : element?.type === 'roof' ? 'structure' : state.activeConfigSection,
    sidebarTab: 'configure',
    sidebarCollapsed: false,
    cameraTargetWallId:
      element?.type === 'wall' ? element.id : state.cameraTargetWallId,
  })),
```

- [ ] **Step 6: Update `addBuilding` to accept optional position**

Replace `addBuilding` signature in interface (line 44):
```typescript
addBuilding: (type: BuildingType, position?: [number, number]) => string;
```

Replace implementation (lines 122-135):
```typescript
addBuilding: (type, position) => {
  const b = createBuilding(type, position ?? [0, 0]);
  if (!position) {
    const existing = get().buildings;
    if (existing.length > 0) {
      const maxX = Math.max(...existing.map(e => e.position[0] + e.dimensions.width / 2));
      b.position = [maxX + b.dimensions.width / 2 + 2, 0];
    }
  }
  set((state) => ({
    buildings: [...state.buildings, b],
    selectedBuildingId: b.id,
    sidebarTab: 'configure' as const,
    sidebarCollapsed: false,
  }));
  return b.id;
},
```

- [ ] **Step 7: Update `resetConfig` and `loadState`**

In `resetConfig` (lines 265-278), replace `activeAccordionSection: 1` with:
```typescript
activeConfigSection: 'dimensions',
sidebarTab: 'objects',
sidebarCollapsed: false,
viewMode: 'plan',
```

In `loadState` (lines 280-300), replace `activeAccordionSection: 1` with:
```typescript
activeConfigSection: 'dimensions',
sidebarTab: 'objects',
```

- [ ] **Step 8: Commit**

```bash
git add src/store/useConfigStore.ts
git commit -m "refactor: update store for sidebar UI — add sidebarTab, viewMode, activeConfigSection"
```

---

### Task 2: Create Sidebar Component Shell

**Files:**
- Create: `src/components/ui/Sidebar.tsx`

- [ ] **Step 1: Create the Sidebar component with tab switching**

```tsx
'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useConfigStore } from '@/store/useConfigStore';
import ObjectsTab from './ObjectsTab';
import ConfigureTab from './ConfigureTab';
import MobileBottomSheet from './MobileBottomSheet';

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia('(min-width: 768px)');
    setIsDesktop(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);
  return isDesktop;
}

export default function Sidebar() {
  const sidebarTab = useConfigStore((s) => s.sidebarTab);
  const setSidebarTab = useConfigStore((s) => s.setSidebarTab);
  const sidebarCollapsed = useConfigStore((s) => s.sidebarCollapsed);
  const setSidebarCollapsed = useConfigStore((s) => s.setSidebarCollapsed);
  const isDesktop = useIsDesktop();

  // Keyboard shortcut: [ to toggle sidebar
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
      if (e.key === '[') {
        setSidebarCollapsed(!sidebarCollapsed);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [sidebarCollapsed, setSidebarCollapsed]);

  if (!isDesktop) {
    return <MobileBottomSheet />;
  }

  return (
    <>
      {/* Collapsed: floating re-open button at right edge of canvas */}
      {sidebarCollapsed && (
        <button
          onClick={() => setSidebarCollapsed(false)}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-30 w-6 h-12 bg-background/80 backdrop-blur-xl rounded-l-lg shadow-md ring-1 ring-black/[0.08] flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      )}

      {/* Sidebar panel — flex child, not fixed, so canvas resizes */}
      <div
        className={`h-dvh bg-background border-l border-border flex flex-col shrink-0 transition-all duration-200 ease-in-out overflow-hidden ${
          sidebarCollapsed ? 'w-0 border-l-0' : 'w-[280px]'
        }`}
      >
        {/* Collapse toggle */}
        <button
          onClick={() => setSidebarCollapsed(true)}
          className="absolute -left-4 top-1/2 -translate-y-1/2 w-4 h-10 bg-background border border-border border-r-0 rounded-l-md flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronRight className="h-3 w-3" />
        </button>

        {/* Tab bar */}
        <div className="flex border-b border-border shrink-0">
          <button
            onClick={() => setSidebarTab('objects')}
            className={`flex-1 py-3 text-sm font-medium text-center transition-colors border-b-2 ${
              sidebarTab === 'objects'
                ? 'text-primary border-primary'
                : 'text-muted-foreground border-transparent hover:text-foreground'
            }`}
          >
            Objects
          </button>
          <button
            onClick={() => setSidebarTab('configure')}
            className={`flex-1 py-3 text-sm font-medium text-center transition-colors border-b-2 ${
              sidebarTab === 'configure'
                ? 'text-primary border-primary'
                : 'text-muted-foreground border-transparent hover:text-foreground'
            }`}
          >
            Configure
          </button>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto">
          {sidebarTab === 'objects' ? <ObjectsTab /> : <ConfigureTab />}
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ui/Sidebar.tsx
git commit -m "feat: add Sidebar component shell with tab switching and collapse"
```

---

### Task 3: Create ObjectsTab (Catalog + Placed Objects List)

**Files:**
- Create: `src/components/ui/ObjectsTab.tsx`

- [ ] **Step 1: Create ObjectsTab component**

This combines the add-building grid from `BuildingManager` (lines 104-129) and the building list (lines 61-100) with drag support.

```tsx
'use client';

import { useConfigStore, getEffectiveHeight } from '@/store/useConfigStore';
import { exportFloorPlan } from '@/components/schematic/exportFloorPlan';
import { t } from '@/lib/i18n';
import { RotateCcw, Download } from 'lucide-react';
import ConfigCodeDialog from './ConfigCodeDialog';
import type { BuildingType } from '@/types/building';

const CATALOG_ITEMS: { type: BuildingType; icon: string }[] = [
  { type: 'berging', icon: '🏠' },
  { type: 'overkapping', icon: '☂️' },
  { type: 'paal', icon: '📍' },
  { type: 'muur', icon: '🧱' },
];

export default function ObjectsTab() {
  const buildings = useConfigStore((s) => s.buildings);
  const selectedBuildingId = useConfigStore((s) => s.selectedBuildingId);
  const defaultHeight = useConfigStore((s) => s.defaultHeight);
  const addBuilding = useConfigStore((s) => s.addBuilding);
  const removeBuilding = useConfigStore((s) => s.removeBuilding);
  const selectBuilding = useConfigStore((s) => s.selectBuilding);
  const resetConfig = useConfigStore((s) => s.resetConfig);
  const viewMode = useConfigStore((s) => s.viewMode);

  const handleDragStart = (e: React.DragEvent, type: BuildingType) => {
    e.dataTransfer.setData('application/building-type', type);
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Catalog grid */}
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
            {viewMode === 'plan' ? 'Drag to canvas' : 'Switch to 2D to add'}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {CATALOG_ITEMS.map(({ type, icon }) => (
              <div
                key={type}
                draggable={viewMode === 'plan'}
                onDragStart={(e) => handleDragStart(e, type)}
                className={`flex flex-col items-center gap-1 rounded-lg border border-border p-3 select-none transition-all ${
                  viewMode === 'plan'
                    ? 'cursor-grab hover:border-primary/40 hover:bg-primary/5'
                    : 'opacity-50 cursor-not-allowed'
                }`}
              >
                <span className="text-xl">{icon}</span>
                <span className="text-xs font-medium text-muted-foreground">
                  {t(`building.name.${type}`)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Placed objects list */}
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
            Placed ({buildings.length})
          </p>
          <div className="space-y-1">
            {buildings.map((b) => {
              const isSelected = b.id === selectedBuildingId;
              const typeLabel = t(`building.name.${b.type}`);
              // Per-type numbering: count how many of this type appear before this one
              const typeIndex = buildings.filter(x => x.type === b.type).indexOf(b) + 1;
              const effectiveH = getEffectiveHeight(b, defaultHeight);
              const structuralCount = buildings.filter(x => x.type !== 'paal' && x.type !== 'muur').length;
              const canDelete = b.type === 'paal' || b.type === 'muur' || structuralCount > 1;

              return (
                <div
                  key={b.id}
                  onClick={() => selectBuilding(b.id)}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer transition-all ${
                    isSelected
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'border-border hover:border-primary/40'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <span className={`text-sm font-medium ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                      {typeLabel} {typeIndex}
                    </span>
                    <span className="block text-[11px] text-muted-foreground tabular-nums">
                      {b.type === 'paal'
                        ? `${effectiveH.toFixed(1)}m`
                        : b.type === 'muur'
                        ? `${b.dimensions.width.toFixed(1)} × ${effectiveH.toFixed(1)}m`
                        : `${b.dimensions.width.toFixed(1)} × ${b.dimensions.depth.toFixed(1)} × ${effectiveH.toFixed(1)}m`
                      }
                    </span>
                  </div>
                  {canDelete && (
                    <button
                      onClick={(e) => { e.stopPropagation(); removeBuilding(b.id); }}
                      className="text-xs text-muted-foreground hover:text-destructive transition-colors px-1"
                    >
                      ✕
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer: Reset + ConfigCode + Export */}
      <SidebarFooter resetConfig={resetConfig} viewMode={viewMode} />
    </div>
  );
}

function SidebarFooter({ resetConfig, viewMode }: { resetConfig: () => void; viewMode: string }) {
  const buildings = useConfigStore((s) => s.buildings);
  const connections = useConfigStore((s) => s.connections);
  const roof = useConfigStore((s) => s.roof);
  const defaultHeight = useConfigStore((s) => s.defaultHeight);

  return (
    <div className="shrink-0 border-t border-border p-3 flex items-center gap-2">
      <button
        onClick={resetConfig}
        className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
      >
        <RotateCcw className="h-3.5 w-3.5" />
        {t('app.reset')}
      </button>
      <ConfigCodeDialog />
      {viewMode === 'plan' && (
        <button
          onClick={() => exportFloorPlan(buildings, connections, roof, defaultHeight)}
          className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground transition-colors ml-auto"
        >
          <Download className="h-3.5 w-3.5" />
          {t('export.button')}
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ui/ObjectsTab.tsx
git commit -m "feat: add ObjectsTab with draggable catalog and placed objects list"
```

---

### Task 4: Create ConfigureTab (Accordion Sections)

**Files:**
- Create: `src/components/ui/ConfigureTab.tsx`

- [ ] **Step 1: Create ConfigureTab with accordion sections**

This recomposes the existing config panels into accordion sections. Reuses `WallsContent` logic from `CapsuleToolbar.tsx` (lines 49-89).

```tsx
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

const SECTIONS: { id: ConfigSection; label: string; icon: string; showFor?: BuildingType[] }[] = [
  { id: 'dimensions', label: 'Afmetingen', icon: '📐' },
  { id: 'structure', label: 'Structuur', icon: '🏗' },
  { id: 'walls', label: 'Wanden & Openingen', icon: '🧱', showFor: ['berging', 'muur'] },
  { id: 'quote', label: 'Offerte', icon: '💰' },
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
  if (buildingType === 'muur') {
    return (
      <div className="space-y-4">
        <MuurWallAutoSelect buildingId={buildingId} />
        <SurfaceProperties />
        <DoorConfig />
        <WindowConfig />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <WallSelector />
      <SurfaceProperties />
      <DoorConfig />
      <WindowConfig />
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
      <p className="text-xs text-muted-foreground uppercase tracking-wider">Verbindingen</p>
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
        Select an object to configure
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
      {visibleSections.map(({ id, label, icon }) => {
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
                <span>{label}</span>
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
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ui/ConfigureTab.tsx
git commit -m "feat: add ConfigureTab with accordion sections for Dimensions, Structure, Walls, Quote"
```

---

### Task 5: Update Page Layout & Wire Up Sidebar

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Replace CapsuleToolbar with Sidebar, move viewMode to store**

Replace entire `page.tsx`:

```tsx
'use client';

import dynamic from 'next/dynamic';
import Sidebar from '@/components/ui/Sidebar';
import SchematicView from '@/components/schematic/SchematicView';
import { useConfigStore } from '@/store/useConfigStore';

const BuildingScene = dynamic(
  () => import('@/components/canvas/BuildingScene'),
  { ssr: false },
);

function ViewToggle() {
  const viewMode = useConfigStore((s) => s.viewMode);
  const setViewMode = useConfigStore((s) => s.setViewMode);

  return (
    <div className="flex gap-1 bg-background/80 backdrop-blur-xl rounded-xl shadow-md ring-1 ring-black/[0.08] p-1">
      <button
        onClick={() => setViewMode('plan')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
          viewMode === 'plan'
            ? 'bg-foreground text-background shadow-sm'
            : 'text-foreground/60 hover:text-foreground/80'
        }`}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="1" y="1" width="14" height="14" rx="1" />
          <line x1="6" y1="1" x2="6" y2="15" />
          <line x1="6" y1="8" x2="15" y2="8" />
        </svg>
        2D
      </button>
      <button
        onClick={() => setViewMode('3d')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
          viewMode === '3d'
            ? 'bg-foreground text-background shadow-sm'
            : 'text-foreground/60 hover:text-foreground/80'
        }`}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 1L14.5 4.75V11.25L8 15L1.5 11.25V4.75L8 1Z" />
          <path d="M8 15V8" />
          <path d="M14.5 4.75L8 8L1.5 4.75" />
        </svg>
        3D
      </button>
    </div>
  );
}

export default function Home() {
  const viewMode = useConfigStore((s) => s.viewMode);
  const sidebarCollapsed = useConfigStore((s) => s.sidebarCollapsed);

  return (
    <div className="relative h-dvh flex">
      {/* Canvas area */}
      <div className="flex-1 relative">
        {viewMode === '3d' && (
          <div className="absolute inset-0">
            <BuildingScene />
          </div>
        )}

        {viewMode === 'plan' && (
          <div className="absolute inset-0 bg-white">
            <SchematicView />
          </div>
        )}

        <div className="absolute top-3 left-3 z-20">
          <ViewToggle />
        </div>
      </div>

      {/* Sidebar */}
      <Sidebar />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: replace CapsuleToolbar with Sidebar in page layout, move viewMode to store"
```

---

### Task 6: Update SchematicView References

**Files:**
- Modify: `src/components/schematic/SchematicView.tsx`

- [ ] **Step 1: Remove `setAccordionSection` usage, update click-to-select**

In SchematicView, replace the `setAccordionSection` import and usages:

Remove line 86:
```typescript
const setAccordionSection = useConfigStore((s) => s.setAccordionSection);
```

Update `onPointerUp` (line 200-213) — remove `setAccordionSection(2)` from the click handler (line 206). The store's `selectBuilding` now handles switching the sidebar tab automatically.

Replace lines 200-213:
```typescript
const onPointerUp = useCallback(() => {
  if (dragging.current) {
    setDraggedBuildingId(null);
  } else if (dragBuildingId.current) {
    selectBuilding(dragBuildingId.current);
  }
  dragging.current = false;
  dragBuildingId.current = null;
  dragStartWorld.current = null;
  pointerDownScreen.current = null;
  setFrozenViewBox(null);
}, [selectBuilding, setDraggedBuildingId]);
```

Update `onSvgPointerDown` (lines 215-220) — deselect sets null:
```typescript
const onSvgPointerDown = useCallback((e: React.PointerEvent) => {
  if (e.target === svgRef.current) {
    selectBuilding(null);
  }
}, [selectBuilding]);
```

- [ ] **Step 2: Commit**

```bash
git add src/components/schematic/SchematicView.tsx
git commit -m "refactor: remove setAccordionSection from SchematicView, use store-driven sidebar"
```

---

## Chunk 2: Drag-and-Drop, Keyboard Shortcuts, Selection Animation

### Task 7: Add Drag-and-Drop from Sidebar to Canvas

**Files:**
- Modify: `src/components/schematic/SchematicView.tsx`

- [ ] **Step 1: Add HTML drag event handlers and ghost preview to SchematicView**

Add drag event handlers to the outermost `<div>` wrapping the SVG (line 223). These handle drops from the sidebar catalog and show a ghost preview.

After the existing state declarations, add:

```typescript
const addBuilding = useConfigStore((s) => s.addBuilding);
const [dragGhost, setDragGhost] = useState<{ x: number; y: number; type: string } | null>(null);

const onDragOver = useCallback((e: React.DragEvent) => {
  if (e.dataTransfer.types.includes('application/building-type')) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    // Update ghost position
    const container = e.currentTarget as HTMLElement;
    const rect = container.getBoundingClientRect();
    setDragGhost({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      type: e.dataTransfer.types.includes('application/building-type') ? 'building' : '',
    });
  }
}, []);

const onDragLeave = useCallback(() => {
  setDragGhost(null);
}, []);

const onDrop = useCallback((e: React.DragEvent) => {
  const type = e.dataTransfer.getData('application/building-type') as BuildingType | '';
  if (!type) return;
  e.preventDefault();
  setDragGhost(null);

  const svg = svgRef.current;
  if (!svg) return;

  const [wx, wz] = clientToWorld(svg, e.clientX, e.clientY);
  const id = addBuilding(type as BuildingType, [wx, wz]);

  // Run snap detection on the newly placed building
  const state = useConfigStore.getState();
  const building = state.buildings.find(b => b.id === id);
  if (!building) return;

  if (building.type === 'paal') {
    const snapped = detectPoleSnap(building.position, state.buildings.filter(b => b.id !== id));
    updateBuildingPosition(id, snapped);
  } else if (building.type === 'muur') {
    const snapped = detectWallSnap(
      building.position,
      building.dimensions.width,
      building.orientation,
      state.buildings.filter(b => b.id !== id),
    );
    updateBuildingPosition(id, snapped);
  } else {
    const others = state.buildings.filter(b => b.id !== id && b.type !== 'paal' && b.type !== 'muur');
    const { snappedPosition, newConnections } = detectSnap(building, others);
    updateBuildingPosition(id, snappedPosition);
    setConnections(newConnections);
  }
}, [addBuilding, updateBuildingPosition, setConnections]);
```

Add `import type { BuildingType } from '@/types/building';` at the top.

Update the outer div (line 223) and add the ghost overlay:
```tsx
<div
  className="flex flex-col h-full p-6 relative"
  onDragOver={onDragOver}
  onDragLeave={onDragLeave}
  onDrop={onDrop}
>
  {/* Ghost preview during drag from sidebar */}
  {dragGhost && (
    <div
      className="absolute pointer-events-none z-10"
      style={{
        left: dragGhost.x - 40,
        top: dragGhost.y - 25,
        width: 80,
        height: 50,
        border: '2px dashed rgba(74, 158, 255, 0.6)',
        backgroundColor: 'rgba(74, 158, 255, 0.08)',
        borderRadius: 4,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 11,
        color: 'rgba(74, 158, 255, 0.8)',
      }}
    >
      +
    </div>
  )}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/schematic/SchematicView.tsx
git commit -m "feat: add drag-and-drop from sidebar catalog to 2D canvas with snap detection"
```

---

### Task 8: Add Keyboard Shortcut for Delete

**Files:**
- Modify: `src/components/ui/Sidebar.tsx`

- [ ] **Step 1: Add Backspace/Delete handler to Sidebar's keyboard listener**

In Sidebar's existing `useEffect` for keyboard shortcuts, extend the handler:

```typescript
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

    if (e.key === '[') {
      setSidebarCollapsed(!sidebarCollapsed);
    }

    if (e.key === 'Backspace' || e.key === 'Delete') {
      const state = useConfigStore.getState();
      if (state.selectedBuildingId) {
        e.preventDefault();
        state.removeBuilding(state.selectedBuildingId);
      }
    }
  };
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}, [sidebarCollapsed, setSidebarCollapsed]);
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ui/Sidebar.tsx
git commit -m "feat: add Backspace/Delete keyboard shortcut to remove selected object"
```

---

### Task 9: Add Pulse Animation for Selected Objects

**Files:**
- Modify: `src/components/schematic/SchematicView.tsx`
- Modify: `src/app/globals.css` (or equivalent)

- [ ] **Step 1: Add CSS animation for pulse**

Add to global CSS:

```css
@keyframes schematic-pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.02); opacity: 0.85; }
}
.schematic-selected {
  animation: schematic-pulse 2s ease-in-out infinite;
  transform-origin: center;
}
```

- [ ] **Step 2: Apply pulse class to selected building groups in SchematicView**

For each building `<g>` element, add the animation class when selected. Wrap the building content in a group with the class and use SVG `transform-origin`:

For normal buildings (around line 258), update the `<g key={b.id}>` to:
```tsx
<g
  key={b.id}
  className={isSelected ? 'schematic-selected' : ''}
  style={isSelected ? { transformOrigin: `${ox}px ${oz}px` } : undefined}
>
```

Apply similarly for standalone walls and poles.

- [ ] **Step 3: Commit**

```bash
git add src/components/schematic/SchematicView.tsx src/app/globals.css
git commit -m "feat: add pulse animation for selected objects on 2D canvas"
```

---

## Chunk 3: Mobile Bottom Sheet & Cleanup

### Task 10: Create Mobile Bottom Sheet

**Files:**
- Create: `src/components/ui/MobileBottomSheet.tsx`
- Modify: `src/components/ui/Sidebar.tsx`

- [ ] **Step 1: Create MobileBottomSheet component**

```tsx
'use client';

import { useState, useRef, useCallback } from 'react';
import { useConfigStore } from '@/store/useConfigStore';
import ObjectsTab from './ObjectsTab';
import ConfigureTab from './ConfigureTab';

export default function MobileBottomSheet() {
  const sidebarTab = useConfigStore((s) => s.sidebarTab);
  const setSidebarTab = useConfigStore((s) => s.setSidebarTab);
  const selectedBuildingId = useConfigStore((s) => s.selectedBuildingId);
  const [expanded, setExpanded] = useState(false);
  const dragStartY = useRef<number | null>(null);

  // Auto-expand when object is selected
  const prevSelectedRef = useRef(selectedBuildingId);
  if (selectedBuildingId && selectedBuildingId !== prevSelectedRef.current) {
    setExpanded(true);
  }
  prevSelectedRef.current = selectedBuildingId;

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    dragStartY.current = e.touches[0].clientY;
  }, []);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (dragStartY.current === null) return;
    const dy = e.changedTouches[0].clientY - dragStartY.current;
    if (dy < -50) setExpanded(true);
    if (dy > 50) setExpanded(false);
    dragStartY.current = null;
  }, []);

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-30 bg-background rounded-t-2xl border-t border-border shadow-xl transition-all duration-300 ${
        expanded ? 'h-[70vh]' : 'h-auto'
      }`}
    >
      {/* Grab handle */}
      <div
        className="flex justify-center py-2 cursor-grab"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="w-9 h-1 bg-muted-foreground/30 rounded-full" />
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-border mx-3">
        <button
          onClick={() => setSidebarTab('objects')}
          className={`flex-1 py-2 text-xs font-medium text-center border-b-2 ${
            sidebarTab === 'objects'
              ? 'text-primary border-primary'
              : 'text-muted-foreground border-transparent'
          }`}
        >
          Objects
        </button>
        <button
          onClick={() => setSidebarTab('configure')}
          className={`flex-1 py-2 text-xs font-medium text-center border-b-2 ${
            sidebarTab === 'configure'
              ? 'text-primary border-primary'
              : 'text-muted-foreground border-transparent'
          }`}
        >
          Configure
        </button>
      </div>

      {/* Content (only visible when expanded) */}
      {expanded && (
        <div className="flex-1 overflow-y-auto" style={{ maxHeight: 'calc(70vh - 80px)' }}>
          {sidebarTab === 'objects' ? <ObjectsTab /> : <ConfigureTab />}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Import MobileBottomSheet in Sidebar.tsx**

Add import at top of `Sidebar.tsx`:
```typescript
import MobileBottomSheet from './MobileBottomSheet';
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/MobileBottomSheet.tsx src/components/ui/Sidebar.tsx
git commit -m "feat: add mobile bottom sheet for sidebar on small screens"
```

---

### Task 11: Clean Up — Remove CapsuleToolbar and BuildingManager

**Files:**
- Delete: `src/components/ui/CapsuleToolbar.tsx`
- Delete: `src/components/ui/BuildingManager.tsx`
- Modify: `src/app/page.tsx` (if import remains)

- [ ] **Step 1: Verify no other files import CapsuleToolbar or BuildingManager**

Run:
```bash
grep -r "CapsuleToolbar\|BuildingManager" src/ --include="*.tsx" --include="*.ts" -l
```

Only `page.tsx` should reference CapsuleToolbar — already removed in Task 5. No other file should import BuildingManager.

- [ ] **Step 2: Delete the old files**

```bash
git rm src/components/ui/CapsuleToolbar.tsx src/components/ui/BuildingManager.tsx
```

- [ ] **Step 3: Commit**

```bash
git commit -m "chore: remove CapsuleToolbar and BuildingManager — replaced by Sidebar"
```

---

### Task 12: Update Remaining Store References

**Files:**
- Modify: `src/components/canvas/BuildingInstance.tsx` (uses `setAccordionSection`)
- Check all other files that reference `activeAccordionSection` or `setAccordionSection`

- [ ] **Step 1: Update BuildingInstance.tsx**

This file imports and calls `setAccordionSection(2)` when clicking a building in 3D. Since `selectBuilding` now handles switching to the Configure tab automatically, remove the `setAccordionSection` usage entirely:

- Remove the `setAccordionSection` store subscription
- Remove the `setAccordionSection(2)` call from the click handler
- The `selectBuilding(id)` call already switches the sidebar tab

- [ ] **Step 2: Find and fix all other remaining references**

Run:
```bash
grep -r "activeAccordionSection\|setAccordionSection" src/ --include="*.tsx" --include="*.ts" -l
```

For each file found, replace:
- `activeAccordionSection` → `activeConfigSection`
- `setAccordionSection` → `setActiveConfigSection`
- Numeric values (1-6) → named strings (`'dimensions'`, `'structure'`, `'walls'`, `'quote'`)

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "refactor: replace all activeAccordionSection references with activeConfigSection"
```

---

### Task 13: Verify and Fix Build

- [ ] **Step 1: Run build to check for errors**

```bash
npm run build
```

- [ ] **Step 2: Fix any TypeScript or import errors**

Address all compilation errors — likely missing imports, type mismatches from the store changes, or unused imports in deleted files.

- [ ] **Step 3: Commit fixes**

```bash
git add -A
git commit -m "fix: resolve build errors from sidebar UI migration"
```

---

### Task 14: Manual Smoke Test Checklist

- [ ] **Step 1: Verify all features work**

Open app in browser, test:
1. Sidebar shows on right side with Objects and Configure tabs
2. Objects tab: catalog grid visible, placed objects list visible
3. Drag object from catalog to 2D canvas — object appears at drop position
4. Click object on canvas — sidebar switches to Configure tab, object pulses
5. Accordion sections open/close correctly (one at a time)
6. Dimensions, Structure, Walls, Quote sections show correct controls
7. Press `[` — sidebar collapses, shows re-open button
8. Press `[` again — sidebar re-opens
9. Select object, press Backspace — object deleted, sidebar switches to Objects tab
10. Resize to mobile width — bottom sheet appears instead of sidebar
11. ConfigCodeDialog and Reset button work from sidebar footer
12. 3D view toggle works, shows view-only 3D scene
