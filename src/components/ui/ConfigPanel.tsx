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
    <aside className="flex h-full flex-col overflow-y-auto bg-background">
      <div className="border-b border-border px-5 py-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">{t('app.title')}</h2>
          <button
            onClick={resetConfig}
            className="text-xs font-medium text-muted-foreground hover:text-destructive transition-colors"
          >
            {t('app.reset')}
          </button>
        </div>
      </div>

      <div className="flex-1">
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

        <AccordionSection number={6} title={t('section.6')}>
          <QuoteSummary />
        </AccordionSection>
      </div>
    </aside>
  );
}
