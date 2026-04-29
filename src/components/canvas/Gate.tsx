'use client';

import { useCallback } from 'react';
import { useBuildingId } from '@/lib/BuildingContext';
import { useConfigStore, getEffectiveHeight } from '@/store/useConfigStore';
import { useUIStore } from '@/store/useUIStore';
import { useTenant } from '@/lib/TenantProvider';
import { DEFAULT_PART_GAP_MM } from '@/domain/building';
import { getAtomColor } from '@/domain/materials';
import { useGateTexture } from '@/lib/textures';
import { useClickableObject } from '@/lib/useClickableObject';

const GATE_THICKNESS = 0.04;
const GATE_FALLBACK_COLOR = '#888888';

export default function Gate() {
  const { catalog: { materials } } = useTenant();
  const buildingId = useBuildingId();
  const building = useConfigStore((s) => s.buildings.find(b => b.id === buildingId));
  const defaultHeight = useConfigStore((s) => s.defaultHeight);
  const selectBuilding = useUIStore((s) => s.selectBuilding);

  const onSelect = useCallback(() => selectBuilding(buildingId), [selectBuilding, buildingId]);
  const { hovered, handlers: pointerHandlers } = useClickableObject(onSelect);

  if (!building || building.type !== 'poort' || !building.gateConfig) return null;

  const { gateConfig } = building;
  const totalWidth = building.dimensions.width;
  const height = getEffectiveHeight(building, defaultHeight);
  // Per-leaf gap (m). Only applied for 2-part gates; the entity carries it
  // via gateConfig.partGapMm (pinned at spawn from the product). Falls back
  // to DEFAULT_PART_GAP_MM for legacy scenes that pre-date the field.
  const gap =
    gateConfig.partCount === 2
      ? (gateConfig.partGapMm ?? DEFAULT_PART_GAP_MM) / 1000
      : 0;
  const leafWidth = (totalWidth - gap) / gateConfig.partCount;
  const materialId = gateConfig.materialId;

  const color = materialId
    ? getAtomColor(materials, materialId, 'gate')
    : GATE_FALLBACK_COLOR;

  return (
    <group position={[0, height / 2, 0]}>
      {gateConfig.partCount === 1 ? (
        <GatePanel
          width={totalWidth}
          height={height}
          x={0}
          materialId={materialId}
          color={color}
          hovered={hovered}
          pointerHandlers={pointerHandlers}
        />
      ) : (
        <>
          <GatePanel
            width={leafWidth}
            height={height}
            x={-(leafWidth + gap) / 2}
            materialId={materialId}
            color={color}
            hovered={hovered}
            pointerHandlers={pointerHandlers}
          />
          <GatePanel
            width={leafWidth}
            height={height}
            x={(leafWidth + gap) / 2}
            materialId={materialId}
            color={color}
            hovered={hovered}
            pointerHandlers={pointerHandlers}
          />
        </>
      )}
    </group>
  );
}

interface GatePanelProps {
  width: number;
  height: number;
  x: number;
  materialId: string;
  color: string;
  hovered: boolean;
  pointerHandlers: Record<string, unknown>;
}

function GatePanel({ width, height, x, materialId, color, hovered, pointerHandlers }: GatePanelProps) {
  const texture = useGateTexture(materialId, width, height);
  const tint = texture ? '#ffffff' : color;

  return (
    <mesh position={[x, 0, 0]} castShadow receiveShadow {...pointerHandlers}>
      <boxGeometry args={[width, height, GATE_THICKNESS]} />
      <meshStandardMaterial
        color={tint}
        map={texture?.map ?? undefined}
        normalMap={texture?.normalMap ?? undefined}
        roughnessMap={texture?.roughnessMap ?? undefined}
        metalness={0.1}
        roughness={texture?.roughnessMap ? 1 : 0.6}
        emissive={hovered ? '#60a5fa' : '#000000'}
        emissiveIntensity={hovered ? 0.15 : 0}
      />
    </mesh>
  );
}
