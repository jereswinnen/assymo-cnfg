'use client';

import AccordionSection from './Accordion';
import BuildingTypeSelector from './BuildingTypeSelector';
import DimensionsControl from './DimensionsControl';
import RoofConfigSection from './RoofConfigSection';
import WallSelector from './WallSelector';
import SurfaceProperties from './SurfaceProperties';
import FloorConfigSection from './FloorConfigSection';
import QuoteSummary from './QuoteSummary';
import { Separator } from '@/components/ui/separator';
import { useConfigStore } from '@/store/useConfigStore';
import { t } from '@/lib/i18n';

export default function ConfigPanel() {
  const resetConfig = useConfigStore((s) => s.resetConfig);
  const buildingType = useConfigStore((s) => s.config.buildingType);

  return (
    <aside className="flex h-full flex-col rounded-2xl bg-background/80 backdrop-blur-xl shadow-2xl ring-1 ring-black/[0.08]">
      {/* Header */}
      <div className="px-6 py-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold tracking-tight text-foreground">{t('app.title')}</h2>
          <button
            onClick={resetConfig}
            className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            {t('app.reset')}
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <AccordionSection number={1} title={t('section.1')}>
          <BuildingTypeSelector />
        </AccordionSection>

        <AccordionSection number={2} title={t('section.2')}>
          <DimensionsControl />
        </AccordionSection>

        <AccordionSection number={3} title={t('section.3')}>
          <RoofConfigSection />
        </AccordionSection>

        <AccordionSection number={4} title={t('section.4')}>
          <div className="space-y-4">
            <WallSelector />
            {buildingType !== 'overkapping' && (
              <>
                <Separator />
                <SurfaceProperties />
              </>
            )}
          </div>
        </AccordionSection>

        <AccordionSection number={5} title={t('section.5')}>
          <FloorConfigSection />
        </AccordionSection>

        <AccordionSection number={6} title={t('section.6')} isLast>
          <QuoteSummary />
        </AccordionSection>
      </div>
    </aside>
  );
}
