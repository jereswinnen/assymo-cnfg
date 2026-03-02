import { Shape, Path, ExtrudeGeometry } from 'three';
import { DOUBLE_DOOR_W, DOOR_W } from '@/lib/constants';
import type { WallId, DoorSize } from '@/types/building';

export const DOOR_H = 2.1;
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

/** Create an ExtrudeGeometry with rectangular holes for doors and/or windows.
 *  The geometry is centered at origin (same bounding box as a BoxGeometry of equal size)
 *  so it can be positioned identically to the box it replaces. */
export function createWallWithOpeningsGeo(
  wallLength: number,
  wallHeight: number,
  thickness: number,
  wallId: WallId,
  doorX: number | null,
  doorSize: DoorSize,
  windowXs: number[],
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
  if (doorX !== null) {
    const dw = doorWidth(doorSize) / 2;
    const dh = Math.min(DOOR_H, wallHeight - 0.05);
    const hole = new Path();
    hole.moveTo(doorX - dw, -hh);
    hole.lineTo(doorX + dw, -hh);
    hole.lineTo(doorX + dw, -hh + dh);
    hole.lineTo(doorX - dw, -hh + dh);
    hole.closePath();
    shape.holes.push(hole);
  }

  // Window holes
  for (const wx of windowXs) {
    const ww = WIN_W / 2;
    const winBottom = -hh + WIN_SILL;
    const winTop = winBottom + WIN_H;
    const hole = new Path();
    hole.moveTo(wx - ww, winBottom);
    hole.lineTo(wx + ww, winBottom);
    hole.lineTo(wx + ww, winTop);
    hole.lineTo(wx - ww, winTop);
    hole.closePath();
    shape.holes.push(hole);
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
