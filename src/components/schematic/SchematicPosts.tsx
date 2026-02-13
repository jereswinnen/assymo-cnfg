import { POST_SPACING } from '@/lib/constants';

const POST_SIZE = 0.15;

interface SchematicPostsProps {
  width: number;
  depth: number;
}

export default function SchematicPosts({ width, depth }: SchematicPostsProps) {
  const hw = width / 2;
  const hd = depth / 2;

  const positions: [number, number][] = [];

  // Posts along width edges (front and back)
  const postsW = Math.max(2, Math.floor(width / POST_SPACING) + 1);
  const stepW = width / (postsW - 1);
  for (let i = 0; i < postsW; i++) {
    const x = -hw + i * stepW;
    positions.push([x, hd]); // front
    positions.push([x, -hd]); // back
  }

  // Posts along depth edges (left and right), excluding corners
  const postsD = Math.max(2, Math.floor(depth / POST_SPACING) + 1);
  const stepD = depth / (postsD - 1);
  for (let i = 1; i < postsD - 1; i++) {
    const y = -hd + i * stepD;
    positions.push([-hw, y]); // left
    positions.push([hw, y]); // right
  }

  const half = POST_SIZE / 2;

  return (
    <g>
      {positions.map(([x, y], i) => (
        <rect
          key={i}
          x={x - half}
          y={y - half}
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
