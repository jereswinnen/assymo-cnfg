# Visual Quality Upgrade — Approach A: Lighting & Atmosphere

**Date:** 2026-03-24
**Goal:** Transform the 3D building configurator from a blocky "Minecraft" aesthetic to a professional, realistic outdoor scene — without changing geometry.

## Context

The configurator currently uses flat ambient lighting, hard black edge lines on walls, a floating 25×25 ground block, and no post-processing. These combine to produce a game-engine look rather than a professional configurator. The target is a realistic outdoor scene feel that runs well on both desktop and mobile browsers.

## New Dependencies

- `@react-three/postprocessing` — post-processing effects (SSAO, bloom)
- `postprocessing` — peer dependency

All other components (`Environment`, `ContactShadows`, `SoftShadows`) are already available in `@react-three/drei`.

## Design

### 1. HDRI Environment Lighting

Replace `ambientLight` with Drei's `<Environment>` using an outdoor HDRI (e.g. Poly Haven's "kloofendal" or similar bright outdoor scene).

- Set `background={false}` — the existing `SkyGradient` shader stays as the visible sky
- The HDRI contributes lighting and reflections only
- Remove the secondary fill `directionalLight` at `[-5, 5, -5]` — the HDRI handles ambient fill
- Reduce primary `directionalLight` intensity from 1.2 to ~0.8 since the HDRI provides ambient

### 2. Post-Processing Pipeline

Add `EffectComposer` from `@react-three/postprocessing` with:

1. **SSAO** — darkens corners, crevices, and surface intersections. Low radius (~0.05), moderate intensity (~1.5), half-resolution for performance. This kills the flat look where walls meet floors, roof edges, door frames.

2. **Tone Mapping** — `ACESFilmicToneMapping` set at the renderer level via Canvas `gl` props. Compresses HDR into cinematic color response — natural white rolloff, deeper darks.

3. **Bloom** — very low intensity (~0.15), high threshold (~0.9). Only triggers on glass and bright HDRI highlights. Gives glass a subtle "catching sunlight" glow.

**Mobile adaptive quality:** Detect GPU capability. Desktop gets full SSAO + bloom. Mobile skips post-processing entirely, relying on HDRI + contact shadows for the uplift.

### 3. Remove Hard Edge Lines

Delete all `<Edges>` components from `Wall.tsx`. These black wireframe outlines are the single biggest "game engine" tell. Selection feedback continues to work through emissive glow (already implemented).

With HDRI and SSAO in place, adjacent walls of the same color are naturally distinguished by ambient occlusion in the corner seams and different lighting angles.

### 4. Ground Plane Overhaul

Replace the 25×25 `RoundedBox` earth block with:

1. **Large ground plane** — 200×200 flat mesh at y=0 with the existing grass PBR textures (color + normal + roughness). UV repeat scaled up proportionally. Color-matched to the sky gradient's horizon so the seam at the edges disappears. `receiveShadow` enabled.

2. **Contact shadows** — Drei's `<ContactShadows>` positioned just below buildings at `y={0.01}`. Soft, blurry shadows at the building base. Settings: `opacity={0.4}`, `blur={2.5}`, `far={4}`.

**Removed:** `RoundedBox` earth block, separate grass overlay plane, ground `castShadow`.

### 5. Renderer & Shadow Tuning

**Renderer (`<Canvas>` gl props):**
- `toneMapping={ACESFilmicToneMapping}`
- `toneMappingExposure={1.0}`
- `antialias={true}` (explicit)

**Shadows:**
- Bump shadow map from 2048 to 4096 on desktop (keep 2048 on mobile)
- Add `shadow-bias={-0.0005}` on directional light to eliminate shadow acne
- Add Drei's `<SoftShadows>` for PCF soft shadow filtering (feathered edges)
- Expand shadow camera frustum from ±15 to ±20 for larger ground plane

**Camera:**
- Increase `maxDistance` from 40 to 60 for the larger scene

### 6. Material Refinement

Tune `envMapIntensity` per material so the HDRI reflections match physical expectations:

| Material | envMapIntensity | Rationale |
|---|---|---|
| Wood walls | 0.3 | Matte, barely reflects |
| Brick | 0.4 | Slight environment sheen |
| Plaster (stucwerk) | 0.5 | Smooth surface, moderate |
| Metal walls | 1.0 | Full environment reflection |
| Glass walls/windows | 1.5 | Boosted — glass is the star |
| Metal door | 1.0 | Match metal walls |
| Wood door | 0.3 | Match wood walls |
| Roof (metal trim) | 0.8 | Visible from above, catches sky |
| Timber frame | 0.2 | Rough wood, minimal |
| Ground (grass) | 0.3 | Subtle wet-grass look |

No geometry changes — purely material property tuning. Existing PBR textures (normal maps, roughness maps) will respond much better to proper environment lighting.

## Scene Graph (After)

```
Canvas (shadows, ACESFilmic tone mapping)
├── Environment (HDRI, background=false)
├── directionalLight (sun, intensity 0.8, soft shadows, 4096 map)
├── SoftShadows
├── SkyGradient (visible sky background)
├── Buildings[] (updated envMapIntensity per material)
├── Ground (large plane, grass PBR textures)
├── ContactShadows (soft base shadows)
├── CameraAnimator + OrbitControls
└── EffectComposer (desktop only)
    ├── SSAO
    └── Bloom
```

## Mobile Strategy

Detect GPU tier at startup via `renderer.capabilities` or UA detection:

- **Desktop:** Full pipeline — SSAO, bloom, 4096 shadows, SoftShadows
- **Mobile:** No post-processing, 2048 shadows, rely on HDRI + contact shadows

## Files Modified

- `src/components/canvas/BuildingScene.tsx` — environment, post-processing, renderer config, soft shadows, contact shadows
- `src/components/canvas/Wall.tsx` — remove `<Edges>`, add `envMapIntensity`
- `src/components/canvas/Ground.tsx` — replace RoundedBox with large plane
- `src/components/canvas/Roof.tsx` — add `envMapIntensity` to materials
- `src/components/canvas/DoorMesh.tsx` — add `envMapIntensity` to materials
- `src/components/canvas/WindowMesh.tsx` — add `envMapIntensity` to glass/frame materials
- `src/components/canvas/TimberFrame.tsx` — add `envMapIntensity` to wood material
- `src/components/canvas/Floor.tsx` — add `envMapIntensity` to floor materials
- `src/components/canvas/BuildingInstance.tsx` — potentially add `envMapIntensity` to selection outline material
- `package.json` — add `@react-three/postprocessing` and `postprocessing`
