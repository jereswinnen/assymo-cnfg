import type { MaterialAtom, BaseCatalogEntry } from './types';

/** Flat registry of all material primitives used across object catalogs.
 *  Mirrors a future `materials` DB table. Keys are stable slugs. */
export const MATERIALS_REGISTRY = {
  // ── Wall / structural surface atoms ────────────────────────────────
  wood: {
    id: 'wood',
    labelKey: 'material.wood',
    color: '#8B6914',
    textures: {
      color: '/textures/wood_color.jpg',
      normal: '/textures/wood_normal.jpg',
      roughness: '/textures/wood_roughness.jpg',
    },
    tileSize: [1.5, 1.5],
  },
  brick: {
    id: 'brick',
    labelKey: 'material.brick',
    color: '#8B4513',
    textures: {
      color: '/textures/brick_color.jpg',
      normal: '/textures/brick_normal.jpg',
      roughness: '/textures/brick_roughness.jpg',
    },
    tileSize: [3, 2],
  },
  render: {
    id: 'render',
    labelKey: 'material.render',
    color: '#F5F5DC',
    textures: {
      color: '/textures/plaster_color.jpg',
      normal: '/textures/plaster_normal.jpg',
      roughness: '/textures/plaster_roughness.jpg',
    },
    tileSize: [3, 3],
  },
  metal: {
    id: 'metal',
    labelKey: 'material.metal',
    color: '#708090',
    textures: {
      color: '/textures/metal_color.jpg',
      normal: '/textures/metal_normal.jpg',
      roughness: '/textures/metal_roughness.jpg',
    },
    tileSize: [1.5, 2],
  },
  // Rendered via transparent material in canvas; no PBR textures.
  glass: {
    id: 'glass',
    labelKey: 'material.glass',
    color: '#B8D4E3',
  },

  // ── Roof covering atoms ────────────────────────────────────────────
  dakpannen: {
    id: 'dakpannen',
    labelKey: 'material.dakpannen',
    color: '#8B4513',
    textures: {
      color: '/textures/roof_tiles_color.jpg',
      normal: '/textures/roof_tiles_normal.jpg',
      roughness: '/textures/roof_tiles_roughness.jpg',
    },
    tileSize: [2, 2],
  },
  riet: {
    id: 'riet',
    labelKey: 'material.riet',
    color: '#C4A84E',
    textures: {
      color: '/textures/thatch_color.jpg',
      normal: '/textures/thatch_normal.jpg',
      roughness: '/textures/thatch_roughness.jpg',
    },
    tileSize: [3, 3],
  },
  epdm: {
    id: 'epdm',
    labelKey: 'material.epdm',
    color: '#2C2C2C',
  },
  polycarbonaat: {
    id: 'polycarbonaat',
    labelKey: 'material.polycarbonaat',
    color: '#D4E8F0',
  },
  metaal: {
    id: 'metaal',
    labelKey: 'material.metaal',
    color: '#708090',
  },

  // ── Floor atoms ────────────────────────────────────────────────────
  // Sentinel for "no floor"; never rendered (isVoid short-circuits upstream).
  geen: {
    id: 'geen',
    labelKey: 'material.geen',
    color: 'transparent',
  },
  tegels: {
    id: 'tegels',
    labelKey: 'material.tegels',
    color: '#B0A090',
    textures: {
      color: '/textures/floor_tiles_color.jpg',
      normal: '/textures/floor_tiles_normal.jpg',
      roughness: '/textures/floor_tiles_roughness.jpg',
    },
    tileSize: [2, 2],
  },
  beton: {
    id: 'beton',
    labelKey: 'material.beton',
    color: '#A0A0A0',
    textures: {
      color: '/textures/floor_concrete_color.jpg',
      normal: '/textures/floor_concrete_normal.jpg',
      roughness: '/textures/floor_concrete_roughness.jpg',
    },
    tileSize: [3, 3],
  },
  hout: {
    id: 'hout',
    labelKey: 'material.hout',
    color: '#C4A672',
    textures: {
      color: '/textures/floor_wood_color.jpg',
      normal: '/textures/floor_wood_normal.jpg',
      roughness: '/textures/floor_wood_roughness.jpg',
    },
    tileSize: [1.5, 1.5],
  },

  // ── Door atoms ─────────────────────────────────────────────────────
  aluminium: {
    id: 'aluminium',
    labelKey: 'material.aluminium',
    color: '#A8ADB4',
  },
  pvc: {
    id: 'pvc',
    labelKey: 'material.pvc',
    color: '#E8E8E8',
  },
  staal: {
    id: 'staal',
    labelKey: 'material.staal',
    color: '#4A5058',
  },
  // Note: `wood` (above) is reused by doors. No duplicate atom needed.
} as const satisfies Record<string, MaterialAtom>;

/** Literal union of every registered material slug. */
export type MaterialSlug = keyof typeof MATERIALS_REGISTRY;

/** Resolve an atom by slug. Returns null if not registered. Use when slug
 *  comes from an untrusted source (share code decode, DB row, etc.). */
export function getAtom(slug: string): MaterialAtom | null {
  return MATERIALS_REGISTRY[slug as MaterialSlug] ?? null;
}

/** Like getAtom but asserts the atom exists. Use when slug is a compile-time
 *  literal (catalog entries, internal code). */
export function requireAtom(slug: MaterialSlug): MaterialAtom {
  return MATERIALS_REGISTRY[slug];
}

/** Resolve an atom's colour, falling back to a neutral grey if missing. */
export function getAtomColor(slug: string): string {
  return MATERIALS_REGISTRY[slug as MaterialSlug]?.color ?? '#808080';
}

/** Join a catalog entry with its atom. Returns null if atom missing. */
export function resolveEntry<T extends BaseCatalogEntry>(
  entry: T,
): (T & { atom: MaterialAtom }) | null {
  const atom = getAtom(entry.atomId);
  if (!atom) return null;
  return { ...entry, atom };
}

/** Resolve a catalog to [entry + atom] objects, skipping archived atoms. */
export function resolveCatalog<T extends BaseCatalogEntry>(
  catalog: readonly T[],
): Array<T & { atom: MaterialAtom }> {
  const out: Array<T & { atom: MaterialAtom }> = [];
  for (const entry of catalog) {
    const resolved = resolveEntry(entry);
    if (!resolved || resolved.atom.archivedAt) continue;
    out.push(resolved);
  }
  return out;
}

// Validate registry invariants at module-load time in non-production builds.
// Slugs must fit the 15-char limit of share-code v6 encoding (4-bit length
// field), and each atom's `id` must match its registry key.
if (process.env.NODE_ENV !== 'production') {
  for (const key of Object.keys(MATERIALS_REGISTRY) as MaterialSlug[]) {
    const atom = MATERIALS_REGISTRY[key];
    if (key.length > 15) {
      throw new Error(
        `Material slug "${key}" exceeds 15-char share-code encoding limit`,
      );
    }
    if (atom.id !== key) {
      throw new Error(
        `Material atom id "${atom.id}" does not match registry key "${key}"`,
      );
    }
  }
}
