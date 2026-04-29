import { describe, it, expect } from 'vite-plus/test';
import { getEntityMaterial } from '@/domain/building';
import { makeBuilding } from './fixtures';

describe('getEntityMaterial', () => {
  it('reads primaryMaterialId for building-bound kinds', () => {
    const b = makeBuilding({
      id: 'b1',
      type: 'overkapping',
      primaryMaterialId: 'wood',
    });
    expect(getEntityMaterial(b)).toBe('wood');
  });

  it('reads gateConfig.materialId for poort', () => {
    const b = makeBuilding({
      id: 'g1',
      type: 'poort',
      gateConfig: {
        partCount: 1,
        materialId: 'staal-antraciet',
        swingDirection: 'inward',
        motorized: false,
      },
    });
    expect(getEntityMaterial(b)).toBe('staal-antraciet');
  });

  it('returns empty string when the entity has no material yet (poort fresh spawn)', () => {
    const b = makeBuilding({
      id: 'g1',
      type: 'poort',
      gateConfig: {
        partCount: 1,
        materialId: '',
        swingDirection: 'inward',
        motorized: false,
      },
    });
    expect(getEntityMaterial(b)).toBe('');
  });

  it('returns empty string when a building-bound kind has no primary material yet', () => {
    const b = makeBuilding({ id: 'p1', type: 'paal', primaryMaterialId: '' });
    expect(getEntityMaterial(b)).toBe('');
  });
});
