'use client';

import { useConfigStore } from '@/store/useConfigStore';
import { FLOOR_MATERIALS } from '@/lib/constants';
import { t } from '@/lib/i18n';
import { Label } from '@/components/ui/label';

export default function FloorConfigSection() {
  const floorMaterialId = useConfigStore((s) => s.config.floor.materialId);
  const updateFloor = useConfigStore((s) => s.updateFloor);

  return (
    <div className="space-y-2">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">
        {t('floor.material')}
      </Label>
      <div className="grid grid-cols-2 gap-2">
        {FLOOR_MATERIALS.map((m) => (
          <button
            key={m.id}
            onClick={() => updateFloor({ materialId: m.id })}
            className={`flex items-center gap-2.5 rounded-md border px-3 py-2.5 text-left text-sm font-medium transition-all ${
              floorMaterialId === m.id
                ? 'border-primary bg-primary/5 ring-1 ring-primary text-primary'
                : 'border-border text-foreground hover:border-primary/40'
            }`}
          >
            {m.id !== 'geen' && (
              <span
                className="inline-block h-5 w-5 shrink-0 rounded border border-border"
                style={{ backgroundColor: m.color }}
              />
            )}
            {m.label}
          </button>
        ))}
      </div>
    </div>
  );
}
