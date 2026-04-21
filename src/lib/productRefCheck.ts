import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/db/client';
import { materials } from '@/db/schema';
import {
  PRODUCT_SLOT_TO_CATEGORY,
  type ProductSlot,
  type ProductValidationFieldError,
} from '@/domain/catalog';

export async function checkProductMaterialReferences(
  tenantId: string,
  defaultsMaterials: Partial<Record<ProductSlot, string>> | undefined,
  allow: Partial<Record<ProductSlot, string[]>> | undefined,
): Promise<ProductValidationFieldError[]> {
  const errors: ProductValidationFieldError[] = [];
  const toCheck: Array<{ slot: ProductSlot; slug: string; kind: 'default' | 'allow' }> = [];
  if (defaultsMaterials) {
    for (const [slot, slug] of Object.entries(defaultsMaterials) as [ProductSlot, string][]) {
      toCheck.push({ slot, slug, kind: 'default' });
    }
  }
  if (allow) {
    for (const [slot, slugs] of Object.entries(allow) as [ProductSlot, string[]][]) {
      for (const slug of slugs) toCheck.push({ slot, slug, kind: 'allow' });
    }
  }
  if (toCheck.length === 0) return errors;
  const rows = await db
    .select({ slug: materials.slug, category: materials.category })
    .from(materials)
    .where(and(eq(materials.tenantId, tenantId), isNull(materials.archivedAt)));
  const rowsBy = new Map(rows.map((r) => [`${r.category}:${r.slug}`, true]));
  for (const c of toCheck) {
    const category = PRODUCT_SLOT_TO_CATEGORY[c.slot];
    if (!rowsBy.has(`${category}:${c.slug}`)) {
      const code = c.kind === 'default' ? 'default_material_not_found' : 'allowed_material_not_found';
      errors.push({
        field: c.kind === 'default'
          ? `defaults.materials.${c.slot}`
          : `constraints.allowedMaterialsBySlot.${c.slot}`,
        code,
      });
    }
  }
  return errors;
}
