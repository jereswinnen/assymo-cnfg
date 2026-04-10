import type { BuildingEntity, RoofConfig, WallId } from '@/types/building';
import { t } from '@/lib/i18n';
import { encodeState } from '@/lib/configCode';
import type { SnapConnection } from '@/types/building';
import {
  WALL_MATERIALS,
  ROOF_COVERINGS,
  FLOOR_MATERIALS,
  DOOR_MATERIALS,
  getAvailableWallIds,
} from '@/lib/constants';
import { calculateTotalQuote } from '@/lib/pricing';

function wallMaterialLabel(id: string): string {
  return WALL_MATERIALS.find((m) => m.id === id)?.label ?? id;
}

function roofCoveringLabel(id: string): string {
  return ROOF_COVERINGS.find((c) => c.id === id)?.label ?? id;
}

function floorMaterialLabel(id: string): string {
  return FLOOR_MATERIALS.find((m) => m.id === id)?.label ?? id;
}

function doorMaterialLabel(id: string): string {
  return DOOR_MATERIALS.find((m) => m.id === id)?.label ?? id;
}

function buildSpecRows(buildings: BuildingEntity[], roof: RoofConfig, defaultHeight: number): string {
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
      rows.push(row(t('floor.material'), floorMaterialLabel(b.floor.materialId)));

      const wallIds = getAvailableWallIds(b.type);
      const activeWallIds = wallIds.filter((id) => b.walls[id]);
      for (const id of activeWallIds) {
        const w = b.walls[id];
        if (!w) continue;
        const parts: string[] = [wallMaterialLabel(w.materialId)];
        if (w.hasDoor) {
          const size = t(`surface.doorSize.${w.doorSize}`);
          const mat = doorMaterialLabel(w.doorMaterialId);
          const withWindow = w.doorHasWindow ? `, ${t('surface.doorHasWindow').toLowerCase()}` : '';
          parts.push(`${t('surface.door')}: ${size} (${mat}${withWindow})`);
        }
        if ((w.windows ?? []).length > 0) {
          parts.push(`${w.windows.length}× ${t('surface.windows').toLowerCase()}`);
        }
        rows.push(row(t(`wall.${id}`), parts.join(' · ')));
      }
    }
  }

  // Shared roof
  rows.push(`<tr><td colspan="2" style="padding:12px 0 6px;font-weight:600;font-size:14px;border-bottom:1px solid #eee">${t('section.3')}</td></tr>`);
  rows.push(row(t('roofType.label'), t(`roofType.${roof.type}`)));
  rows.push(row(t('roof.covering'), roofCoveringLabel(roof.coveringId)));
  if (roof.hasSkylight) {
    rows.push(row(t('roof.skylight'), 'Ja'));
  }

  // Quote
  const { lineItems, total } = calculateTotalQuote(buildings, roof, defaultHeight);
  rows.push(`<tr><td colspan="2" style="padding:12px 0 6px;font-weight:600;font-size:14px;border-bottom:1px solid #eee">${t('section.6')}</td></tr>`);
  for (const item of lineItems) {
    rows.push(row(item.label, `€${item.total.toFixed(0)}`));
  }
  rows.push(`<tr><td style="padding:8px 16px 8px 0;font-weight:700;border-top:2px solid #333">${t('quote.total')}</td><td style="padding:8px 0;font-weight:700;font-size:16px;border-top:2px solid #333">€${total.toFixed(0)}</td></tr>`);

  return rows.join('\n');
}

export function exportFloorPlan(buildings: BuildingEntity[], connections: SnapConnection[], roof: RoofConfig, defaultHeight: number = 3) {
  const svgEl = document.querySelector('.schematic-svg');
  if (!svgEl) return;
  const svgMarkup = svgEl.outerHTML;

  const specRows = buildSpecRows(buildings, roof, defaultHeight);
  const configCode = encodeState(buildings, connections, roof, defaultHeight);
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
