'use client';

import { useRef, useCallback, useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { Raycaster, Vector2, Vector3, Plane, BoxGeometry } from 'three';
import { BuildingProvider } from '@/lib/BuildingContext';
import { useConfigStore } from '@/store/useConfigStore';
import { detectSnap, detectPoleSnap } from '@/lib/snap';
import Building from './Building';

const groundPlane = new Plane(new Vector3(0, 1, 0), 0);

interface BuildingInstanceProps {
  buildingId: string;
}

export default function BuildingInstance({ buildingId }: BuildingInstanceProps) {
  const building = useConfigStore((s) => s.buildings.find(b => b.id === buildingId));
  const selectedBuildingId = useConfigStore((s) => s.selectedBuildingId);
  const selectBuilding = useConfigStore((s) => s.selectBuilding);
  const updateBuildingPosition = useConfigStore((s) => s.updateBuildingPosition);
  const setDraggedBuildingId = useConfigStore((s) => s.setDraggedBuildingId);
  const setConnections = useConfigStore((s) => s.setConnections);

  const dragging = useRef(false);
  const dragStart = useRef<Vector3 | null>(null);
  const startPos = useRef<[number, number]>([0, 0]);
  const pointerDownScreen = useRef<{ x: number; y: number } | null>(null);
  const cleanupDrag = useRef<(() => void) | null>(null);
  const { gl, camera } = useThree();

  // Clean up drag listeners on unmount
  useEffect(() => () => { cleanupDrag.current?.(); }, []);

  const getGroundPoint = useCallback((clientX: number, clientY: number): Vector3 | null => {
    const rect = gl.domElement.getBoundingClientRect();
    const ndc = new Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    const raycaster = new Raycaster();
    raycaster.setFromCamera(ndc, camera);
    const target = new Vector3();
    const hit = raycaster.ray.intersectPlane(groundPlane, target);
    return hit ? target : null;
  }, [gl, camera]);

  const onPointerDown = useCallback((e: PointerEvent) => {
    if (e.button !== 0) return;
    pointerDownScreen.current = { x: e.clientX, y: e.clientY };
    const pt = getGroundPoint(e.clientX, e.clientY);
    if (!pt || !building) return;
    dragStart.current = pt;
    startPos.current = [...building.position];

    const onMove = (me: PointerEvent) => {
      if (!dragStart.current) return;
      const down = pointerDownScreen.current;
      if (down && !dragging.current) {
        const dx = me.clientX - down.x;
        const dy = me.clientY - down.y;
        if (dx * dx + dy * dy < 25) return;
        dragging.current = true;
        setDraggedBuildingId(buildingId);
      }
      if (!dragging.current) return;
      const curr = getGroundPoint(me.clientX, me.clientY);
      if (!curr) return;
      const delta = curr.clone().sub(dragStart.current);
      const newPos: [number, number] = [
        startPos.current[0] + delta.x,
        startPos.current[1] + delta.z,
      ];

      const allBuildings = useConfigStore.getState().buildings;
      const isPole = building.type === 'paal';

      if (isPole) {
        const snapped = detectPoleSnap(newPos, allBuildings.filter(b => b.id !== buildingId));
        updateBuildingPosition(buildingId, snapped);
      } else {
        const others = allBuildings.filter(b => b.id !== buildingId && b.type !== 'paal');
        const tempBuilding = { ...building, position: newPos };
        const { snappedPosition, newConnections } = detectSnap(tempBuilding, others);
        updateBuildingPosition(buildingId, snappedPosition);
        setConnections(newConnections);
      }
    };

    const onUp = () => {
      if (dragging.current) {
        setDraggedBuildingId(null);
      }
      dragging.current = false;
      dragStart.current = null;
      pointerDownScreen.current = null;
      cleanupDrag.current = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    cleanupDrag.current = onUp;
  }, [building, buildingId, getGroundPoint, updateBuildingPosition, setDraggedBuildingId, setConnections]);

  const setAccordionSection = useConfigStore((s) => s.setAccordionSection);

  const handleClick = useCallback((e: { stopPropagation: () => void }) => {
    if (dragging.current) return;
    e.stopPropagation();
    selectBuilding(buildingId);
    setAccordionSection(2);
  }, [buildingId, selectBuilding, setAccordionSection]);

  if (!building) return null;

  const isSelected = selectedBuildingId === buildingId;

  return (
    <BuildingProvider value={buildingId}>
      <group
        position={[building.position[0], 0, building.position[1]]}
        onClick={handleClick}
        onPointerDown={(e) => onPointerDown(e.nativeEvent)}
      >
        <Building />
        {isSelected && (
          <SelectionOutline
            width={building.dimensions.width}
            depth={building.dimensions.depth}
            height={building.dimensions.height}
            isPole={building.type === 'paal'}
          />
        )}
      </group>
    </BuildingProvider>
  );
}

function SelectionOutline({ width, depth, height, isPole }: { width: number; depth: number; height: number; isPole?: boolean }) {
  const margin = isPole ? 0.4 : 0.1;
  const geo = useMemo(() => new BoxGeometry(width + margin, height + margin, depth + margin), [width, depth, height, margin]);
  useEffect(() => () => { geo.dispose(); }, [geo]);
  return (
    <lineSegments position={[0, height / 2, 0]}>
      <edgesGeometry args={[geo]} />
      <lineBasicMaterial color="#3b82f6" linewidth={2} />
    </lineSegments>
  );
}
