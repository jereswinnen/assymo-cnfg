import { Shape, Path, ExtrudeGeometry } from 'three';
import { DOUBLE_DOOR_W, DOOR_W } from '@/domain/building';
import type { WallId, DoorSize } from '@/domain/building';

export const DOOR_H = 2.1;

export interface DoorHole {
  x: number;
  width: number;
  height: number;
}
export const DOOR_DEPTH = 0.05;
export const DOUBLE_W = DOUBLE_DOOR_W; // 1.6m for double doors
export const WIN_W = 1.2;
export const WIN_H = 1.0;
export const WIN_SILL = 1.2; // height of windowsill from ground
export const WIN_DEPTH = 0.03;
export const FRAME_T = 0.04; // frame bar thickness
export const FRAME_D = 0.04; // frame bar depth

export function doorWidth(doorSize: DoorSize): number {
  return doorSize === 'dubbel' ? DOUBLE_W : DOOR_W;
}

export interface WindowHole {
  x: number;
  width: number;
  height: number;
  sillHeight: number;
}

/** Create an ExtrudeGeometry with rectangular holes for doors and/or windows.
 *  The geometry is centered at origin (same bounding box as a BoxGeometry of equal size)
 *  so it can be positioned identically to the box it replaces. */
export function createWallWithOpeningsGeo(
  wallLength: number,
  wallHeight: number,
  thickness: number,
  wallId: WallId,
  door: DoorHole | null,
  windowHoles: WindowHole[],
): ExtrudeGeometry {
  const hw = wallLength / 2;
  const hh = wallHeight / 2;

  // Outer rectangle (centered at origin)
  const shape = new Shape();
  shape.moveTo(-hw, -hh);
  shape.lineTo(hw, -hh);
  shape.lineTo(hw, hh);
  shape.lineTo(-hw, hh);
  shape.closePath();

  // Door hole (bottom at ground level)
  if (door) {
    const dw = door.width / 2;
    const dh = Math.min(door.height, wallHeight - 0.05);
    const hole = new Path();
    hole.moveTo(door.x - dw, -hh);
    hole.lineTo(door.x + dw, -hh);
    hole.lineTo(door.x + dw, -hh + dh);
    hole.lineTo(door.x - dw, -hh + dh);
    hole.closePath();
    shape.holes.push(hole);
  }

  // Window holes
  for (const win of windowHoles) {
    const ww = win.width / 2;
    const winBottom = -hh + win.sillHeight;
    const winTop = winBottom + win.height;
    if (winTop > winBottom && ww > 0) {
      const hole = new Path();
      hole.moveTo(win.x - ww, winBottom);
      hole.lineTo(win.x + ww, winBottom);
      hole.lineTo(win.x + ww, winTop);
      hole.lineTo(win.x - ww, winTop);
      hole.closePath();
      shape.holes.push(hole);
    }
  }

  const geo = new ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: false,
  });

  // Center along extrusion axis (Z)
  geo.translate(0, 0, -thickness / 2);

  // Normalize UVs to 0-1 range so the existing texture repeat works
  const uvAttr = geo.getAttribute('uv');
  for (let i = 0; i < uvAttr.count; i++) {
    const u = uvAttr.getX(i);
    const v = uvAttr.getY(i);
    uvAttr.setXY(i, (u + hw) / wallLength, (v + hh) / wallHeight);
  }
  uvAttr.needsUpdate = true;

  // Rotate geometry so it matches the boxGeometry orientation for each wall type.
  switch (wallId) {
    case 'back':
      geo.rotateY(Math.PI);
      break;
    case 'left':
      geo.rotateY(Math.PI / 2);
      break;
    case 'right':
      geo.rotateY(-Math.PI / 2);
      break;
  }

  return geo;
}

/** Create door panel ExtrudeGeometry with a window hole cut out */
export function createDoorPanelWithWindowGeo(panelW: number, panelH: number): ExtrudeGeometry {
  const hw = panelW / 2;
  const hh = panelH / 2;

  const shape = new Shape();
  shape.moveTo(-hw, -hh);
  shape.lineTo(hw, -hh);
  shape.lineTo(hw, hh);
  shape.lineTo(-hw, hh);
  shape.closePath();

  const glassW = panelW - 0.16;
  const glassH = panelH * 0.35;
  const glassTop = hh - 0.08;
  const glassBottom = glassTop - glassH;
  const ghw = glassW / 2;

  const hole = new Path();
  hole.moveTo(-ghw, glassBottom);
  hole.lineTo(ghw, glassBottom);
  hole.lineTo(ghw, glassTop);
  hole.lineTo(-ghw, glassTop);
  hole.closePath();
  shape.holes.push(hole);

  const geo = new ExtrudeGeometry(shape, { depth: DOOR_DEPTH, bevelEnabled: false });
  geo.translate(0, 0, -DOOR_DEPTH / 2);
  return geo;
}
