'use client';

import { useState, useEffect } from 'react';
import {
  Home,
  Ruler,
  Umbrella,
  PanelLeft,
  Grid3x3,
  FileText,
  RotateCcw,
  MoreHorizontal,
} from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import ConfigCodeDialog from './ConfigCodeDialog';
import BuildingManager from './BuildingManager';
import DimensionsControl from './DimensionsControl';
import RoofConfigSection from './RoofConfigSection';
import WallSelector from './WallSelector';
import SurfaceProperties from './SurfaceProperties';
import FloorConfigSection from './FloorConfigSection';
import QuoteSummary from './QuoteSummary';
import { useConfigStore } from '@/store/useConfigStore';
import { t } from '@/lib/i18n';

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia('(min-width: 1024px)');
    setIsDesktop(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);
  return isDesktop;
}

const sections = [
  { number: 1, icon: Home },
  { number: 2, icon: Ruler },
  { number: 3, icon: Umbrella },
  { number: 4, icon: PanelLeft },
  { number: 5, icon: Grid3x3 },
  { number: 6, icon: FileText },
] as const;

function WallsContent() {
  const selectedBuilding = useConfigStore((s) => {
    const b = s.buildings.find(b => b.id === s.selectedBuildingId);
    return b ?? null;
  });
  return (
    <div className="space-y-4">
      <WallSelector />
      {selectedBuilding && selectedBuilding.type !== 'overkapping' && (
        <>
          <Separator />
          <SurfaceProperties />
        </>
      )}
    </div>
  );
}

function SectionContent({ number }: { number: number }) {
  switch (number) {
    case 1: return <BuildingManager />;
    case 2: return <DimensionsControl />;
    case 3: return <RoofConfigSection />;
    case 4: return <WallsContent />;
    case 5: return <FloorConfigSection />;
    case 6: return <QuoteSummary />;
    default: return null;
  }
}

export default function CapsuleToolbar() {
  const activeSection = useConfigStore((s) => s.activeAccordionSection);
  const setSection = useConfigStore((s) => s.setAccordionSection);
  const resetConfig = useConfigStore((s) => s.resetConfig);
  const isDesktop = useIsDesktop();

  const popoverSide = isDesktop ? 'left' as const : 'top' as const;
  const iconSize = isDesktop ? 'h-5 w-5' : 'h-[18px] w-[18px]';
  const buttonSize = isDesktop ? 'h-11 w-11' : 'h-10 w-10';

  const tooltipSide = isDesktop ? 'left' as const : 'top' as const;

  return (
    <TooltipProvider>
      <div
        className={
          isDesktop
            ? 'fixed right-4 top-1/2 -translate-y-1/2 z-30 flex flex-col items-center gap-1 bg-background/80 backdrop-blur-xl rounded-[28px] shadow-xl ring-1 ring-black/[0.08] p-2'
            : 'fixed bottom-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 bg-background/80 backdrop-blur-xl rounded-[28px] shadow-xl ring-1 ring-black/[0.08] p-2'
        }
      >
        {sections.map(({ number, icon: Icon }) => (
          <Popover
            key={number}
            open={activeSection === number}
            onOpenChange={(open) => setSection(open ? number : -1)}
          >
            <Tooltip open={activeSection !== -1 ? false : undefined}>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <button
                    className={`flex items-center justify-center ${buttonSize} rounded-xl transition-colors ${
                      activeSection === number
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                  >
                    <Icon className={iconSize} />
                  </button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent side={tooltipSide}>
                {t(`section.${number}`)}
              </TooltipContent>
            </Tooltip>
            <PopoverContent
              side={popoverSide}
              className={
                isDesktop
                  ? `${number === 4 ? 'w-96' : 'w-80'} max-h-[min(70vh,600px)] overflow-hidden flex flex-col`
                  : 'w-[min(90vw,380px)] max-h-[min(50vh,400px)] overflow-hidden flex flex-col'
              }
              onOpenAutoFocus={(e) => e.preventDefault()}
            >
              <h3 className="text-sm font-semibold text-foreground mb-3 shrink-0">
                {t(`section.${number}`)}
              </h3>
              <div className="overflow-y-auto min-h-0">
                <SectionContent number={number} />
              </div>
            </PopoverContent>
          </Popover>
        ))}

        {isDesktop ? (
          <>
            <Separator className="my-1 w-8" />
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={resetConfig}
                  className="flex items-center justify-center h-11 w-11 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <RotateCcw className="h-5 w-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="left">
                {t('app.reset')}
              </TooltipContent>
            </Tooltip>
            <ConfigCodeDialog iconOnly />
          </>
        ) : (
          <Popover>
            <PopoverTrigger asChild>
              <button className="flex items-center justify-center h-10 w-10 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                <MoreHorizontal className="h-[18px] w-[18px]" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              side="top"
              className="w-48 p-2"
              onOpenAutoFocus={(e) => e.preventDefault()}
            >
              <button
                onClick={resetConfig}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              >
                <RotateCcw className="h-4 w-4" />
                {t('app.reset')}
              </button>
              <ConfigCodeDialog />
            </PopoverContent>
          </Popover>
        )}
      </div>
    </TooltipProvider>
  );
}
