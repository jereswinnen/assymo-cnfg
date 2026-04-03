'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useConfigStore, selectSingleBuildingId } from '@/store/useConfigStore';
import { t } from '@/lib/i18n';
import ObjectsTab from './ObjectsTab';
import ConfigureTab from './ConfigureTab';

export default function MobileBottomSheet() {
  const [expanded, setExpanded] = useState(false);
  const sidebarTab = useConfigStore((s) => s.sidebarTab);
  const setSidebarTab = useConfigStore((s) => s.setSidebarTab);
  const selectedBuildingId = useConfigStore(selectSingleBuildingId);

  const touchStartY = useRef<number | null>(null);

  // Auto-expand when an object is selected on canvas
  useEffect(() => {
    if (selectedBuildingId) {
      setExpanded(true);
    }
  }, [selectedBuildingId]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    if (dy < -50) {
      setExpanded(true);
    } else if (dy > 50) {
      setExpanded(false);
    }
    touchStartY.current = null;
  }, []);

  const handleHandleClick = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  return (
    <>
      {/* Backdrop overlay when expanded */}
      {expanded && (
        <div
          className="fixed inset-0 bg-black/20 z-40"
          onClick={() => setExpanded(false)}
        />
      )}

      {/* Bottom sheet */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 bg-background rounded-t-2xl shadow-[0_-4px_24px_rgba(0,0,0,0.12)] ring-1 ring-black/[0.08] transition-all duration-300 ease-in-out ${
          expanded ? 'h-[70vh]' : ''
        }`}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Grab handle */}
        <div
          className="flex justify-center pt-3 pb-2 cursor-pointer"
          onClick={handleHandleClick}
        >
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-border shrink-0">
          <button
            onClick={() => setSidebarTab('objects')}
            className={`flex-1 py-2.5 text-sm font-medium text-center transition-colors border-b-2 ${
              sidebarTab === 'objects'
                ? 'text-primary border-primary'
                : 'text-muted-foreground border-transparent hover:text-foreground'
            }`}
          >
            {t('sidebar.tab.objects')}
          </button>
          <button
            onClick={() => setSidebarTab('configure')}
            className={`flex-1 py-2.5 text-sm font-medium text-center transition-colors border-b-2 ${
              sidebarTab === 'configure'
                ? 'text-primary border-primary'
                : 'text-muted-foreground border-transparent hover:text-foreground'
            }`}
          >
            {t('sidebar.tab.configure')}
          </button>
        </div>

        {/* Content area — only visible when expanded */}
        {expanded && (
          <div className="flex-1 overflow-y-auto" style={{ height: 'calc(70vh - 88px)' }}>
            {sidebarTab === 'objects' ? <ObjectsTab /> : <ConfigureTab />}
          </div>
        )}
      </div>
    </>
  );
}
