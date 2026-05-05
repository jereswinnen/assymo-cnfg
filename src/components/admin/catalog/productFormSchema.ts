import { z } from 'zod';
import { PRODUCT_KINDS, type ProductKind } from '@/domain/catalog';

export const productFormSchema = z
  .object({
    kind: z.enum(PRODUCT_KINDS as unknown as [ProductKind, ...ProductKind[]]),
    slug: z.string().min(1).max(48),
    name: z.string().min(1).max(100),
    description: z.string().max(1000).nullable(),
    heroImage: z.string().nullable(),
    // Structural defaults (overkapping/berging only)
    width: z.number().nullable(),
    depth: z.number().nullable(),
    height: z.number().nullable(),
    wallSlug: z.string().nullable(),
    roofCoverSlug: z.string().nullable(),
    roofTrimSlug: z.string().nullable(),
    floorSlug: z.string().nullable(),
    doorSlug: z.string().nullable(),
    // Structural constraints
    minWidth: z.number().nullable(),
    maxWidth: z.number().nullable(),
    minDepth: z.number().nullable(),
    maxDepth: z.number().nullable(),
    minHeight: z.number().nullable(),
    maxHeight: z.number().nullable(),
    allowWall: z.array(z.string()),
    allowRoofCover: z.array(z.string()),
    allowRoofTrim: z.array(z.string()),
    allowFloor: z.array(z.string()),
    allowDoor: z.array(z.string()),
    // Poort defaults
    poortPartCount: z.union([z.literal(1), z.literal(2)]).optional(),
    poortPartWidthMm: z.number().int().optional(),
    poortHeightMm: z.number().int().optional(),
    poortPartGapMm: z.number().int().min(0).max(500).optional(),
    poortSwingDirection: z.enum(['inward', 'outward', 'sliding']).optional(),
    poortMotorized: z.boolean().optional(),
    poortMaterialSlug: z.string().nullable(),
    // Poort constraints
    poortPartCountAllowed: z.array(z.union([z.literal(1), z.literal(2)])),
    poortPartWidthMinMm: z.number().int().optional(),
    poortPartWidthMaxMm: z.number().int().optional(),
    poortHeightMinMm: z.number().int().optional(),
    poortHeightMaxMm: z.number().int().optional(),
    poortSwingsAllowed: z.array(z.enum(['inward', 'outward', 'sliding'])),
    // tri-state: undefined = any, true = always, false = never
    poortMotorizedAllowed: z.boolean().optional(),
    poortAllowedMaterialSlugs: z.array(z.string()),
    // Dakbak (overkapping/berging only) — values stored in METERS, rendered in CM
    dakbakFasciaHeight: z.number().min(0.1).max(0.6).optional(),
    dakbakFasciaOverhang: z.number().min(0).max(0.8).optional(),
    dakbakFasciaHeightMin: z.number().min(0.1).max(0.6).optional(),
    dakbakFasciaHeightMax: z.number().min(0.1).max(0.6).optional(),
    dakbakFasciaOverhangMin: z.number().min(0).max(0.8).optional(),
    dakbakFasciaOverhangMax: z.number().min(0).max(0.8).optional(),
    basePriceEur: z.number().nullable(),
    sortOrder: z.number().int(),
  })
  .refine(
    (d) =>
      d.dakbakFasciaHeightMin === undefined ||
      d.dakbakFasciaHeightMax === undefined ||
      d.dakbakFasciaHeightMin <= d.dakbakFasciaHeightMax,
    { message: 'Min must be ≤ max', path: ['dakbakFasciaHeightMin'] },
  )
  .refine(
    (d) =>
      d.dakbakFasciaOverhangMin === undefined ||
      d.dakbakFasciaOverhangMax === undefined ||
      d.dakbakFasciaOverhangMin <= d.dakbakFasciaOverhangMax,
    { message: 'Min must be ≤ max', path: ['dakbakFasciaOverhangMin'] },
  );

export type ProductFormValues = z.infer<typeof productFormSchema>;
