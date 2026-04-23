import type { BuildingEntity, RoofConfig } from '@/domain/building';
import { t } from '@/lib/i18n';
import type { SnapConnection } from '@/domain/building';
import {
  getAvailableWallIds,
} from '@/domain/building';
import { getAtom } from '@/domain/materials';
import { calculateTotalQuote } from '@/domain/pricing';
import type { PriceBook } from '@/domain/pricing';
import type { MaterialRow } from '@/domain/catalog';
import type { SupplierProductRow } from '@/domain/supplier';

function wallMaterialLabel(materials: MaterialRow[], id: string): string {
  const atom = getAtom(materials, id, 'wall');
  return atom ? atom.name : id;
}

function roofCoveringLabel(materials: MaterialRow[], id: string): string {
  const atom = getAtom(materials, id, 'roof-cover');
  return atom ? atom.name : id;
}

function floorMaterialLabel(materials: MaterialRow[], id: string): string {
  const atom = getAtom(materials, id, 'floor');
  return atom ? atom.name : id;
}

function doorMaterialLabel(materials: MaterialRow[], id: string): string {
  const atom = getAtom(materials, id, 'door');
  return atom ? atom.name : id;
}

function supplierProductLabel(
  products: SupplierProductRow[],
  productId: string | null | undefined,
): string | null {
  if (!productId) return null;
  const found = products.find((p) => p.id === productId);
  if (!found) return t('quote.line.supplierMissing', { id: productId });
  return `${found.name} (${found.sku})`;
}

function buildSpecRows(
  buildings: BuildingEntity[],
  roof: RoofConfig,
  defaultHeight: number,
  priceBook: PriceBook,
  materials: MaterialRow[],
  supplierProducts: SupplierProductRow[],
): string {
  const rows: string[] = [];

  const row = (label: string, value: string) =>
    `<tr><td style="padding:6px 16px 6px 0;color:#666;white-space:nowrap">${label}</td><td style="padding:6px 0;font-weight:500">${value}</td></tr>`;

  // Per-building specs
  for (let i = 0; i < buildings.length; i++) {
    const b = buildings[i];
    const effectiveH = b.heightOverride ?? defaultHeight;
    const typeName = t(`building.name.${b.type}`);
    rows.push(`<tr><td colspan="2" style="padding:12px 0 6px;font-weight:600;font-size:14px;border-bottom:1px solid #eee">${typeName} ${i + 1}</td></tr>`);

    if (b.type === 'paal') {
      // Poles: show only height
      rows.push(row(t('dim.height'), `${effectiveH.toFixed(1)} m`));
    } else if (b.type === 'muur') {
      // Walls: show width and height (no depth), add orientation
      rows.push(row(t('dim.width'), `${b.dimensions.width.toFixed(1)} m`));
      rows.push(row(t('dim.height'), `${effectiveH.toFixed(1)} m`));
      const orientationLabel = b.orientation === 'horizontal'
        ? t('dim.orientation.horizontal')
        : t('dim.orientation.vertical');
      rows.push(row(t('dim.orientation'), orientationLabel));
    } else {
      // Normal buildings: show width, depth, height
      rows.push(row(t('dim.width'), `${b.dimensions.width.toFixed(1)} m`));
      rows.push(row(t('dim.depth'), `${b.dimensions.depth.toFixed(1)} m`));
      rows.push(row(t('dim.height'), `${effectiveH.toFixed(1)} m`));
      rows.push(row(t('floor.material'), floorMaterialLabel(materials, b.floor.materialId)));

      const wallIds = getAvailableWallIds(b.type);
      const activeWallIds = wallIds.filter((id) => b.walls[id]);
      for (const id of activeWallIds) {
        const w = b.walls[id];
        if (!w) continue;
        const parts: string[] = [wallMaterialLabel(materials, w.materialId ?? b.primaryMaterialId)];
        if (w.hasDoor) {
          const supplierDoor = supplierProductLabel(supplierProducts, w.doorSupplierProductId);
          if (supplierDoor) {
            parts.push(`${t('surface.door')}: ${supplierDoor}`);
          } else {
            const size = t(`surface.doorSize.${w.doorSize}`);
            const mat = doorMaterialLabel(materials, w.doorMaterialId ?? b.primaryMaterialId);
            const withWindow = w.doorHasWindow ? `, ${t('surface.doorHasWindow').toLowerCase()}` : '';
            parts.push(`${t('surface.door')}: ${size} (${mat}${withWindow})`);
          }
        }
        const windows = w.windows ?? [];
        if (windows.length > 0) {
          const supplierWindows = windows
            .map((win) => supplierProductLabel(supplierProducts, win.supplierProductId))
            .filter((label): label is string => Boolean(label));
          if (supplierWindows.length === windows.length) {
            parts.push(`${windows.length}× ${t('surface.windows').toLowerCase()}: ${supplierWindows.join(', ')}`);
          } else {
            parts.push(`${windows.length}× ${t('surface.windows').toLowerCase()}`);
          }
        }
        rows.push(row(t(`wall.${id}`), parts.join(' · ')));
      }
    }
  }

  // Shared roof
  rows.push(`<tr><td colspan="2" style="padding:12px 0 6px;font-weight:600;font-size:14px;border-bottom:1px solid #eee">${t('section.3')}</td></tr>`);
  rows.push(row(t('roofType.label'), t(`roofType.${roof.type}`)));
  rows.push(row(t('roof.covering'), roofCoveringLabel(materials, roof.coveringId)));
  if (roof.hasSkylight) {
    rows.push(row(t('roof.skylight'), 'Ja'));
  }

  // Quote
  const { lineItems, total } = calculateTotalQuote(buildings, roof, priceBook, materials, supplierProducts, defaultHeight);
  rows.push(`<tr><td colspan="2" style="padding:12px 0 6px;font-weight:600;font-size:14px;border-bottom:1px solid #eee">${t('section.6')}</td></tr>`);
  for (const item of lineItems) {
    rows.push(row(t(item.labelKey, item.labelParams), `€${item.total.toFixed(0)}`));
  }
  rows.push(`<tr><td style="padding:8px 16px 8px 0;font-weight:700;border-top:2px solid #333">${t('quote.total')}</td><td style="padding:8px 0;font-weight:700;font-size:16px;border-top:2px solid #333">€${total.toFixed(0)}</td></tr>`);

  return rows.join('\n');
}

export function exportFloorPlan(
  buildings: BuildingEntity[],
  connections: SnapConnection[],
  roof: RoofConfig,
  priceBook: PriceBook,
  materials: MaterialRow[],
  supplierProducts: SupplierProductRow[],
  shareCode: string,
  defaultHeight: number = 3,
) {
  void connections;
  const svgEl = document.querySelector('.schematic-svg');
  if (!svgEl) return;
  const svgMarkup = svgEl.outerHTML;

  const specRows = buildSpecRows(buildings, roof, defaultHeight, priceBook, materials, supplierProducts);
  const configCode = shareCode;
  const title = `${t('app.title')} — ${t('schematic.title')}`;
  const date = new Date().toLocaleDateString('nl-NL', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const html = `<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; color: #222; }
  @page { size: A4 landscape; margin: 14mm; }
  .page { padding: 24px; page-break-after: always; overflow: hidden; }
  .page:last-child { page-break-after: auto; }
  .header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 12px; }
  .header h1 { font-size: 18px; font-weight: 600; }
  .header .date { font-size: 12px; color: #999; }
  .plan-container svg { width: 100%; height: auto; max-height: 155mm; }
  .specs { max-width: 700px; }
  .specs table { width: 100%; font-size: 13px; border-collapse: collapse; }
  @media print {
    .page { padding: 0; }
  }
</style>
</head>
<body>
<!-- Page 1: Floor plan -->
<div class="page">
  <div class="header">
    <h1>${title}</h1>
    <div style="text-align:right">
      <span class="date">${date}</span><br>
      <span style="font-family:monospace;font-size:11px;color:#666">Code: ${configCode}</span>
    </div>
  </div>
  <div class="plan-container">${svgMarkup}</div>
</div>

<!-- Page 2: Specifications -->
<div class="page">
  <div class="header">
    <h1>${t('app.title')} — ${t('section.6')}</h1>
    <div style="text-align:right">
      <span class="date">${date}</span><br>
      <span style="font-family:monospace;font-size:11px;color:#666">Code: ${configCode}</span>
    </div>
  </div>
  <div class="specs">
    <table>${specRows}</table>
  </div>
</div>

<script>window.print();<\/script>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
}
