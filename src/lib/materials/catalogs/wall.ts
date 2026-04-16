import type { WallCatalogEntry } from '../types';

export const WALL_CATALOG: WallCatalogEntry[] = [
  { atomId: 'wood', pricePerSqm: 45 },
  { atomId: 'brick', pricePerSqm: 65 },
  { atomId: 'render', pricePerSqm: 55 },
  { atomId: 'metal', pricePerSqm: 70 },
  { atomId: 'glass', pricePerSqm: 120, clearsOpenings: true },
];
