import { POST_SPACING } from '@/lib/constants';

const POST_SIZE = 0.15;

interface SchematicPostsProps {
  width: number;
  depth: number;
  offsetX?: number;
  offsetY?: number;
}

export default function SchematicPosts({ width, depth, offsetX = 0, offsetY = 0 }: SchematicPostsProps) {
  const hw = width / 2;
  const hd = depth / 2;

  const positions: [number, number][] = [];

  const postsW = Math.max(2, Math.floor(width / POST_SPACING) + 1);
  const stepW = width / (postsW - 1);
  for (let i = 0; i < postsW; i++) {
    const x = -hw + i * stepW;
    positions.push([x, hd]);
    positions.push([x, -hd]);
  }

  const postsD = Math.max(2, Math.floor(depth / POST_SPACING) + 1);
  const stepD = depth / (postsD - 1);
  for (let i = 1; i < postsD - 1; i++) {
    const y = -hd + i * stepD;
    positions.push([-hw, y]);
    positions.push([hw, y]);
  }

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
          fill="#5C4A2A"
          stroke="#3A2E1A"
          strokeWidth={0.015}
        />
      ))}
    </g>
  );
}
