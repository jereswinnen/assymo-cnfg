# Feature Ideas

A roadmap of potential features for the 3D building configurator, grouped by estimated effort.

## Quick wins

These follow the existing pattern: update types → store defaults → panel control → pricing.

- **Gutter/fascia options** — material and color for roof edges, flat fee per linear meter
- **Floor/slab configuration** — a ground-level surface with its own material, insulation, and pricing
- **Multiple door styles** — single, double, roller/garage with different prices and cutout sizes
- **Window sizing presets** — small/medium/large instead of one fixed cutout size
- **Color picker per surface** — override the material's default color with a custom tint

## Medium effort

These require new geometry, UI sections, or tooling integrations.

- **Gable end triangles** — fill the triangular area above front/back walls with a separate configurable surface (currently open)
- **Overhang/eaves control** — slider for how far the roof extends past the walls, updates roof geometry and pricing
- **Door/window 3D cutouts** — boolean-subtract or inset geometry to show openings in walls rather than just pricing them
- **Undo/redo** — Zustand middleware (`temporal`) to track state history
- **Presets/templates** — "Garage", "Workshop", "Garden shed" buttons that load predefined configs
- **Export config as JSON** — download/upload for saving and sharing configurations
- **Screenshot/PDF export** — capture the canvas with `gl.toDataURL()` for quotes

## Larger features

- **Lean-to / mono-pitch roof type** — add a `roofType` enum (`gable | mono | flat | hip`) and swap roof geometry accordingly
- **Multi-section buildings** — L-shaped or T-shaped footprints by composing multiple rectangular volumes
- **Dimension annotations** — drei `<Html>` or `<Line>` overlays showing actual measurements on the 3D model
- **Drag handles** — click and drag wall faces to resize the building directly in the viewport
- **Texture maps** — swap flat colors for tiling brick/wood/metal textures on materials (still no GLTF, just `TextureLoader`)
- **Shadow study** — adjustable sun position to visualize shadows at different times of day
- **Structural framing view** — toggle wireframe showing stud spacing, derived from dimensions
- **i18n and currency** — locale-aware formatting and currency selection
- **Backend persistence** — save configs to a database, generate shareable URLs
