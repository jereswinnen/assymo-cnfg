import type { WallCatalogEntry } from '../types';

export const WALL_CATALOG: WallCatalogEntry[] = [
  { atomId: 'wood', pricePerSqm: 45 },
  { atomId: 'brick', pricePerSqm: 65 },
  { atomId: 'render', pricePerSqm: 55 },
  { atomId: 'metal', pricePerSqm: 70 },
  { atomId: 'glass', pricePerSqm: 120, clearsOpenings: true },
  // Wall cladding variants — placeholder pricing, tweak when confirmed.
  { atomId: 'vurenvert', pricePerSqm: 50 },
  { atomId: 'bevelhorz', pricePerSqm: 50 },
  { atomId: 'zwartsmal', pricePerSqm: 50 },
  { atomId: 'bruinvert', pricePerSqm: 50 },
  { atomId: 'zwartvuren', pricePerSqm: 50 },
  { atomId: 'planchhorz', pricePerSqm: 50 },
  { atomId: 'naaldhout3', pricePerSqm: 50 },
];
