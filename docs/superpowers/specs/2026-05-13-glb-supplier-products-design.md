# GLB-backed supplier products — design

## Problem

Today the configurator draws doors, windows, and gates with procedural
three.js geometry. Visual fidelity is limited by what we can model by
hand. Suppliers ship real product geometry as GLB files (e.g. SimLab
exports), but we have no way to bring those into the scene, no way to
let the customer pick the variants the GLB encodes (leaf style, handle
style…), and no way to bind the catalog's materials to specific parts
of the model.

The goal: upload a GLB to a supplier product, tag its node tree once
in admin (variants + material slots), and let the customer configure
the resulting product in the 3D canvas with per-slot material picks
and variant dropdowns. Each pick can carry a flat price delta and
ride into the order snapshot.

## Scope

In scope (V1):

- Doors and windows. Gates have a different geometry model
  (standalone primitive, multi-leaf, motor surcharge) and wait for a
  gate GLB to validate against.
- One GLB per supplier product. No model re-use across SKUs in V1.
- Variant groups = "swap which sibling under a parent node is
  visible". Path-based references.
- Material slots = a curated allow-list of catalog materials bound to
  one-or-more node paths.
- Per-variant-option and per-material-slug flat price deltas (≥ 0).
- Server-side parse with `@gltf-transform/core`. Client-side rendering
  with drei's `useGLTF`.
- Customer picks persist in `ConfigData` (undoable, shareable via
  short code) and freeze into the order snapshot at submit time.

Out of scope (V2+):

- Gates.
- Anchor-based parametric resize (SKU renders at its authored size).
- Auto-suggest variant groups (heuristic from sibling bounding boxes).
- `KHR_materials_variants` glTF extension.
- Shared GLB across multiple SKUs.
- Blob garbage collection on re-upload.
- Drag-and-drop tagging UX.
- `meta.glb.version` stamp — defer until V2 introduces fields that
  can't be safely defaulted.

## Architecture overview

Five pieces, each at a layer that already exists:

```
Admin uploads .glb
  POST /api/admin/uploads/glb            (Vercel Blob, signed)
  POST /api/admin/supplier-products/[pid]/glb   (server parse)
                ↓
supplier_products.meta.glb (jsonb)
  { url, unitScale, naturalSize, hidden[],
    variantGroups[], materialSlots[] }
                ↓
Customer opens /configurator
  DoorMesh branches: has meta.glb → GlbDoorMesh
                     else has supplierProduct → SupplierDoorMesh (today)
                     else → StandardDoorMesh (today)
  Sidebar DoorConfig replaces global Material picker with
    VariantPickers + MaterialSlotPickers when meta.glb is present
                ↓
ConfigData (Zustand + zundo)
  WallConfig.doorGlbVariants?:  Record<groupId, optionId>
  WallConfig.doorGlbMaterials?: Record<slotId, materialSlug>
  WallWindow.glbVariants?  / .glbMaterials?  (per window)
                ↓
Order submit
  buildQuoteSnapshot freezes the full supplier_product row
    (meta.glb travels along)
  buildConfigSnapshot freezes the full ConfigData
    (picks travel along)
```

## Data model

### `GlbBinding` (lives on `meta.glb`)

`@/domain/supplier/types.ts` — added to both `DoorMeta` and
`WindowMeta`:

```ts
glb?: GlbBinding;

type GlbBinding = {
  url: string;                  // Vercel Blob URL
  unitScale: number;            // src→metres; 0.0254 for inches
  naturalSize:
    { widthMm: number; heightMm: number; depthMm: number };
  hidden: string[];             // node paths to omit
  variantGroups: VariantGroup[];
  materialSlots: MaterialSlot[];
};

type VariantGroup = {
  id: string;                   // stable key — "leaf"
  label: string;                // Dutch — "Bladtype"
  parentPath: string;           // "/Binnendeur/.../deurbladen"
  defaultOptionId: string;
  options: VariantOption[];
};

type VariantOption = {
  id: string;                   // "vlakke"
  label: string;                // "Vlakke deur"
  childPath: string;            // child of parentPath to show
  priceDeltaCents: number;      // ≥ 0; codebase convention is cents-everywhere
};

type MaterialSlot = {
  id: string;                   // "frame"
  label: string;                // "Kader"
  nodePaths: string[];          // ≥ 1 entry
  category: MaterialCategory;
  defaultMaterialSlug: string;
  allowedMaterialSlugs: string[]; // ≥ 1 entry; default must be a member
  priceDeltasCents: Record<string, number>; // per-slug, ≥ 0
};
```

Path strings are canonical: ancestor node `name` values joined with
`/`, leading `/`. SimLab GLBs name everything, so this is stable for
the DEUR.glb fixture and for the typical supplier export.

### `ConfigData` additions

`WallConfig` (which holds the door fields as flat properties, not under
a nested `door` object) gains:

```ts
doorGlbVariants?:  Record<string, string>;  // groupId → optionId
doorGlbMaterials?: Record<string, string>;  // slotId  → materialSlug
```

`WallWindow` gains the same pair:

```ts
glbVariants?:  Record<string, string>;
glbMaterials?: Record<string, string>;
```

All optional. Missing fields default to the binding's defaults at
render time. **No `CONFIG_VERSION` bump and no migrator changes
needed** — the existing migrator's pattern is "tolerate missing
fields by leaving them undefined" (see `migrateBuilding` / `migrateRoof`
in `src/domain/config/migrate.ts`), which already handles purely
additive optional fields.

### DB

No schema migration. `supplier_products.meta` is open jsonb; the
TypeScript union widens, and the existing PATCH validator gains a
recursive sub-validator for `meta.glb`.

### Validator error codes

A new umbrella code `glbInvalid` is added to `SUPPLIER_ERROR_CODES`,
following the existing pattern of one top-level code per nested object
(see `segmentsInvalid`, `schuifraamInvalid`). The validator pushes
colon-namespaced sub-paths for specific failures, matching the
`meta_invalid:swingDirection` style:

- `glb_invalid` — shape is not an object
- `glb_invalid:url`
- `glb_invalid:unitScale`
- `glb_invalid:naturalSize`
- `glb_invalid:hidden`
- `glb_invalid:variantGroups[i].id` — missing or duplicate
- `glb_invalid:variantGroups[i].defaultOptionId` — not in options
- `glb_invalid:variantGroups[i].options[j].id` — duplicate within group
- `glb_invalid:variantGroups[i].options[j].priceDeltaCents`
- `glb_invalid:materialSlots[i].id` — missing or duplicate
- `glb_invalid:materialSlots[i].nodePaths` — empty
- `glb_invalid:materialSlots[i].category` — not a `MaterialCategory`
- `glb_invalid:materialSlots[i].allowedMaterialSlugs` — empty
- `glb_invalid:materialSlots[i].defaultMaterialSlug` — not in allowed
- `glb_invalid:materialSlots[i].priceDeltasCents` — bad shape or value

The new `validateGlbBinding(meta.glb)` is exported standalone and
called from both `validateDoorMeta` and `validateWindowMeta` (Create
path) and from `validateSupplierProductPatch` (PATCH path, when
`'glb' in meta`).

## API

### `POST /api/admin/uploads/glb`

Mirrors `/api/admin/uploads/{images,textures,supplier-images}`:

- Vercel Blob `handleUpload` with `onBeforeGenerateToken`
- `ALLOWED_TYPES = ['model/gltf-binary']` plus `.glb` extension
  fallback for browsers that report `application/octet-stream`
- 10 MB cap (DEUR.glb is 160 KB; textured GLBs can be a few MB)
- Path prefix `glb/<tenantId>/`
- No `onUploadCompleted` callback (works on localhost)
- Auth: super_admin any tenant, tenant_admin pinned to own

### `POST /api/admin/supplier-products/[pid]/glb`

Pure parse, no persistence. Body: `{ url: string }`.

Server:
1. Validates URL path begins with `glb/<product.tenantId>/` (or any
   `glb/<id>/` for super_admin) — prevents tenants from parsing
   another tenant's models.
2. `fetch(url)` → `ArrayBuffer`.
3. `new WebIO().readBinary(new Uint8Array(buffer))` → glTF Document.
4. Walks `document.getRoot().listScenes()[0]` into `ParsedNode[]`,
   joining ancestor names with `/`.
5. Heuristically suggests `unitScale`: root node scale ≈ 0.025 or
   bounding-box implies inches → `0.0254`; otherwise `1.0`.
6. Computes overall bounding box at the suggested unitScale →
   `naturalSize` in mm.
7. Returns `{ url, unitScale, naturalSize, tree }`.

`ParsedNode`:

```ts
type ParsedNode = {
  path: string;
  name: string;
  hasMesh: boolean;
  children: ParsedNode[];
};
```

Error codes:
- `invalid_glb` — parse threw
- `empty_scene` — zero scenes or zero nodes
- `blob_fetch_failed` — URL didn't resolve
- `validation_failed` — body shape wrong

Auth: scoped via `requireTenantScope(session, product.tenantId)`.

### `PATCH /api/admin/supplier-products/[pid]`

Existing route. Validator widens to accept `meta.glb`. No new auth
shape.

### Re-upload semantics

A new GLB to an SKU that already has `meta.glb`:

- The parse endpoint is stateless — just returns the new tree.
- The admin form discards existing `variantGroups`, `materialSlots`,
  `hidden` with a confirm dialog. Forced re-tag.
- The old Blob is **not** deleted automatically (V2).

## Admin UI

### Section placement

A collapsible card in `SupplierProductForm.tsx`, between the hero
image upload and the kind-specific section. Renders for
`kind === 'door'` and `kind === 'window'`.

### Layout

Final V1 state (phase 6 adds the preview canvas; phases 1–5 ship the
section without it):

```
┌─ 3D Model ────────────────────────────────────────────────────┐
│ [ Upload .glb ]  DEUR.glb · 160 KB · units: inches (0.0254) ▾ │
│                  Bounding box: 90 × 200 × 5 cm                │
│                                                                │
│ ┌── tree (scroll) ──────────┐ ┌── selected: "deurbladen" ───┐ │
│ │ ▾ Binnendeur               │ │ Path: …/deurbladen         │ │
│ │   ▾ Binnendeur berekeningen│ │ 4 children, no mesh        │ │
│ │     ▸ Kop                  │ │                            │ │
│ │     ▾ deurbladen      ★    │ │ [ Edit group ] [ Untag ]   │ │
│ │       • Vlakke deur   ●    │ │                            │ │
│ │       • Paneel deur        │ │ Untagged actions:          │ │
│ │       • Paneel deur glas   │ │ [ Tag as variant group   ] │ │
│ │       • Deur groefjes      │ │ [ Tag as material slot   ] │ │
│ │     ▸ Deurklink       ★    │ │ [ Always hide            ] │ │
│ │     ▸ Uitsparing  (hidden) │ │                            │ │
│ └───────────────────────────┘ └────────────────────────────┘ │
│                                                                │
│ Variant groups (2):                                            │
│  ▸ Bladtype  · 4 options · default: Vlakke deur   [edit]      │
│  ▸ Klink     · 3 options · default: Vierkant       [edit]     │
│                                                                │
│ Material slots (3):                                            │
│  ▸ Kader   · wall · 3 allowed · default: eik-natuur  [edit]   │
│  ▸ Blad    · wall · 5 allowed · default: —           [edit]   │
│                                                                │
│ ┌── 3D preview (R3F) ──────────────────────────────────────┐  │
│ │ Orbit-able canvas using the same GlbDoorMesh component   │  │
│ │ the configurator uses. Picker dropdowns above the canvas │  │
│ │ let admin sanity-check each combination.                 │  │
│ └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

### Form state

`react-hook-form` schema adds an optional `glb` object matching
`GlbBinding`. Two non-persisted React states:

- `parsedTree: ParsedNode | null` — fetched on upload, re-fetched on
  edit by re-parsing the existing `meta.glb.url`.
- `selectedPath: string | null`.

### Interactions

- **Tag as variant group** opens an inline editor: id (slugified from
  node name), label, reorder options via `dnd-kit`, per-option
  label + `priceDeltaEur` + "set as default" radio. `childPath` is
  fixed structurally.
- **Tag as material slot** opens an inline editor: id, label,
  `category`, `nodePaths` (starts with `[selectedPath]`, admin can
  add siblings via a small node picker), `allowedMaterialSlugs`
  multi-select (shadcn), `defaultMaterialSlug` dropdown constrained
  to the allow-list, and a tiny `priceDeltasEur` table.
- **Always hide** — one-click toggle, greys the node in the tree.
- **Untag** — confirms first.

### Preview

A small R3F canvas mounted at the bottom of the section. Reuses
`GlbDoorMesh` so admin sees exactly what the customer will see. The
section's local state drives picker dropdowns above the canvas.

### Tree-shape drift warning

When the form mounts for an SKU that already has `meta.glb`, the
client calls the parse endpoint with the stored URL. If any
`parentPath` or `nodePaths` no longer resolve in the freshly parsed
tree, the admin sees "tree shape changed since last save" and is
asked to re-tag.

## Configurator render path

### Branching in `DoorMesh.tsx`

```tsx
if (props.supplierProduct?.meta?.glb) return <GlbDoorMesh ... />;
if (props.supplierProduct)            return <SupplierDoorMesh ... />;
return <StandardDoorMesh ... />;
```

Same boundary as today, one new leg. `SupplierDoorMesh` (hero-image
fallback) and `StandardDoorMesh` (procedural fallback) stay as-is.

The window renderer gets the same shape: `GlbWindowMesh` branched at
the same point as the existing window rendering pipeline.

### `GlbDoorMesh` component

`src/components/canvas/GlbDoorMesh.tsx`:

```tsx
function GlbDoorMesh({ supplierProduct, wall, materials, position, rotation }) {
  const binding = supplierProduct.meta.glb;
  const cloned  = useClonedGlbScene(binding.url);

  const variantPicks  = wall.doorGlbVariants  ?? defaultsFor(binding.variantGroups);
  const materialPicks = wall.doorGlbMaterials ?? defaultsFor(binding.materialSlots);

  useEffect(() => {
    applyHidden(cloned, binding.hidden);
    applyVariants(cloned, binding.variantGroups, variantPicks);
    applyMaterials(cloned, binding.materialSlots, materialPicks, materials);
  }, [cloned, binding, variantPicks, materialPicks, materials]);

  return (
    <group position={position} rotation={rotation} scale={binding.unitScale}>
      <primitive object={cloned} />
    </group>
  );
}
```

Three pure helpers in `src/lib/glb/applyBinding.ts`:

- `applyHidden(scene, hiddenPaths)` — sets `visible = false`
- `applyVariants(scene, groups, picks)` — for each group, sets
  `visible = (childPath === picked.childPath)` on each child of
  `parentPath`
- `applyMaterials(scene, slots, picks, materials)` — for each slot,
  finds matching meshes and assigns the slot's resolved
  `MeshStandardMaterial` (constructed via the existing material →
  three.js helper from `@/domain/materials`)

`useClonedGlbScene(url)` wraps `useGLTF(url)` and returns
`useMemo(() => scene.clone(true), [scene])`. Consumers can't get
the shared cached scene by accident — eliminates a class of bugs
where picking variants on door A would mutate door B.

Materials created in `applyMaterials` are tracked and `.dispose()`d
in the cleanup function to avoid GPU leaks on remount.

### Suspense fallback

`<Suspense fallback={<DoorPlaceholder />}>` around the GLB component.
Placeholder is a 1×1×0.05 m box in the wall's material so the scene
doesn't flicker empty during initial fetch.

### Sidebar — `DoorConfig.tsx`

Existing layout stays. Adds a conditional block after the
supplier-product picker:

```tsx
const glb = activeSupplierProduct?.meta?.glb;
if (glb) {
  return (
    <>
      <SupplierProductPicker ... />
      {glb.variantGroups.map(group =>
        <VariantPicker group={group} value={...} onChange={...} />
      )}
      {glb.materialSlots.map(slot =>
        <MaterialSlotPicker slot={slot} value={...} onChange={...} />
      )}
      <DoorSizeToggle ... />
    </>
  );
}
// else: existing layout (global Material + size)
```

Two new components, both shadcn `Select`-based. Options labelled with
name + `(+€X)` when delta > 0.

The window sidebar gets the same treatment.

### Mutations

In `useConfigStore` (delegating to pure functions in
`@/domain/config/mutations.ts`). Signatures follow the existing
`setWallDoorSupplierProduct(state, buildingId, wallSide, ...)` shape:

- `setWallDoorGlbVariant(state, buildingId, wallSide, groupId, optionId)`
- `setWallDoorGlbMaterial(state, buildingId, wallSide, slotId, materialSlug)`
- `setWallWindowGlbVariant(state, buildingId, wallSide, windowId, groupId, optionId)`
- `setWallWindowGlbMaterial(state, buildingId, wallSide, windowId, slotId, materialSlug)`

All undoable through `temporal` middleware. Mutations validate that
`optionId` exists in the group and `materialSlug` exists in the
allow-list; invalid input is silently dropped (matches existing
mutation discipline).

## Pricing

`calculateTotalQuote` per GLB-backed line item:

```
basePriceCents = supplier.priceCents
  + Σ variantGroups: option.priceDeltaCents for the picked option
  + Σ materialSlots: slot.priceDeltasCents[picked slug] ?? 0
```

Defaults are always 0-delta, so picking the cheapest path equals
`priceCents`.

Extra structured line items per non-default pick:

```
{ labelKey: "quote.glbVariant",
  labelParams: { group: "Bladtype", option: "Paneel deur glas" },
  totalCents: 12000 }

{ labelKey: "quote.glbMaterialSlot",
  labelParams: { slot: "Kader", material: "Antraciet RAL7016" },
  totalCents: 5000 }
```

Two new i18n keys (`quote.glbVariant`, `quote.glbMaterialSlot`).
Order PDF renders these without PDF-side changes.

## Order snapshot

`buildQuoteSnapshot` already freezes the full `SupplierProductRow`,
so `meta.glb` travels with the priced quote. `buildConfigSnapshot`
already freezes the full `ConfigData`, so customer picks
(`doorGlbVariants` + `doorGlbMaterials` on walls, and per-window
`glbVariants` + `glbMaterials`) travel with the saved scene.

Years-later replay reads `quoteSnapshot.items[].supplierProduct.meta.glb`
and `configSnapshot.buildings[].walls[*].doorGlbVariants` and renders
deterministically.

## Saved-scene hydration

`GET /api/configs/[code]` does NOT freeze — it re-fetches the current
supplier_product. If the admin re-tagged the GLB after the customer
saved a code, the saved picks might reference variant IDs that no
longer exist. Hydration filters customer picks to currently-existing
IDs and silently falls back to defaults for any mismatch. Rare in
practice; benign in failure mode.

## Implementation phases

Each phase ends with passing tests and a buildable repo.

1. **Domain types + validators.** Add `GlbBinding`, widen `DoorMeta`
   + `WindowMeta`, add validator codes + tests. No UI changes.
2. **Server parse.** Add `@gltf-transform/core` dep. Add
   `POST /api/admin/uploads/glb` + `POST /api/admin/supplier-products/[pid]/glb`.
   Commit `DEUR.glb` as a test fixture. Unit + API tests.
3. **Admin tagging UI.** Add the 3D Model section to
   `SupplierProductForm.tsx`. Tree + actions + editors. No preview
   yet — admin can save tags but only sees them on the configurator.
4. **Configurator render.** Add `useClonedGlbScene`, `applyBinding.ts`
   helpers, `GlbDoorMesh`, `GlbWindowMesh`. Branch in `DoorMesh.tsx`.
   Add new optional fields to `WallConfig` + `WallWindow` (no
   migrator changes needed — optional fields default to undefined).
   Sidebar pickers. Mutations.
5. **Pricing line items.** Wire variant/material deltas into
   `calculateTotalQuote`. Add i18n keys.
6. **Preview canvas in admin form.** Reuse `GlbDoorMesh` inside the
   tagging section. Mounts a stripped-down R3F canvas.

Each phase is a separate PR.

## Testing

Domain (`tests/domain/`):
- Validator: every new error code has a fail test + a happy-path.
- `parseGlb` against `DEUR.glb` fixture — asserts tree shape,
  expected `paumel/Kop/deurbladen/Deurklink` paths, naturalSize,
  unitScale heuristic.
- `applyHidden` / `applyVariants` / `applyMaterials` against a
  stubbed three.js scene built from the parsed tree.
- ConfigData v8→v9 migration round-trip + snapshot.
- `calculateTotalQuote` line items for: default picks (no extra
  lines), one non-default variant, one non-default material, mixed.

API (`tests/api/`):
- `/api/admin/uploads/glb` — happy + cross-tenant 403 + oversized 413.
- `/api/admin/supplier-products/[pid]/glb` — happy + `invalid_glb` +
  `blob_fetch_failed` + cross-tenant 403.
- `PATCH /api/admin/supplier-products/[pid]` — each validator code.

Browser (manual + integration where feasible):
- Tag DEUR.glb end-to-end in admin, save, open configurator, pick
  variants + materials, save scene, re-open via short code.
- Re-upload a different GLB, confirm forced re-tag.

## Risks / open edges

1. **`scene.clone(true)` discipline.** Mitigated by funneling all
   GLB loading through `useClonedGlbScene`.
2. **Material disposal across re-mounts.** Tracked in
   `applyMaterials` cleanup; fixture test mounts/unmounts repeatedly.
3. **Tree-shape drift on re-upload.** Forced re-tag with confirm
   dialog blocks bad state.
4. **Customer holding a saved short code while admin re-tags.**
   Hydration silently falls back to defaults for unknown picks.
5. **Large GLBs (≥ 5 MB) on first load.** `useGLTF` caches per URL;
   amortised across multiple doors of the same SKU. First load is
   the worst case; acceptable.
6. **Server parse cost.** `@gltf-transform/core` parses DEUR.glb
   in ~30 ms in a Node serverless function.

## Migration

- No `CONFIG_VERSION` bump. The new wall/window fields are optional;
  the existing migrator tolerates missing fields by leaving them
  undefined. Renderers fall back to binding defaults when undefined.
- No DB migration. `supplier_products.meta` is open jsonb; the
  TypeScript type union widens and validators widen.
- Existing supplier products with no `meta.glb` continue to render
  via `SupplierDoorMesh` (hero image) or `StandardDoorMesh`
  (procedural) — same behaviour as today.
