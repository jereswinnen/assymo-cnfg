'use client';
import { useRef, useState } from 'react';
import { upload } from '@vercel/blob/client';
import { Button } from '@/components/ui/button';
import { t } from '@/lib/i18n';

interface Props {
  label: string;
  value: string | null;
  onChange: (url: string | null) => void;
  tenantId: string;
  slug: string;
  /** Override the upload endpoint. Defaults to /api/admin/uploads/images. */
  uploadUrl?: string;
  /** Blob path prefix. Must match what the server-side signed-token
   *  endpoint expects (e.g. 'images', 'supplier'). Defaults to 'images'. */
  pathPrefix?: string;
  /** Preview fit mode. 'cover' (default) zooms to fill — right for
   *  product/hero photography. 'contain' fits inside without cropping
   *  — right for logos with transparent padding. */
  previewFit?: 'cover' | 'contain';
}

/** Single-image upload control for product hero images. Direct-to-Blob
 *  via the signed-token endpoint at /api/admin/uploads/images (or the
 *  provided uploadUrl). */
export function HeroImageUploadField({
  label,
  value,
  onChange,
  tenantId,
  slug,
  uploadUrl = '/api/admin/uploads/images',
  pathPrefix = 'images',
  previewFit = 'cover',
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setBusy(true);
    setError(null);
    try {
      const ext = file.name.split('.').pop() ?? 'bin';
      const blob = await upload(
        `${pathPrefix}/${tenantId}/${slug}-hero-${Date.now()}.${ext}`,
        file,
        { access: 'public', handleUploadUrl: uploadUrl },
      );
      onChange(blob.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'upload_failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">{label}</label>
      <div className="flex items-center gap-3">
        {value ? (
          <img
            src={value}
            alt=""
            className={`h-24 w-24 rounded-md border ${previewFit === 'contain' ? 'object-contain p-1 bg-muted/30' : 'object-cover'}`}
          />
        ) : (
          <div className="h-24 w-24 rounded-md border border-dashed" />
        )}
        <div className="flex flex-col gap-1">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/svg+xml"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy
              ? '…'
              : value
                ? t('admin.catalog.uploads.replace')
                : t('admin.catalog.uploads.upload')}
          </Button>
          {value && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
              {t('admin.catalog.uploads.remove')}
            </Button>
          )}
        </div>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
