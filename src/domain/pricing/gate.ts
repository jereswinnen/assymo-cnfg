import type { BuildingEntity } from '@/domain/building';
import type { MaterialRow } from '@/domain/catalog';
import type { GateMeta, GateMetaOption, SupplierProductRow } from '@/domain/supplier';
import type { LineItem } from './calculate';
import type { PriceBook } from './priceBook';

/** Pure pricing for a `'poort'` building. When the gate references an
 *  active supplier product (`gateConfig.supplierProductId`), pricing is
 *  driven by the SKU's base price + selected option surcharges + the
 *  SKU's motor surcharge (when motorized==='optional' and the customer
 *  enabled it). Otherwise the naked-gate path applies: per-m² material
 *  cost from `MaterialPricing.gate.perSqm` plus per-leaf, motor and
 *  sliding dials from `priceBook.poort`.
 *
 *  Sliding + per-leaf dials from `priceBook.poort` continue to apply on
 *  the SKU path because they are tenant-level dials independent of the
 *  catalog model.
 *
 *  Archived or missing supplier products fall back to the naked-gate
 *  path; the order-route existence/archive checks reject those before
 *  pricing is invoked at submit time.
 *
 *  Area is the gate's outer footprint (`dimensions.width × effectiveHeight`)
 *  — same source as 3D rendering and snap, so authoring stays consistent. */
export function gateLineItems(
  building: BuildingEntity,
  materials: MaterialRow[],
  priceBook: PriceBook,
  effectiveHeight: number,
  supplierProducts: SupplierProductRow[],
): LineItem[] {
  const gate = building.gateConfig;
  if (!gate) return [];

  const items: LineItem[] = [];

  const partCount = gate.partCount;
  const areaSqm = building.dimensions.width * effectiveHeight;

  // Resolve supplier product (active only — archived/missing falls through to
  // the naked-gate path; submit-time existence checks handle the error case).
  const sku = gate.supplierProductId
    ? supplierProducts.find(
        (p) => p.id === gate.supplierProductId && p.kind === 'gate' && p.archivedAt === null,
      )
    : undefined;

  if (sku) {
    const meta = sku.meta as GateMeta;
    const skuTotal = sku.priceCents / 100;
    items.push({
      labelKey: 'quote.line.gateSupplier',
      labelParams: { name: sku.name, sku: sku.sku },
      area: 0,
      materialCost: 0,
      insulationCost: 0,
      extrasCost: skuTotal,
      total: skuTotal,
      source: { kind: 'supplierProduct', productId: sku.id, sku: sku.sku },
    });

    const optionSelections: ReadonlyArray<{
      selectedSku: string | null | undefined;
      list: GateMetaOption[] | undefined;
    }> = [
      { selectedSku: gate.selectedColorSku, list: meta.availableColors },
      { selectedSku: gate.selectedLockSku, list: meta.availableLocks },
      { selectedSku: gate.selectedHandleSku, list: meta.availableHandles },
    ];
    for (const { selectedSku, list } of optionSelections) {
      if (!selectedSku || !list) continue;
      const opt = list.find((o) => o.sku === selectedSku);
      if (!opt || !opt.surchargeCents) continue;
      const total = opt.surchargeCents / 100;
      items.push({
        labelKey: 'quote.line.gateOption',
        labelParams: {
          name: opt.label ?? '',
          ...(opt.labelKey ? { labelKey: opt.labelKey } : {}),
        },
        area: 0,
        materialCost: 0,
        insulationCost: 0,
        extrasCost: total,
        total,
        source: { kind: 'supplierProduct', productId: sku.id, sku: sku.sku },
      });
    }

    if (
      meta.motorized === 'optional' &&
      gate.motorized &&
      meta.motorizedSurchargeCents
    ) {
      const total = meta.motorizedSurchargeCents / 100;
      items.push({
        labelKey: 'quote.line.gateMotor',
        labelParams: {},
        area: 0,
        materialCost: 0,
        insulationCost: 0,
        extrasCost: total,
        total,
        source: { kind: 'supplierProduct', productId: sku.id, sku: sku.sku },
      });
    }

    if (gate.swingDirection === 'sliding' && priceBook.poort.slidingSurcharge > 0) {
      const total = priceBook.poort.slidingSurcharge;
      items.push({
        labelKey: 'quote.line.gateSliding',
        labelParams: {},
        area: 0,
        materialCost: 0,
        insulationCost: 0,
        extrasCost: total,
        total,
        source: { kind: 'supplierProduct', productId: sku.id, sku: sku.sku },
      });
    }

    if (priceBook.poort.perLeafBase > 0) {
      const total = partCount * priceBook.poort.perLeafBase;
      items.push({
        labelKey: 'quote.line.gatePerLeaf',
        labelParams: { count: partCount },
        area: 0,
        materialCost: 0,
        insulationCost: 0,
        extrasCost: total,
        total,
        source: { kind: 'supplierProduct', productId: sku.id, sku: sku.sku },
      });
    }

    return items;
  }

  const material = materials.find(
    (m) => m.slug === gate.materialId && m.categories.includes('gate'),
  );

  if (!material) {
    items.push({
      labelKey: 'quote.line.gateMaterialMissing',
      labelParams: { materialId: gate.materialId },
      area: 0,
      materialCost: 0,
      insulationCost: 0,
      extrasCost: 0,
      total: 0,
      source: { kind: 'gate', buildingId: building.id, materialSlug: '' },
    });
  } else {
    const perSqm = material.pricing.gate?.perSqm ?? 0;
    const materialCost = areaSqm * perSqm;
    items.push({
      labelKey: 'quote.line.gateMaterial',
      labelParams: { materialName: material.name, sqm: areaSqm.toFixed(2) },
      area: areaSqm,
      materialCost,
      insulationCost: 0,
      extrasCost: 0,
      total: materialCost,
      source: {
        kind: 'gate',
        buildingId: building.id,
        materialSlug: material.slug,
      },
    });
  }

  const materialSlug = material?.slug ?? '';

  if (priceBook.poort.perLeafBase > 0) {
    const total = partCount * priceBook.poort.perLeafBase;
    items.push({
      labelKey: 'quote.line.gatePerLeaf',
      labelParams: { count: partCount },
      area: 0,
      materialCost: 0,
      insulationCost: 0,
      extrasCost: total,
      total,
      source: { kind: 'gate', buildingId: building.id, materialSlug },
    });
  }

  if (gate.motorized && priceBook.poort.motorSurcharge > 0) {
    const total = priceBook.poort.motorSurcharge;
    items.push({
      labelKey: 'quote.line.gateMotor',
      labelParams: {},
      area: 0,
      materialCost: 0,
      insulationCost: 0,
      extrasCost: total,
      total,
      source: { kind: 'gate', buildingId: building.id, materialSlug },
    });
  }

  if (gate.swingDirection === 'sliding' && priceBook.poort.slidingSurcharge > 0) {
    const total = priceBook.poort.slidingSurcharge;
    items.push({
      labelKey: 'quote.line.gateSliding',
      labelParams: {},
      area: 0,
      materialCost: 0,
      insulationCost: 0,
      extrasCost: total,
      total,
      source: { kind: 'gate', buildingId: building.id, materialSlug },
    });
  }

  return items;
}
