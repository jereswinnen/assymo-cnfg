import {
  WALL_THICKNESS,
  DOUBLE_DOOR_W,
  DOOR_W,
  WIN_W,
  computeOpeningPositions,
} from '@/lib/constants';
import type { WallConfig, DoorSwing } from '@/types/building';
import { getWallGeometries } from './SchematicWalls';
import type { WallGeom } from './SchematicWalls';
import type { BuildingType, BuildingDimensions } from '@/types/building';

const T = WALL_THICKNESS;

interface SchematicOpeningsProps {
  buildingType: BuildingType;
  dimensions: BuildingDimensions;
  walls: Record<string, WallConfig>;
}

export default function SchematicOpenings({
  buildingType,
  dimensions,
  walls,
}: SchematicOpeningsProps) {
  const geoms = getWallGeometries(buildingType, dimensions);

  return (
    <g>
      {geoms.map((g) => {
        const cfg = walls[g.wallId];
        if (!cfg) return null;

        const ds = cfg.doorSize ?? 'enkel';
        const { doorX, windowXs } = computeOpeningPositions(
          g.length,
          cfg.hasDoor,
          cfg.doorPosition ?? 'midden',
          ds,
          cfg.hasWindow ? cfg.windowCount : 0,
        );

        return (
          <g key={g.wallId}>
            {cfg.hasDoor && (
              <DoorSymbol
                geom={g}
                localDoorX={doorX * g.flipSign}
                doorWidth={ds === 'dubbel' ? DOUBLE_DOOR_W : DOOR_W}
                isDouble={ds === 'dubbel'}
                swing={cfg.doorSwing ?? 'dicht'}
              />
            )}

            {windowXs.map((wx, i) => (
              <WindowSymbol
                key={i}
                geom={g}
                localWinX={wx * g.flipSign}
              />
            ))}
          </g>
        );
      })}
    </g>
  );
}

// ---------------------------------------------------------------------------
// Door symbol — standard architectural floor-plan convention:
//   • Thin line from hinge to open position (the door panel)
//   • Dashed quarter-circle arc showing the sweep path
// ---------------------------------------------------------------------------

function DoorSymbol({
  geom,
  localDoorX,
  doorWidth: dw,
  isDouble,
  swing,
}: {
  geom: WallGeom;
  localDoorX: number;
  doorWidth: number;
  isDouble: boolean;
  swing: DoorSwing;
}) {
  const { cx, cy, orientation, inward, hingeEnd } = geom;
  const isH = orientation === 'h';

  // Always show swing — default to inward when door is closed
  const effectiveSwing = swing === 'dicht' ? 'naar_binnen' : swing;
  const swingSign = effectiveSwing === 'naar_binnen' ? 1 : -1;

  if (isDouble) {
    return (
      <DoubleDoorArcs
        cx={cx}
        cy={cy}
        localDoorX={localDoorX}
        halfW={dw / 2}
        isH={isH}
        inward={inward}
        swingSign={swingSign}
      />
    );
  }

  return (
    <SingleDoorArc
      cx={cx}
      cy={cy}
      localDoorX={localDoorX}
      dw={dw}
      isH={isH}
      inward={inward}
      swingSign={swingSign}
      hingeEnd={hingeEnd}
    />
  );
}

function SingleDoorArc({
  cx,
  cy,
  localDoorX,
  dw,
  isH,
  inward,
  swingSign,
  hingeEnd,
}: {
  cx: number;
  cy: number;
  localDoorX: number;
  dw: number;
  isH: boolean;
  inward: [number, number];
  swingSign: number;
  hingeEnd: 'start' | 'end';
}) {
  const halfW = dw / 2;
  const r = dw;

  if (isH) {
    const doorCX = cx + localDoorX;
    const doorCY = cy;

    // Hinge and free-end positions along the wall
    const hingeX =
      hingeEnd === 'start' ? doorCX - halfW : doorCX + halfW;
    const freeX =
      hingeEnd === 'start' ? doorCX + halfW : doorCX - halfW;

    // Open position: perpendicular to wall from hinge
    const sweepY = swingSign * inward[1] * r;
    const openX = hingeX;
    const openY = doorCY + sweepY;

    // SVG arc sweep-flag: positive perpendicular offset = CW (1)
    const sweep = sweepY > 0 ? 1 : 0;

    return (
      <g stroke="#555" fill="none">
        {/* Door panel — open position */}
        <line
          x1={hingeX}
          y1={doorCY}
          x2={openX}
          y2={openY}
          strokeWidth={0.03}
        />
        {/* Swing arc */}
        <path
          d={`M ${freeX} ${doorCY} A ${r} ${r} 0 0 ${sweep} ${openX} ${openY}`}
          strokeWidth={0.02}
          strokeDasharray="0.08 0.05"
        />
      </g>
    );
  }

  // Vertical wall
  const doorCX = cx;
  const doorCY = cy + localDoorX;

  const hingeY =
    hingeEnd === 'start' ? doorCY - halfW : doorCY + halfW;
  const freeY =
    hingeEnd === 'start' ? doorCY + halfW : doorCY - halfW;

  const sweepX = swingSign * inward[0] * r;
  const openX = doorCX + sweepX;
  const openY = hingeY;

  const sweep = sweepX > 0 ? 1 : 0;

  return (
    <g stroke="#555" fill="none">
      <line
        x1={doorCX}
        y1={hingeY}
        x2={openX}
        y2={openY}
        strokeWidth={0.03}
      />
      <path
        d={`M ${doorCX} ${freeY} A ${r} ${r} 0 0 ${sweep} ${openX} ${openY}`}
        strokeWidth={0.02}
        strokeDasharray="0.08 0.05"
      />
    </g>
  );
}

function DoubleDoorArcs({
  cx,
  cy,
  localDoorX,
  halfW,
  isH,
  inward,
  swingSign,
}: {
  cx: number;
  cy: number;
  localDoorX: number;
  halfW: number;
  isH: boolean;
  inward: [number, number];
  swingSign: number;
}) {
  const r = halfW; // each panel radius = half the total door width

  if (isH) {
    const doorCX = cx + localDoorX;
    const doorCY = cy;
    const sweepY = swingSign * inward[1] * r;
    const sweep = sweepY > 0 ? 1 : 0;

    // Left panel: hinge at left edge, free at center
    const lHinge = doorCX - halfW;
    // Right panel: hinge at right edge, free at center
    const rHinge = doorCX + halfW;

    return (
      <g stroke="#555" fill="none">
        {/* Left panel */}
        <line x1={lHinge} y1={doorCY} x2={lHinge} y2={doorCY + sweepY} strokeWidth={0.03} />
        <path
          d={`M ${doorCX} ${doorCY} A ${r} ${r} 0 0 ${sweep} ${lHinge} ${doorCY + sweepY}`}
          strokeWidth={0.02}
          strokeDasharray="0.08 0.05"
        />
        {/* Right panel */}
        <line x1={rHinge} y1={doorCY} x2={rHinge} y2={doorCY + sweepY} strokeWidth={0.03} />
        <path
          d={`M ${doorCX} ${doorCY} A ${r} ${r} 0 0 ${1 - sweep} ${rHinge} ${doorCY + sweepY}`}
          strokeWidth={0.02}
          strokeDasharray="0.08 0.05"
        />
      </g>
    );
  }

  // Vertical wall
  const doorCX = cx;
  const doorCY = cy + localDoorX;
  const sweepX = swingSign * inward[0] * r;
  const sweep = sweepX > 0 ? 1 : 0;

  const tHinge = doorCY - halfW;
  const bHinge = doorCY + halfW;

  return (
    <g stroke="#555" fill="none">
      {/* Top panel */}
      <line x1={doorCX} y1={tHinge} x2={doorCX + sweepX} y2={tHinge} strokeWidth={0.03} />
      <path
        d={`M ${doorCX} ${doorCY} A ${r} ${r} 0 0 ${sweep} ${doorCX + sweepX} ${tHinge}`}
        strokeWidth={0.02}
        strokeDasharray="0.08 0.05"
      />
      {/* Bottom panel */}
      <line x1={doorCX} y1={bHinge} x2={doorCX + sweepX} y2={bHinge} strokeWidth={0.03} />
      <path
        d={`M ${doorCX} ${doorCY} A ${r} ${r} 0 0 ${1 - sweep} ${doorCX + sweepX} ${bHinge}`}
        strokeWidth={0.02}
        strokeDasharray="0.08 0.05"
      />
    </g>
  );
}

// ---------------------------------------------------------------------------
// Window symbol — three parallel lines across the wall thickness
// ---------------------------------------------------------------------------

function WindowSymbol({
  geom,
  localWinX,
}: {
  geom: WallGeom;
  localWinX: number;
}) {
  const halfW = WIN_W / 2;
  const halfT = T / 2;
  const { cx, cy, orientation } = geom;

  if (orientation === 'h') {
    const winCX = cx + localWinX;
    const offsets = [-halfT * 0.7, 0, halfT * 0.7];
    return (
      <g stroke="#5BA3D9" strokeWidth={0.02}>
        {offsets.map((off, i) => (
          <line
            key={i}
            x1={winCX - halfW}
            y1={cy + off}
            x2={winCX + halfW}
            y2={cy + off}
          />
        ))}
      </g>
    );
  }

  const winCY = cy + localWinX;
  const offsets = [-halfT * 0.7, 0, halfT * 0.7];
  return (
    <g stroke="#5BA3D9" strokeWidth={0.02}>
      {offsets.map((off, i) => (
        <line
          key={i}
          x1={cx + off}
          y1={winCY - halfW}
          x2={cx + off}
          y2={winCY + halfW}
        />
      ))}
    </g>
  );
}
