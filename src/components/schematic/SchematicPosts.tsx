import { autoPoleLayout } from '@/domain/building';
import type { PolesConfig } from '@/domain/building';

const POST_SIZE = 0.15;

interface SchematicPostsProps {
  width: number;
  depth: number;
  offsetX?: number;
  offsetY?: number;
  poles?: PolesConfig;
}

export default function SchematicPosts({ width, depth, offsetX = 0, offsetY = 0, poles }: SchematicPostsProps) {
  const layout = poles ?? autoPoleLayout(width, depth);
  const hw = width / 2;
  const hd = depth / 2;

  const positions: [number, number][] = [];

  // Corners
  positions.push([-hw,  hd]);
  positions.push([ hw,  hd]);
  positions.push([-hw, -hd]);
  positions.push([ hw, -hd]);

  // Intermediates — keep the SchematicPosts/TimberFrame axis mapping
  // (back = +hd / +z, front = -hd / -z).
  for (const f of layout.back)  positions.push([-hw + f * width,  hd]);
  for (const f of layout.front) positions.push([-hw + f * width, -hd]);
  for (const f of layout.left)  positions.push([-hw, -hd + f * depth]);
  for (const f of layout.right) positions.push([ hw, -hd + f * depth]);

  const half = POST_SIZE / 2;

  return (
    <g>
      {positions.map(([x, y], i) => (
        <rect
          key={i}
          x={offsetX + x - half}
          y={offsetY + y - half}
          width={POST_SIZE}
          height={POST_SIZE}
          fill="#8B7355"
          stroke="#5C4A2A"
          strokeWidth={0.02}
        />
      ))}
    </g>
  );
}
