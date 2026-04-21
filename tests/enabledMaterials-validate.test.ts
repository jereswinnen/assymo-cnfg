import { describe, it, expect } from 'vite-plus/test';
import { validateEnabledMaterialsPatch } from '@/domain/tenant';

describe('validateEnabledMaterialsPatch', () => {
  it('accepts { enabledMaterials: null } (unrestricted)', () => {
    const { enabledMaterials, errors } = validateEnabledMaterialsPatch({
      enabledMaterials: null,
    });
    expect(errors).toEqual([]);
    expect(enabledMaterials).toBeNull();
  });

  it('accepts { enabledMaterials: [] } (explicitly nothing)', () => {
    const { enabledMaterials, errors } = validateEnabledMaterialsPatch({
      enabledMaterials: [],
    });
    expect(errors).toEqual([]);
    expect(enabledMaterials).toEqual([]);
  });

  it('accepts a populated string array', () => {
    const { enabledMaterials, errors } = validateEnabledMaterialsPatch({
      enabledMaterials: ['wood', 'brick', 'metal'],
    });
    expect(errors).toEqual([]);
    expect(enabledMaterials).toEqual(['wood', 'brick', 'metal']);
  });

  it('deduplicates repeated slugs', () => {
    const { enabledMaterials, errors } = validateEnabledMaterialsPatch({
      enabledMaterials: ['wood', 'wood', 'brick'],
    });
    expect(errors).toEqual([]);
    expect(enabledMaterials).toEqual(['wood', 'brick']);
  });

  it('rejects a non-object body', () => {
    const { errors } = validateEnabledMaterialsPatch(null);
    expect(errors).toContain('body');
  });

  it('rejects a missing enabledMaterials key (empty patch)', () => {
    const { errors } = validateEnabledMaterialsPatch({});
    expect(errors).toContain('enabledMaterials');
  });

  it('rejects a non-array, non-null value', () => {
    const { errors } = validateEnabledMaterialsPatch({ enabledMaterials: 'wood' });
    expect(errors).toContain('enabledMaterials');
  });

  it('rejects an array containing a non-string', () => {
    const { errors } = validateEnabledMaterialsPatch({
      enabledMaterials: ['wood', 42],
    });
    expect(errors).toContain('enabledMaterials[1]');
  });

  it('rejects an array containing an unknown slug', () => {
    const { errors } = validateEnabledMaterialsPatch({
      enabledMaterials: ['wood', 'unobtainium'],
    });
    expect(errors).toContain('enabledMaterials[1]');
  });

  it('rejects an empty string slug', () => {
    const { errors } = validateEnabledMaterialsPatch({
      enabledMaterials: [''],
    });
    expect(errors).toContain('enabledMaterials[0]');
  });
});
