# Visual Quality Upgrade — Approach A: Lighting & Atmosphere

**Date:** 2026-03-24
**Goal:** Transform the 3D building configurator from a blocky "Minecraft" aesthetic to a professional, realistic outdoor scene — without changing geometry.

## Context

The configurator currently uses flat ambient lighting, hard black edge lines on walls, a floating 25×25 ground block, and no post-processing. These combine to produce a game-engine look rather than a professional configurator. The target is a realistic outdoor scene feel that runs well on both desktop and mobile browsers.

## New Dependencies

- `@react-three/postprocessing` — post-processing effects (SSAO, bloom)
- `postprocessing` — peer dependency
- `detect-gpu` — GPU tier detection for adaptive quality

All other components (`Environment`, `ContactShadows`, `SoftShadows`) are already available in `@react-three/drei`.

## Design

### 1. HDRI Environment Lighting

Replace `ambientLight` with Drei's `<Environment>` using an outdoor HDRI.

- Use Drei's `<Environment preset="park">` or similar built-in preset (loads from CDN, no bundled file). If a specific HDRI is preferred later, download a `.hdr` file from Poly Haven into `/public/textures/` and use `files` prop instead.
- Set `background={false}` — the existing `SkyGradient` shader stays as the visible sky
- The HDRI contributes lighting and reflections only
- The `SkyGradient` component already sets `depthWrite: false` and `BackSide`, so it will not interfere with the HDRI environment or post-processing pipeline. Verify this does not regress during implementation.
- Remove the secondary fill `directionalLight` at `[-5, 5, -5]` — the HDRI handles ambient fill
- Reduce primary `directionalLight` intensity from 1.2 to ~0.8 since the HDRI provides ambient

### 2. Post-Processing Pipeline

Add `EffectComposer` from `@react-three/postprocessing` with:

1. **SSAO** — darkens corners, crevices, and surface intersections. Low radius (~0.05), moderate intensity (~1.5), half-resolution for performance. This kills the flat look where walls meet floors, roof edges, door frames.

2. **Tone Mapping** — `ACESFilmicToneMapping` set at the renderer level via Canvas `gl` prop object: `gl={{ toneMapping: ACESFilmicToneMapping, toneMappingExposure: 1.0 }}`. Compresses HDR into cinematic color response — natural white rolloff, deeper darks.

3. **Bloom** — very low intensity (~0.15), high threshold (~0.9). Only triggers on glass and bright HDRI highlights. Gives glass a subtle "catching sunlight" glow.

**Mobile adaptive quality:** Use `detect-gpu` library to determine GPU tier outside the Canvas. Store tier in zustand and pass to scene components. Desktop gets full SSAO + bloom. Mobile skips post-processing entirely, relying on HDRI + contact shadows for the uplift.

### 3. Remove Hard Edge Lines

Delete all `<Edges>` components from `Wall.tsx`. These black wireframe outlines are the single biggest "game engine" tell. Selection feedback continues to work through emissive glow (already implemented).

Also remove `polygonOffset`, `polygonOffsetFactor`, and `polygonOffsetUnits` from the wall material — these exist solely to prevent z-fighting with the `<Edges>` overlay and could cause subtle depth-buffer artifacts with SSAO.

With HDRI and SSAO in place, adjacent walls of the same color are naturally distinguished by ambient occlusion in the corner seams and different lighting angles.

### 4. Ground Plane Overhaul

Replace the 25×25 `RoundedBox` earth block with:

1. **Large ground plane** — 200×200 flat mesh at y=-0.001 (slight offset below Floor at y=0.01 to avoid z-fighting) with the existing grass PBR textures (color + normal + roughness). UV repeat scaled up proportionally. Color-matched to the sky gradient's horizon so the seam at the edges disappears. `receiveShadow` enabled.

2. **Contact shadows** — Drei's `<ContactShadows>` positioned just below buildings at `y={0.01}`. Soft, blurry shadows at the building base. Settings: `opacity={0.4}`, `blur={2.5}`, `far={4}`, `width={30}`, `height={30}` (covers the buildable area around origin).

**Removed:** `RoundedBox` earth block, separate grass overlay plane, ground `castShadow`.

### 5. Enable Shadow Casting on Building Meshes

Currently no building mesh has `castShadow` set — only the directional light and the ground have shadow properties. Without this, the shadow map upgrades and `ContactShadows` would have no visible effect.

Add `castShadow` to:
- Wall meshes in `Wall.tsx` (including the `GlassWallMesh` sub-component)
- Roof meshes in `Roof.tsx` (flat and pitched)
- Timber frame posts, beams, and braces in `TimberFrame.tsx`

Add `receiveShadow` to:
- Wall meshes (walls should receive shadows from roof overhangs and adjacent structures)
- Floor meshes in `Floor.tsx`

### 6. Renderer & Shadow Tuning

**Renderer (`<Canvas>` gl prop):**
```tsx
<Canvas gl={{ toneMapping: ACESFilmicToneMapping, toneMappingExposure: 1.0 }} shadows ...>
```
Note: `antialias` defaults to `true` in R3F's Canvas, so no need to set explicitly.

**Shadows:**
- Bump shadow map from 2048 to 4096 on desktop (keep 2048 on mobile)
- Add `shadow-bias={-0.0005}` on directional light to eliminate shadow acne
- Add Drei's `<SoftShadows>` for PCF soft shadow filtering (feathered edges)
- Expand shadow camera frustum from ±15 to ±20 for larger ground plane

**Camera:**
- Increase `maxDistance` from 40 to 60 for the larger scene

### 7. Material Refinement

Tune `envMapIntensity` per material so the HDRI reflections match physical expectations:

| Material | envMapIntensity | Rationale |
|---|---|---|
| Wood walls | 0.3 | Matte, barely reflects |
| Brick | 0.4 | Slight environment sheen |
| Plaster (stucwerk) | 0.5 | Smooth surface, moderate |
| Metal walls | 1.0 | Full environment reflection |
| Glass walls/windows | 1.5 | Boosted — glass is the star |
| Glass wall (GlassWallMesh in Wall.tsx) | 1.5 | Same as glass windows |
| Metal door | 1.0 | Match metal walls |
| Wood door | 0.3 | Match wood walls |
| Roof (metal trim) | 0.8 | Visible from above, catches sky |
| Timber frame | 0.2 | Rough wood, minimal |
| Ground (grass) | 0.3 | Subtle wet-grass look |

**Singleton material note:** `frameMat` and `glassMat` in `DoorMesh.tsx` are module-level singletons shared across all doors and windows. Set `envMapIntensity` on these once (frame: 0.8, glass: 1.5). Since all doors/windows share the same reflection intensity, singleton mutation is fine here.

**Wall textures note:** Current wall textures are diffuse-only (no normal/roughness maps). The HDRI reflections on walls will be limited by the flat `metalness: 0.1, roughness: 0.7` values. This is acceptable — walls still benefit from ambient light color variation. Adding wall normal maps is a future enhancement, out of scope for this spec.

## Scene Graph (After)

```
Canvas (shadows, gl={{ toneMapping: ACESFilmic, toneMappingExposure: 1.0 }})
├── Environment (HDRI preset, background=false)
├── directionalLight (sun, intensity 0.8, soft shadows, 4096 map, castShadow)
├── SoftShadows
├── SkyGradient (visible sky background, depthWrite=false)
├── Buildings[] (castShadow, receiveShadow, updated envMapIntensity per material)
├── Ground (large plane at y=-0.001, grass PBR textures, receiveShadow)
├── ContactShadows (y=0.01, width=30, height=30, soft base shadows)
├── CameraAnimator + OrbitControls
└── EffectComposer (desktop only, based on detect-gpu tier)
    ├── SSAO
    └── Bloom
```

## Mobile Strategy

Use `detect-gpu` library at app startup (outside the Canvas) to determine GPU tier. Store the result in the zustand config store as a `qualityTier: 'high' | 'low'` value.

- **High (desktop/powerful mobile):** Full pipeline — SSAO, bloom, 4096 shadows, SoftShadows
- **Low (mobile/weak GPU):** No post-processing, 2048 shadows, rely on HDRI + contact shadows

## Files Modified

- `src/components/canvas/BuildingScene.tsx` — environment, post-processing, renderer config, soft shadows, contact shadows, remove fill light
- `src/components/canvas/Wall.tsx` — remove `<Edges>` and `polygonOffset` props, add `envMapIntensity`, add `castShadow`/`receiveShadow`
- `src/components/canvas/Ground.tsx` — replace RoundedBox with large plane at y=-0.001
- `src/components/canvas/Roof.tsx` — add `envMapIntensity`, add `castShadow`
- `src/components/canvas/DoorMesh.tsx` — set `envMapIntensity` on singleton `frameMat` and `glassMat`
- `src/components/canvas/WindowMesh.tsx` — add `envMapIntensity` to any inline materials
- `src/components/canvas/TimberFrame.tsx` — add `envMapIntensity`, add `castShadow`
- `src/components/canvas/Floor.tsx` — add `envMapIntensity`, add `receiveShadow`
- `src/components/canvas/BuildingInstance.tsx` — add `envMapIntensity` to selection outline material if applicable
- `src/store/useConfigStore.ts` — add `qualityTier` state from detect-gpu
- `package.json` — add `@react-three/postprocessing`, `postprocessing`, and `detect-gpu`
