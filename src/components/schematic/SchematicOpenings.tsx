import {
  WALL_THICKNESS,
  DOUBLE_DOOR_W,
  DOOR_W,
  WIN_W,
  resolveOpeningPositions,
  fractionToX,
} from '@/domain/building';
import type { WallConfig, DoorSwing, BuildingDimensions } from '@/domain/building';
import { getWallGeometries } from './SchematicWalls';
import type { WallGeom } from './SchematicWalls';

const T = WALL_THICKNESS;

interface SchematicOpeningsProps {
  dimensions: BuildingDimensions;
  walls: Record<string, WallConfig>;
  offsetX: number;
  offsetY: number;
  buildingId?: string;
  onOpeningPointerDown?: (
    e: React.PointerEvent,
    info: { buildingId: string; wallId: string; type: 'door' | 'window'; windowIndex?: number },
  ) => void;
  dragPreview?: {
    buildingId: string;
    wallId: string;
    type: 'door' | 'window';
    windowIndex?: number;
    fraction: number;
  } | null;
}

export default function SchematicOpenings({
  dimensions,
  walls,
  offsetX,
  offsetY,
  buildingId,
  onOpeningPointerDown,
  dragPreview,
}: SchematicOpeningsProps) {
  const geoms = getWallGeometries(dimensions, offsetX, offsetY);

  // Check if this building has an active drag preview
  const hasPreview = dragPreview && dragPreview.buildingId === buildingId;

  return (
    <g>
      {geoms.map((g) => {
        const cfg = walls[g.wallId];
        if (!cfg) return null;

        const ds = cfg.doorSize ?? 'enkel';
        const dw = ds === 'dubbel' ? DOUBLE_DOOR_W : DOOR_W;
        const { doorX, windowXs } = resolveOpeningPositions(
          g.length,
          cfg.hasDoor ? (cfg.doorPosition ?? 0.5) : null,
          cfg.windows ?? [],
        );

        const isH = g.orientation === 'h';
        const wallPreview = hasPreview && dragPreview!.wallId === g.wallId ? dragPreview! : null;

        // Determine if the door is being dragged
        const isDoorDragged = wallPreview?.type === 'door';

        return (
          <g key={g.wallId}>
            {/* Door */}
            {cfg.hasDoor && (() => {
              const localDoorX = doorX! * g.flipSign;
              // If door is being dragged, render original at reduced opacity
              const doorOpacity = isDoorDragged ? 0.3 : 1;

              return (
                <>
                  {/* Hit target for door */}
                  {buildingId && onOpeningPointerDown && (
                    <rect
                      x={isH
                        ? g.cx + (isDoorDragged ? fractionToX(g.length, wallPreview!.fraction) * g.flipSign : localDoorX) - dw / 2
                        : g.cx - 0.25}
                      y={isH
                        ? g.cy - 0.25
                        : g.cy + (isDoorDragged ? fractionToX(g.length, wallPreview!.fraction) * g.flipSign : localDoorX) - dw / 2}
                      width={isH ? dw : 0.5}
                      height={isH ? 0.5 : dw}
                      fill="transparent"
                      stroke="none"
                      cursor="grab"
                      onPointerDown={(e) => onOpeningPointerDown(e, { buildingId, wallId: g.wallId, type: 'door' })}
                    />
                  )}

                  {/* Original door (faded when dragging) */}
                  <g opacity={doorOpacity}>
                    <DoorSymbol
                      geom={g}
                      localDoorX={localDoorX}
                      doorWidth={dw}
                      isDouble={ds === 'dubbel'}
                      swing={cfg.doorSwing ?? 'dicht'}
                      mirror={cfg.doorMirror ?? false}
                    />
                  </g>

                  {/* Ghost preview for door */}
                  {isDoorDragged && (
                    <g stroke="#3b82f6">
                      <DoorSymbol
                        geom={g}
                        localDoorX={fractionToX(g.length, wallPreview!.fraction) * g.flipSign}
                        doorWidth={dw}
                        isDouble={ds === 'dubbel'}
                        swing={cfg.doorSwing ?? 'dicht'}
                        mirror={cfg.doorMirror ?? false}
                      />
                    </g>
                  )}
                </>
              );
            })()}

            {/* Windows */}
            {windowXs.map((wx, i) => {
              const localWinX = wx * g.flipSign;
              const isWindowDragged = wallPreview?.type === 'window' && wallPreview.windowIndex === i;
              const winOpacity = isWindowDragged ? 0.3 : 1;
              const winWidth = (cfg.windows ?? [])[i]?.width ?? WIN_W;

              return (
                <g key={i}>
                  {/* Hit target for window */}
                  {buildingId && onOpeningPointerDown && (
                    <rect
                      x={isH
                        ? g.cx + (isWindowDragged ? fractionToX(g.length, wallPreview!.fraction) * g.flipSign : localWinX) - winWidth / 2
                        : g.cx - 0.25}
                      y={isH
                        ? g.cy - 0.25
                        : g.cy + (isWindowDragged ? fractionToX(g.length, wallPreview!.fraction) * g.flipSign : localWinX) - winWidth / 2}
                      width={isH ? winWidth : 0.5}
                      height={isH ? 0.5 : winWidth}
                      fill="transparent"
                      stroke="none"
                      cursor="grab"
                      onPointerDown={(e) => onOpeningPointerDown(e, { buildingId, wallId: g.wallId, type: 'window', windowIndex: i })}
                    />
                  )}

                  {/* Original window (faded when dragging) */}
                  <g opacity={winOpacity}>
                    <WindowSymbol geom={g} localWinX={localWinX} winWidth={winWidth} />
                  </g>

                  {/* Ghost preview for window */}
                  {isWindowDragged && (
                    <WindowSymbol
                      geom={g}
                      localWinX={fractionToX(g.length, wallPreview!.fraction) * g.flipSign}
                      winWidth={winWidth}
                      previewColor="#3b82f6"
                    />
                  )}
                </g>
              );
            })}
          </g>
        );
      })}
    </g>
  );
}

function DoorSymbol({
  geom,
  localDoorX,
  doorWidth: dw,
  isDouble,
  swing,
  mirror,
}: {
  geom: WallGeom;
  localDoorX: number;
  doorWidth: number;
  isDouble: boolean;
  swing: DoorSwing;
  mirror?: boolean;
}) {
  const { cx, cy, orientation, inward, hingeEnd } = geom;
  const isH = orientation === 'h';

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

  const effectiveHinge: 'start' | 'end' = mirror
    ? hingeEnd === 'start' ? 'end' : 'start'
    : hingeEnd;

  return (
    <SingleDoorArc
      cx={cx}
      cy={cy}
      localDoorX={localDoorX}
      dw={dw}
      isH={isH}
      inward={inward}
      swingSign={swingSign}
      hingeEnd={effectiveHinge}
    />
  );
}

function SingleDoorArc({
  cx, cy, localDoorX, dw, isH, inward, swingSign, hingeEnd,
}: {
  cx: number; cy: number; localDoorX: number; dw: number;
  isH: boolean; inward: [number, number]; swingSign: number;
  hingeEnd: 'start' | 'end';
}) {
  const halfW = dw / 2;
  const r = dw;

  if (isH) {
    const doorCX = cx + localDoorX;
    const doorCY = cy;
    const hingeX = hingeEnd === 'start' ? doorCX - halfW : doorCX + halfW;
    const freeX = hingeEnd === 'start' ? doorCX + halfW : doorCX - halfW;
    const sweepY = swingSign * inward[1] * r;
    const openX = hingeX;
    const openY = doorCY + sweepY;
    const sweep = (freeX - hingeX) * sweepY > 0 ? 1 : 0;

    return (
      <g stroke="#555" fill="none">
        <line x1={hingeX} y1={doorCY} x2={openX} y2={openY} strokeWidth={0.03} />
        <path d={`M ${freeX} ${doorCY} A ${r} ${r} 0 0 ${sweep} ${openX} ${openY}`} strokeWidth={0.02} strokeDasharray="0.08 0.05" />
      </g>
    );
  }

  const doorCX = cx;
  const doorCY = cy + localDoorX;
  const hingeY = hingeEnd === 'start' ? doorCY - halfW : doorCY + halfW;
  const freeY = hingeEnd === 'start' ? doorCY + halfW : doorCY - halfW;
  const sweepX = swingSign * inward[0] * r;
  const openX = doorCX + sweepX;
  const openY = hingeY;
  const sweep = (freeY - hingeY) * sweepX < 0 ? 1 : 0;

  return (
    <g stroke="#555" fill="none">
      <line x1={doorCX} y1={hingeY} x2={openX} y2={openY} strokeWidth={0.03} />
      <path d={`M ${doorCX} ${freeY} A ${r} ${r} 0 0 ${sweep} ${openX} ${openY}`} strokeWidth={0.02} strokeDasharray="0.08 0.05" />
    </g>
  );
}

function DoubleDoorArcs({
  cx, cy, localDoorX, halfW, isH, inward, swingSign,
}: {
  cx: number; cy: number; localDoorX: number; halfW: number;
  isH: boolean; inward: [number, number]; swingSign: number;
}) {
  const r = halfW;

  if (isH) {
    const doorCX = cx + localDoorX;
    const doorCY = cy;
    const sweepY = swingSign * inward[1] * r;
    const sweep = sweepY > 0 ? 1 : 0;
    const lHinge = doorCX - halfW;
    const rHinge = doorCX + halfW;

    return (
      <g stroke="#555" fill="none">
        <line x1={lHinge} y1={doorCY} x2={lHinge} y2={doorCY + sweepY} strokeWidth={0.03} />
        <path d={`M ${doorCX} ${doorCY} A ${r} ${r} 0 0 ${sweep} ${lHinge} ${doorCY + sweepY}`} strokeWidth={0.02} strokeDasharray="0.08 0.05" />
        <line x1={rHinge} y1={doorCY} x2={rHinge} y2={doorCY + sweepY} strokeWidth={0.03} />
        <path d={`M ${doorCX} ${doorCY} A ${r} ${r} 0 0 ${1 - sweep} ${rHinge} ${doorCY + sweepY}`} strokeWidth={0.02} strokeDasharray="0.08 0.05" />
      </g>
    );
  }

  const doorCX = cx;
  const doorCY = cy + localDoorX;
  const sweepX = swingSign * inward[0] * r;
  const sweep = sweepX > 0 ? 0 : 1;
  const tHinge = doorCY - halfW;
  const bHinge = doorCY + halfW;

  return (
    <g stroke="#555" fill="none">
      <line x1={doorCX} y1={tHinge} x2={doorCX + sweepX} y2={tHinge} strokeWidth={0.03} />
      <path d={`M ${doorCX} ${doorCY} A ${r} ${r} 0 0 ${sweep} ${doorCX + sweepX} ${tHinge}`} strokeWidth={0.02} strokeDasharray="0.08 0.05" />
      <line x1={doorCX} y1={bHinge} x2={doorCX + sweepX} y2={bHinge} strokeWidth={0.03} />
      <path d={`M ${doorCX} ${doorCY} A ${r} ${r} 0 0 ${1 - sweep} ${doorCX + sweepX} ${bHinge}`} strokeWidth={0.02} strokeDasharray="0.08 0.05" />
    </g>
  );
}

function WindowSymbol({ geom, localWinX, winWidth = WIN_W, previewColor }: { geom: WallGeom; localWinX: number; winWidth?: number; previewColor?: string }) {
  const halfW = winWidth / 2;
  const halfT = T / 2;
  const { cx, cy, orientation } = geom;
  const strokeColor = previewColor ?? '#5BA3D9';

  if (orientation === 'h') {
    const winCX = cx + localWinX;
    const offsets = [-halfT * 0.7, 0, halfT * 0.7];
    return (
      <g stroke={strokeColor} strokeWidth={0.02}>
        {offsets.map((off, i) => (
          <line key={i} x1={winCX - halfW} y1={cy + off} x2={winCX + halfW} y2={cy + off} />
        ))}
      </g>
    );
  }

  const winCY = cy + localWinX;
  const offsets = [-halfT * 0.7, 0, halfT * 0.7];
  return (
    <g stroke={strokeColor} strokeWidth={0.02}>
      {offsets.map((off, i) => (
        <line key={i} x1={cx + off} y1={winCY - halfW} x2={cx + off} y2={winCY + halfW} />
      ))}
    </g>
  );
}
