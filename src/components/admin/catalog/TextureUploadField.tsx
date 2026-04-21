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
  slot: 'color' | 'normal' | 'roughness';
}

/** Single-slot PBR upload control. Uploads direct to Vercel Blob via
 *  `/api/admin/uploads/textures` signed-token endpoint, stores the
 *  returned URL in form state. Persisted to the material row when
 *  the enclosing form submits. */
export function TextureUploadField({ label, value, onChange, tenantId, slug, slot }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setBusy(true);
    setError(null);
    try {
      const ext = file.name.split('.').pop() ?? 'bin';
      const blob = await upload(
        `textures/${tenantId}/${slug}-${slot}-${Date.now()}.${ext}`,
        file,
        { access: 'public', handleUploadUrl: '/api/admin/uploads/textures' },
      );
      onChange(blob.url);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'upload_failed';
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">{label}</label>
      <div className="flex items-center gap-3">
        {value ? (
          <img src={value} alt="" className="h-16 w-16 rounded-md border object-cover" />
        ) : (
          <div className="h-16 w-16 rounded-md border border-dashed" />
        )}
        <div className="flex flex-col gap-1">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
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
            {busy ? '…' : value ? 'Vervangen' : 'Uploaden'}
          </Button>
          {value && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange(null)}
            >
              Verwijderen
            </Button>
          )}
        </div>
      </div>
      {error && (
        <p className="text-xs text-destructive">
          {t(
            `admin.catalog.materials.error.upload.${
              error === 'too_large' ? 'too_large' : 'type_rejected'
            }`,
          )}
        </p>
      )}
    </div>
  );
}
