'use client';

import { useMemo } from 'react';
import { useConfigStore } from '@/store/useConfigStore';
import { POST_SIZE, POST_SPACING } from '@/lib/constants';

const POST_COLOR = '#A08050'; // timber color

interface OverkappingSectionProps {
  sectionWidth: number;
  offsetX: number;
}

export default function OverkappingSection({ sectionWidth, offsetX }: OverkappingSectionProps) {
  const { depth, height } = useConfigStore((s) => s.config.dimensions);

  const posts = useMemo(() => {
    const positions: [number, number, number][] = [];
    const halfDepth = depth / 2;
    const halfWidth = sectionWidth / 2;

    // Posts along depth (front-back edges) on left and right sides
    const depthPosts = Math.max(2, Math.floor(depth / POST_SPACING) + 1);
    const depthStep = depth / (depthPosts - 1);

    for (let i = 0; i < depthPosts; i++) {
      const z = -halfDepth + i * depthStep;
      // Left edge
      positions.push([offsetX - halfWidth, height / 2, z]);
      // Right edge
      positions.push([offsetX + halfWidth, height / 2, z]);
    }

    // Posts along width (front and back edges), excluding corners already placed
    const widthPosts = Math.max(2, Math.floor(sectionWidth / POST_SPACING) + 1);
    if (widthPosts > 2) {
      const widthStep = sectionWidth / (widthPosts - 1);
      for (let i = 1; i < widthPosts - 1; i++) {
        const x = offsetX - halfWidth + i * widthStep;
        // Front edge
        positions.push([x, height / 2, halfDepth]);
        // Back edge
        positions.push([x, height / 2, -halfDepth]);
      }
    }

    return positions;
  }, [sectionWidth, offsetX, depth, height]);

  return (
    <group>
      {posts.map((pos, i) => (
        <mesh key={i} position={pos} castShadow>
          <boxGeometry args={[POST_SIZE, height, POST_SIZE]} />
          <meshStandardMaterial color={POST_COLOR} metalness={0.05} roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}
