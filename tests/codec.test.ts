import { describe, it, expect } from 'vite-plus/test';
import { decodeState, encodeState } from '@/domain/config';
import { DEFAULT_WALL } from '@/domain/building';
import { makeBuilding, makeConfig } from './fixtures';

const BASE58_BAD = /[0OIl]/;

describe('config codec', () => {
  it('produces Bitcoin-style base58 (no 0/O/I/l)', () => {
    const cfg = makeConfig();
    const code = encodeState(cfg.buildings, cfg.connections, cfg.roof, cfg.defaultHeight);
    expect(code).not.toMatch(BASE58_BAD);
  });

  it('round-trips the default config', () => {
    const cfg = makeConfig();
    const code = encodeState(cfg.buildings, cfg.connections, cfg.roof, cfg.defaultHeight);
    const decoded = decodeState(code);
    expect(decoded.buildings.length).toBe(cfg.buildings.length);
    expect(decoded.defaultHeight).toBeCloseTo(cfg.defaultHeight, 1);
    expect(decoded.roof.type).toBe(cfg.roof.type);
  });

  it('round-trips a multi-building config with connections', () => {
    const cfg = makeConfig({
      buildings: [
        makeBuilding({
          id: 'a',
          type: 'berging',
          walls: { front: { ...DEFAULT_WALL }, back: { ...DEFAULT_WALL }, left: { ...DEFAULT_WALL }, right: { ...DEFAULT_WALL } },
        }),
        makeBuilding({
          id: 'b',
          type: 'overkapping',
          position: [4, 0],
          walls: {},
        }),
      ],
      connections: [
        { buildingAId: 'a', sideA: 'right', buildingBId: 'b', sideB: 'left', isOpen: false },
      ],
    });
    const code = encodeState(cfg.buildings, cfg.connections, cfg.roof, cfg.defaultHeight);
    const decoded = decodeState(code);
    expect(decoded.buildings).toHaveLength(2);
    expect(decoded.connections).toHaveLength(1);
    expect(decoded.connections[0].isOpen).toBe(false);
  });

  it('preserves doors and windows through a round-trip', () => {
    const cfg = makeConfig({
      buildings: [
        makeBuilding({
          id: 'a',
          type: 'berging',
          walls: {
            front: {
              ...DEFAULT_WALL,
              hasDoor: true,
              doorSize: 'dubbel',
              doorHasWindow: true,
              windows: [{ id: 'w1', position: 0.25, width: 1.2, height: 1.0, sillHeight: 1.2 }],
            },
            back: { ...DEFAULT_WALL },
            left: { ...DEFAULT_WALL },
            right: { ...DEFAULT_WALL },
          },
        }),
      ],
    });
    const code = encodeState(cfg.buildings, cfg.connections, cfg.roof, cfg.defaultHeight);
    const { buildings } = decodeState(code);
    const front = buildings[0].walls.front;
    expect(front.hasDoor).toBe(true);
    expect(front.doorSize).toBe('dubbel');
    expect(front.windows).toHaveLength(1);
    expect(front.windows[0].position).toBeCloseTo(0.25, 2);
  });

  it('throws on invalid codes', () => {
    expect(() => decodeState('')).toThrow();
    expect(() => decodeState('!!!not-a-code!!!')).toThrow();
  });
});
