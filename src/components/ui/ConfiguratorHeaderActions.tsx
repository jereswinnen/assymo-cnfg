'use client';

import { useCallback, useState } from 'react';
import { MoreHorizontal, ShoppingBag, Download, QrCode, RotateCcw, Loader2 } from 'lucide-react';
import { useConfigStore } from '@/store/useConfigStore';
import { useUIStore } from '@/store/useUIStore';
import { useTenant } from '@/lib/TenantProvider';
import { t } from '@/lib/i18n';
import { exportFloorPlan } from '@/components/schematic/exportFloorPlan';
import type { ConfigData } from '@/domain/config';
import ConfigCodeDialog from './ConfigCodeDialog';
import OrderSubmitDialog from './OrderSubmitDialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function ConfiguratorHeaderActions() {
  const buildings = useConfigStore((s) => s.buildings);
  const connections = useConfigStore((s) => s.connections);
  const roof = useConfigStore((s) => s.roof);
  const defaultHeight = useConfigStore((s) => s.defaultHeight);
  const version = useConfigStore((s) => s.version);
  const resetConfig = useConfigStore((s) => s.resetConfig);
  const viewMode = useUIStore((s) => s.viewMode);
  const setViewMode = useUIStore((s) => s.setViewMode);
  const tenant = useTenant();

  const [codeOpen, setCodeOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const submitDisabled = buildings.length === 0;

  const handleExport = useCallback(async () => {
    if (exporting) return;
    setExporting(true);
    try {
      // The print layout embeds the 2D schematic SVG (`.schematic-svg`),
      // which only mounts when the plan/split views are active. Switch
      // first so the DOM has it ready.
      if (viewMode === '3d') setViewMode('split');

      // Mint a share code so the PDF carries an identifier. Server
      // dedupes by content hash so repeated exports don't explode the
      // table.
      let shareCode: string;
      try {
        const data: ConfigData = { version, buildings, connections, roof, defaultHeight };
        const res = await fetch('/api/configs', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ data }),
        });
        if (!res.ok) throw new Error(`save failed: ${res.status}`);
        const body = (await res.json()) as { code?: string };
        if (!body.code) throw new Error('missing code in response');
        shareCode = body.code;
      } catch {
        // Could not obtain a code — abort export rather than printing
        // a dash-placeholder. User can retry; meanwhile nothing silently
        // wrong goes out.
        return;
      }

      // Wait a frame for SchematicView to hydrate its SVG if we just
      // flipped the view mode.
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

      exportFloorPlan(
        buildings,
        connections,
        roof,
        tenant.priceBook,
        tenant.catalog.materials,
        tenant.supplierCatalog.products,
        shareCode,
        defaultHeight,
      );
    } finally {
      setExporting(false);
    }
  }, [
    exporting,
    viewMode,
    setViewMode,
    version,
    buildings,
    connections,
    roof,
    defaultHeight,
    tenant.priceBook,
    tenant.catalog.materials,
    tenant.supplierCatalog.products,
  ]);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm">
            {exporting ? <Loader2 className="animate-spin" /> : <MoreHorizontal />}
            {t('configurator.header.menu')}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[200px]">
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              void handleExport();
            }}
          >
            <Download className="h-4 w-4" />
            {t('configurator.header.exportPlan')}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setCodeOpen(true);
            }}
          >
            <QrCode className="h-4 w-4" />
            {t('configurator.header.generateCode')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onSelect={(e) => {
              e.preventDefault();
              setResetOpen(true);
            }}
          >
            <RotateCcw className="h-4 w-4" />
            {t('configurator.header.reset')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <OrderSubmitDialog
        trigger={
          <Button
            disabled={submitDisabled}
            title={submitDisabled ? t('configurator.submit.cta.disabled') : undefined}
            className="bg-[var(--brand-primary)] text-white hover:bg-[var(--brand-primary)] hover:opacity-90"
          >
            <ShoppingBag />
            {t('configurator.submit.cta')}
          </Button>
        }
      />

      {/* Controlled ConfigCodeDialog — opened from the dropdown. */}
      <ConfigCodeDialog open={codeOpen} onOpenChange={setCodeOpen} />

      {/* Reset confirmation */}
      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('configurator.reset.confirm.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('configurator.reset.confirm.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('configurator.reset.confirm.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                resetConfig();
                setResetOpen(false);
              }}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {t('configurator.reset.confirm.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
