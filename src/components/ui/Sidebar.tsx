'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useConfigStore } from '@/store/useConfigStore';
import { t } from '@/lib/i18n';
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

  // Keyboard shortcuts: [ to toggle sidebar, Delete/Backspace to remove selected building
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
      if (e.key === '[') {
        setSidebarCollapsed(!sidebarCollapsed);
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const state = useConfigStore.getState();
        const sid = state.selectedBuildingIds.length === 1 ? state.selectedBuildingIds[0] : null;
        if (sid) {
          e.preventDefault();
          state.removeBuilding(sid);
        }
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
        className={`relative h-dvh bg-background border-l border-border flex flex-col shrink-0 transition-all duration-200 ease-in-out overflow-hidden ${
          sidebarCollapsed ? 'w-0 border-l-0' : 'w-[320px]'
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
            {t('sidebar.tab.objects')}
          </button>
          <button
            onClick={() => setSidebarTab('configure')}
            className={`flex-1 py-3 text-sm font-medium text-center transition-colors border-b-2 ${
              sidebarTab === 'configure'
                ? 'text-primary border-primary'
                : 'text-muted-foreground border-transparent hover:text-foreground'
            }`}
          >
            {t('sidebar.tab.configure')}
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
