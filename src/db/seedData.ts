import type { MaterialCategory } from '@/domain/catalog';
import type { MaterialPricing, MaterialFlags, MaterialTextures } from '@/domain/catalog';

/** Static input for the seed. Every row here becomes a `materials` row
 *  for the Assymo tenant on first seed. Do NOT import from
 *  `@/domain/materials/atoms` or `catalogs/` — those files are deleted
 *  in Wave 7. Content here is a verbatim snapshot. */

export interface SeedMaterialInput {
  category: MaterialCategory;
  slug: string;
  name: string;
  color: string;
  /** Paths to files under `public/textures/` — seed uploads them to Blob
   *  and writes the Blob URLs onto the row. */
  texturePaths?: { color: string; normal: string; roughness: string };
  tileSize?: [number, number];
  pricing: MaterialPricing;
  flags?: MaterialFlags;
}

export const ASSYMO_SEED_MATERIALS: SeedMaterialInput[] = [
  // ── Wall entries (WALL_CATALOG × MATERIALS_REGISTRY) ──────────────────

  {
    category: 'wall',
    slug: 'wood',
    name: 'Hout',
    color: '#8B6914',
    texturePaths: {
      color: 'public/textures/wood_color.jpg',
      normal: 'public/textures/wood_normal.jpg',
      roughness: 'public/textures/wood_roughness.jpg',
    },
    tileSize: [1.5, 1.5],
    pricing: { perSqm: 45 },
  },
  {
    category: 'wall',
    slug: 'brick',
    name: 'Steen',
    color: '#8B4513',
    texturePaths: {
      color: 'public/textures/brick_color.jpg',
      normal: 'public/textures/brick_normal.jpg',
      roughness: 'public/textures/brick_roughness.jpg',
    },
    tileSize: [3, 2],
    pricing: { perSqm: 65 },
  },
  {
    category: 'wall',
    slug: 'render',
    name: 'Stucwerk',
    color: '#F5F5DC',
    texturePaths: {
      color: 'public/textures/plaster_color.jpg',
      normal: 'public/textures/plaster_normal.jpg',
      roughness: 'public/textures/plaster_roughness.jpg',
    },
    tileSize: [3, 3],
    pricing: { perSqm: 55 },
  },
  {
    category: 'wall',
    slug: 'metal',
    name: 'Metaal',
    color: '#708090',
    texturePaths: {
      color: 'public/textures/metal_color.jpg',
      normal: 'public/textures/metal_normal.jpg',
      roughness: 'public/textures/metal_roughness.jpg',
    },
    tileSize: [1.5, 2],
    pricing: { perSqm: 70 },
  },
  {
    category: 'wall',
    slug: 'glass',
    name: 'Glas',
    color: '#B8D4E3',
    pricing: { perSqm: 120 },
    flags: { clearsOpenings: true },
  },
  {
    category: 'wall',
    slug: 'vurenvert',
    name: 'Vuren planchetten (V)',
    color: '#D9B77E',
    texturePaths: {
      color: 'public/textures/vurenplanchettenvertical_basecolor.png',
      normal: 'public/textures/vurenplanchettenvertical_normal.png',
      roughness: 'public/textures/vurenplanchettenvertical_roughness.png',
    },
    tileSize: [1.5, 2],
    pricing: { perSqm: 50 },
  },
  {
    category: 'wall',
    slug: 'bevelhorz',
    name: 'Bevel siding (H)',
    color: '#9B8970',
    texturePaths: {
      color: 'public/textures/bevelsidinghorizontal_basecolor.png',
      normal: 'public/textures/bevelsidinghorizontal_normal.png',
      roughness: 'public/textures/bevelsidinghorizontal_roughness.png',
    },
    tileSize: [1.5, 2],
    pricing: { perSqm: 50 },
  },
  {
    category: 'wall',
    slug: 'zwartsmal',
    name: 'Zwart smal (V)',
    color: '#1E1E1E',
    texturePaths: {
      color: 'public/textures/zwartsmalvertical_basecolor.png',
      normal: 'public/textures/zwartsmalvertical_normal.png',
      roughness: 'public/textures/zwartsmalvertical_roughness.png',
    },
    tileSize: [1.5, 2],
    pricing: { perSqm: 50 },
  },
  {
    category: 'wall',
    slug: 'bruinvert',
    name: 'Bruin (V)',
    color: '#3C2817',
    texturePaths: {
      color: 'public/textures/bruinvertical_basecolor.png',
      normal: 'public/textures/bruinvertical_normal.png',
      roughness: 'public/textures/bruinvertical_roughness.png',
    },
    tileSize: [1.5, 2],
    pricing: { perSqm: 50 },
  },
  {
    category: 'wall',
    slug: 'zwartvuren',
    name: 'Zwart vuren (V)',
    color: '#1A1A1A',
    texturePaths: {
      color: 'public/textures/zwartvurenvertical_basecolor.png',
      normal: 'public/textures/zwartvurenvertical_normal.png',
      roughness: 'public/textures/zwartvurenvertical_roughness.png',
    },
    tileSize: [1.5, 2],
    pricing: { perSqm: 50 },
  },
  {
    category: 'wall',
    slug: 'planchhorz',
    name: 'Planchet (H)',
    color: '#C9A876',
    texturePaths: {
      color: 'public/textures/planchethorizontal_basecolor.png',
      normal: 'public/textures/planchethorizontal_normal.png',
      roughness: 'public/textures/planchethorizontal_roughness.png',
    },
    tileSize: [1.5, 2],
    pricing: { perSqm: 50 },
  },
  {
    category: 'wall',
    slug: 'naaldhout3',
    name: 'Naaldhout 3-var',
    color: '#B89572',
    texturePaths: {
      color: 'public/textures/naaldhout3varvertical_basecolor.png',
      normal: 'public/textures/naaldhout3varvertical_normal.png',
      roughness: 'public/textures/naaldhout3varvertical_roughness.png',
    },
    tileSize: [1.5, 2],
    pricing: { perSqm: 50 },
  },

  // ── Roof-cover entries (ROOF_COVERING_CATALOG × MATERIALS_REGISTRY) ───

  {
    category: 'roof-cover',
    slug: 'dakpannen',
    name: 'Dakpannen',
    color: '#8B4513',
    texturePaths: {
      color: 'public/textures/roof_tiles_color.jpg',
      normal: 'public/textures/roof_tiles_normal.jpg',
      roughness: 'public/textures/roof_tiles_roughness.jpg',
    },
    tileSize: [2, 2],
    pricing: { perSqm: 55 },
  },
  {
    category: 'roof-cover',
    slug: 'riet',
    name: 'Riet',
    color: '#C4A84E',
    texturePaths: {
      color: 'public/textures/thatch_color.jpg',
      normal: 'public/textures/thatch_normal.jpg',
      roughness: 'public/textures/thatch_roughness.jpg',
    },
    tileSize: [3, 3],
    pricing: { perSqm: 85 },
  },
  {
    category: 'roof-cover',
    slug: 'epdm',
    name: 'EPDM',
    color: '#2C2C2C',
    pricing: { perSqm: 35 },
  },
  {
    category: 'roof-cover',
    slug: 'polycarbonaat',
    name: 'Polycarbonaat',
    color: '#D4E8F0',
    pricing: { perSqm: 40 },
  },
  {
    category: 'roof-cover',
    slug: 'metaal',
    name: 'Staalplaten',
    color: '#708090',
    pricing: { perSqm: 50 },
  },

  // ── Roof-trim entries (ROOF_TRIM_CATALOG × MATERIALS_REGISTRY) ─────────
  // No pricing for trim materials.

  {
    category: 'roof-trim',
    slug: 'wood',
    name: 'Hout',
    color: '#8B6914',
    texturePaths: {
      color: 'public/textures/wood_color.jpg',
      normal: 'public/textures/wood_normal.jpg',
      roughness: 'public/textures/wood_roughness.jpg',
    },
    tileSize: [1.5, 1.5],
    pricing: {},
  },
  {
    category: 'roof-trim',
    slug: 'brick',
    name: 'Steen',
    color: '#8B4513',
    texturePaths: {
      color: 'public/textures/brick_color.jpg',
      normal: 'public/textures/brick_normal.jpg',
      roughness: 'public/textures/brick_roughness.jpg',
    },
    tileSize: [3, 2],
    pricing: {},
  },
  {
    category: 'roof-trim',
    slug: 'render',
    name: 'Stucwerk',
    color: '#F5F5DC',
    texturePaths: {
      color: 'public/textures/plaster_color.jpg',
      normal: 'public/textures/plaster_normal.jpg',
      roughness: 'public/textures/plaster_roughness.jpg',
    },
    tileSize: [3, 3],
    pricing: {},
  },
  {
    category: 'roof-trim',
    slug: 'metal',
    name: 'Metaal',
    color: '#708090',
    texturePaths: {
      color: 'public/textures/metal_color.jpg',
      normal: 'public/textures/metal_normal.jpg',
      roughness: 'public/textures/metal_roughness.jpg',
    },
    tileSize: [1.5, 2],
    pricing: {},
  },
  {
    category: 'roof-trim',
    slug: 'glass',
    name: 'Glas',
    color: '#B8D4E3',
    pricing: {},
  },
  {
    category: 'roof-trim',
    slug: 'vurenvert',
    name: 'Vuren planchetten (V)',
    color: '#D9B77E',
    texturePaths: {
      color: 'public/textures/vurenplanchettenvertical_basecolor.png',
      normal: 'public/textures/vurenplanchettenvertical_normal.png',
      roughness: 'public/textures/vurenplanchettenvertical_roughness.png',
    },
    tileSize: [1.5, 2],
    pricing: {},
  },
  {
    category: 'roof-trim',
    slug: 'bevelhorz',
    name: 'Bevel siding (H)',
    color: '#9B8970',
    texturePaths: {
      color: 'public/textures/bevelsidinghorizontal_basecolor.png',
      normal: 'public/textures/bevelsidinghorizontal_normal.png',
      roughness: 'public/textures/bevelsidinghorizontal_roughness.png',
    },
    tileSize: [1.5, 2],
    pricing: {},
  },
  {
    category: 'roof-trim',
    slug: 'zwartsmal',
    name: 'Zwart smal (V)',
    color: '#1E1E1E',
    texturePaths: {
      color: 'public/textures/zwartsmalvertical_basecolor.png',
      normal: 'public/textures/zwartsmalvertical_normal.png',
      roughness: 'public/textures/zwartsmalvertical_roughness.png',
    },
    tileSize: [1.5, 2],
    pricing: {},
  },
  {
    category: 'roof-trim',
    slug: 'bruinvert',
    name: 'Bruin (V)',
    color: '#3C2817',
    texturePaths: {
      color: 'public/textures/bruinvertical_basecolor.png',
      normal: 'public/textures/bruinvertical_normal.png',
      roughness: 'public/textures/bruinvertical_roughness.png',
    },
    tileSize: [1.5, 2],
    pricing: {},
  },
  {
    category: 'roof-trim',
    slug: 'zwartvuren',
    name: 'Zwart vuren (V)',
    color: '#1A1A1A',
    texturePaths: {
      color: 'public/textures/zwartvurenvertical_basecolor.png',
      normal: 'public/textures/zwartvurenvertical_normal.png',
      roughness: 'public/textures/zwartvurenvertical_roughness.png',
    },
    tileSize: [1.5, 2],
    pricing: {},
  },
  {
    category: 'roof-trim',
    slug: 'planchhorz',
    name: 'Planchet (H)',
    color: '#C9A876',
    texturePaths: {
      color: 'public/textures/planchethorizontal_basecolor.png',
      normal: 'public/textures/planchethorizontal_normal.png',
      roughness: 'public/textures/planchethorizontal_roughness.png',
    },
    tileSize: [1.5, 2],
    pricing: {},
  },
  {
    category: 'roof-trim',
    slug: 'naaldhout3',
    name: 'Naaldhout 3-var',
    color: '#B89572',
    texturePaths: {
      color: 'public/textures/naaldhout3varvertical_basecolor.png',
      normal: 'public/textures/naaldhout3varvertical_normal.png',
      roughness: 'public/textures/naaldhout3varvertical_roughness.png',
    },
    tileSize: [1.5, 2],
    pricing: {},
  },

  // ── Floor entries (FLOOR_CATALOG × MATERIALS_REGISTRY) ────────────────

  {
    category: 'floor',
    slug: 'geen',
    name: 'Geen',
    color: 'transparent',
    pricing: { perSqm: 0 },
    flags: { isVoid: true },
  },
  {
    category: 'floor',
    slug: 'tegels',
    name: 'Tegels',
    color: '#B0A090',
    texturePaths: {
      color: 'public/textures/floor_tiles_color.jpg',
      normal: 'public/textures/floor_tiles_normal.jpg',
      roughness: 'public/textures/floor_tiles_roughness.jpg',
    },
    tileSize: [2, 2],
    pricing: { perSqm: 35 },
  },
  {
    category: 'floor',
    slug: 'beton',
    name: 'Beton',
    color: '#A0A0A0',
    texturePaths: {
      color: 'public/textures/floor_concrete_color.jpg',
      normal: 'public/textures/floor_concrete_normal.jpg',
      roughness: 'public/textures/floor_concrete_roughness.jpg',
    },
    tileSize: [3, 3],
    pricing: { perSqm: 25 },
  },
  {
    category: 'floor',
    slug: 'hout',
    name: 'Hout (vlonders)',
    color: '#C4A672',
    texturePaths: {
      color: 'public/textures/floor_wood_color.jpg',
      normal: 'public/textures/floor_wood_normal.jpg',
      roughness: 'public/textures/floor_wood_roughness.jpg',
    },
    tileSize: [1.5, 1.5],
    pricing: { perSqm: 55 },
  },

  // ── Door entries (DOOR_CATALOG × MATERIALS_REGISTRY) ──────────────────
  // Doors: surcharge only, no textures or tileSize (doors are rendered as
  // solid-colour mesh with trim; per-material PBR is not applied).

  {
    category: 'door',
    slug: 'wood',
    name: 'Hout',
    color: '#8B6914',
    pricing: { surcharge: 0 },
  },
  {
    category: 'door',
    slug: 'aluminium',
    name: 'Aluminium',
    color: '#A8ADB4',
    pricing: { surcharge: 150 },
  },
  {
    category: 'door',
    slug: 'pvc',
    name: 'PVC',
    color: '#E8E8E8',
    pricing: { surcharge: 0 },
  },
  {
    category: 'door',
    slug: 'staal',
    name: 'Staal',
    color: '#4A5058',
    pricing: { surcharge: 250 },
  },
  {
    category: 'door',
    slug: 'vurenvert',
    name: 'Vuren planchetten (V)',
    color: '#D9B77E',
    pricing: { surcharge: 0 },
  },
  {
    category: 'door',
    slug: 'bevelhorz',
    name: 'Bevel siding (H)',
    color: '#9B8970',
    pricing: { surcharge: 0 },
  },
  {
    category: 'door',
    slug: 'zwartsmal',
    name: 'Zwart smal (V)',
    color: '#1E1E1E',
    pricing: { surcharge: 0 },
  },
  {
    category: 'door',
    slug: 'bruinvert',
    name: 'Bruin (V)',
    color: '#3C2817',
    pricing: { surcharge: 0 },
  },
  {
    category: 'door',
    slug: 'zwartvuren',
    name: 'Zwart vuren (V)',
    color: '#1A1A1A',
    pricing: { surcharge: 0 },
  },
  {
    category: 'door',
    slug: 'planchhorz',
    name: 'Planchet (H)',
    color: '#C9A876',
    pricing: { surcharge: 0 },
  },
  {
    category: 'door',
    slug: 'naaldhout3',
    name: 'Naaldhout 3-var',
    color: '#B89572',
    pricing: { surcharge: 0 },
  },
];
