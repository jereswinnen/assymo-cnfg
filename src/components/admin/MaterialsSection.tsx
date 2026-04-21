'use client';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ALWAYS_ENABLED_SLUGS, type BaseCatalogEntry } from '@/domain/materials';
import { MATERIALS_REGISTRY } from '@/domain/materials/atoms';
import { WALL_CATALOG } from '@/domain/materials/catalogs/wall';
import { ROOF_TRIM_CATALOG } from '@/domain/materials/catalogs/roof-trim';
import { ROOF_COVERING_CATALOG } from '@/domain/materials/catalogs/roof-cover';
import { FLOOR_CATALOG } from '@/domain/materials/catalogs/floor';
import { DOOR_CATALOG } from '@/domain/materials/catalogs/door';
import { t } from '@/lib/i18n';

interface Props {
  tenantId: string;
  initialEnabledMaterials: string[] | null;
}

interface Group {
  id: 'wall' | 'roofCover' | 'roofTrim' | 'floor' | 'door';
  labelKey: string;
  catalog: readonly BaseCatalogEntry[];
}

const GROUPS: Group[] = [
  { id: 'wall', labelKey: 'admin.registry.group.wall', catalog: WALL_CATALOG },
  { id: 'roofCover', labelKey: 'admin.registry.group.roofCover', catalog: ROOF_COVERING_CATALOG },
  { id: 'roofTrim', labelKey: 'admin.registry.group.roofTrim', catalog: ROOF_TRIM_CATALOG },
  { id: 'floor', labelKey: 'admin.registry.group.floor', catalog: FLOOR_CATALOG },
  { id: 'door', labelKey: 'admin.registry.group.door', catalog: DOOR_CATALOG },
];

/** Count how many catalogs each slug appears in — used to render a
 *  hint when the admin toggles a slug that affects multiple pickers. */
function buildSlugCatalogCount(): Map<string, number> {
  const m = new Map<string, number>();
  for (const g of GROUPS) {
    for (const entry of g.catalog) {
      m.set(entry.atomId, (m.get(entry.atomId) ?? 0) + 1);
    }
  }
  return m;
}

const slugCatalogCount = buildSlugCatalogCount();
const sentinelSlugs = new Set<string>(ALWAYS_ENABLED_SLUGS);

export function MaterialsSection({ tenantId, initialEnabledMaterials }: Props) {
  const [unrestricted, setUnrestricted] = useState(initialEnabledMaterials === null);
  // When `unrestricted`, the set is a ghost copy: we keep whatever the
  // admin had selected so flipping the switch back restores it. When
  // `null` initially, we seed with "everything currently in catalogs".
  const [enabledSet, setEnabledSet] = useState<Set<string>>(() => {
    if (initialEnabledMaterials === null) {
      return new Set(Object.keys(MATERIALS_REGISTRY));
    }
    return new Set(initialEnabledMaterials);
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function toggle(slug: string, checked: boolean) {
    setEnabledSet((prev) => {
      const next = new Set(prev);
      if (checked) next.add(slug);
      else next.delete(slug);
      return next;
    });
  }

  async function save() {
    setBusy(true);
    setMsg(null);
    const body = {
      enabledMaterials: unrestricted ? null : Array.from(enabledSet).sort(),
    };
    const res = await fetch(
      `/api/admin/tenants/${tenantId}/enabled-materials`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    );
    setBusy(false);
    if (res.ok) setMsg(t('admin.tenant.saved'));
    else {
      const data = await res.json().catch(() => ({}));
      setMsg(t('admin.tenant.saveError', { error: data.error ?? res.status }));
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('admin.tenant.section.materials')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-start gap-3 rounded-lg border border-border p-3">
          <Switch
            id="unrestricted"
            checked={unrestricted}
            onCheckedChange={(v) => setUnrestricted(!!v)}
          />
          <div className="space-y-1">
            <Label htmlFor="unrestricted" className="cursor-pointer font-medium">
              {t('admin.registry.unrestricted.label')}
            </Label>
            <p className="text-xs text-muted-foreground">
              {t('admin.registry.unrestricted.help')}
            </p>
          </div>
        </div>

        <div className={`space-y-6 ${unrestricted ? 'opacity-50 pointer-events-none' : ''}`}>
          {GROUPS.map((group) => (
            <div key={group.id} className="space-y-2">
              <h3 className="text-sm font-semibold">{t(group.labelKey)}</h3>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {group.catalog.map((entry) => {
                  const slug = entry.atomId;
                  const atom = MATERIALS_REGISTRY[slug as keyof typeof MATERIALS_REGISTRY];
                  const checked = sentinelSlugs.has(slug) || enabledSet.has(slug);
                  const shared = (slugCatalogCount.get(slug) ?? 0) > 1;
                  const locked = sentinelSlugs.has(slug);
                  return (
                    <li
                      key={`${group.id}:${slug}`}
                      className="flex items-start gap-2 rounded-md border border-border/60 px-3 py-2"
                    >
                      <Checkbox
                        id={`mat-${group.id}-${slug}`}
                        checked={checked}
                        disabled={locked}
                        onCheckedChange={(v) => toggle(slug, !!v)}
                      />
                      <div className="flex-1 min-w-0">
                        <Label
                          htmlFor={`mat-${group.id}-${slug}`}
                          className="cursor-pointer text-sm"
                        >
                          <span
                            className="inline-block h-3 w-3 rounded-sm border border-border/50 align-middle mr-2"
                            style={{ backgroundColor: atom?.color ?? '#ccc' }}
                            aria-hidden
                          />
                          {t(atom?.labelKey ?? slug)}
                        </Label>
                        {shared && (
                          <p className="text-[11px] text-muted-foreground leading-tight">
                            {t('admin.registry.sharedSlugHint')}
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3 pt-2">
          <Button onClick={save} disabled={busy}>
            {t('admin.tenant.save')}
          </Button>
          {msg && <span className="text-sm text-neutral-600">{msg}</span>}
        </div>
      </CardContent>
    </Card>
  );
}
