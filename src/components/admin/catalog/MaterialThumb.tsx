import type { MaterialRow } from '@/domain/catalog';

/** 32×32 swatch shown in the admin material list. Uses the material's
 *  color field as background; overlays the color-texture image when
 *  present. Purely cosmetic — not interactive. */
export function MaterialThumb({ material }: { material: MaterialRow }) {
  return (
    <span
      aria-hidden
      className="inline-block h-8 w-8 rounded-md border border-border bg-center bg-cover"
      style={{
        backgroundColor: material.color,
        backgroundImage: material.textures?.color ? `url(${material.textures.color})` : undefined,
      }}
    />
  );
}
