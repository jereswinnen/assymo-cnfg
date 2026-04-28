import type { BuildingEntity } from '@/domain/building';
import type { MaterialRow } from '@/domain/catalog';
import type { LineItem } from './calculate';
import type { PriceBook } from './priceBook';

/** Pure pricing for a `'poort'` building. Always emits a material line
 *  item (or a missing-material stub when the referenced `materialId`
 *  doesn't resolve to a `gate`-category material). Surcharges are
 *  conditional on `priceBook.poort` dials being non-zero. All values are
 *  in euros — `MaterialPricing.gate.perSqm` and every `priceBook.poort.*`
 *  field share the same euro unit as the rest of the price book. */
export function gateLineItems(
  building: BuildingEntity,
  materials: MaterialRow[],
  priceBook: PriceBook,
): LineItem[] {
  const gate = building.gateConfig;
  if (!gate) return [];

  const items: LineItem[] = [];

  const partCount = gate.partCount;
  const areaSqm = (partCount * gate.partWidthMm * gate.heightMm) / 1_000_000;

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
