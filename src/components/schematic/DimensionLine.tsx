interface DimensionLineProps {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Perpendicular offset from the measured edge (positive = down/right) */
  offset: number;
  label: string;
}

export default function DimensionLine({ x1, y1, x2, y2, offset, label }: DimensionLineProps) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 0.01) return null;

  // Perpendicular unit vector
  const nx = -dy / len;
  const ny = dx / len;

  // Offset dimension line endpoints
  const ox1 = x1 + nx * offset;
  const oy1 = y1 + ny * offset;
  const ox2 = x2 + nx * offset;
  const oy2 = y2 + ny * offset;

  // Extension lines: from near the wall to just past the dimension line
  const extGap = Math.sign(offset) * 0.06;
  const extOver = Math.sign(offset) * 0.08;

  // Text position (midpoint)
  const tx = (ox1 + ox2) / 2;
  const ty = (oy1 + oy2) / 2;

  // Text rotation — keep readable (never upside-down)
  let angle = Math.atan2(dy, dx) * (180 / Math.PI);
  if (angle > 90) angle -= 180;
  if (angle < -90) angle += 180;

  const textOffset = -Math.sign(offset) * 0.12;

  return (
    <g stroke="#888" strokeWidth={0.02} fill="none">
      {/* Extension lines */}
      <line
        x1={x1 + nx * extGap}
        y1={y1 + ny * extGap}
        x2={ox1 + nx * extOver}
        y2={oy1 + ny * extOver}
      />
      <line
        x1={x2 + nx * extGap}
        y1={y2 + ny * extGap}
        x2={ox2 + nx * extOver}
        y2={oy2 + ny * extOver}
      />

      {/* Dimension line */}
      <line x1={ox1} y1={oy1} x2={ox2} y2={oy2} />

      {/* Tick marks (perpendicular) */}
      <line
        x1={ox1 - nx * 0.06}
        y1={oy1 - ny * 0.06}
        x2={ox1 + nx * 0.06}
        y2={oy1 + ny * 0.06}
        strokeWidth={0.03}
      />
      <line
        x1={ox2 - nx * 0.06}
        y1={oy2 - ny * 0.06}
        x2={ox2 + nx * 0.06}
        y2={oy2 + ny * 0.06}
        strokeWidth={0.03}
      />

      {/* Label */}
      <text
        x={tx + nx * textOffset}
        y={ty + ny * textOffset}
        textAnchor="middle"
        dominantBaseline="central"
        transform={`rotate(${angle}, ${tx + nx * textOffset}, ${ty + ny * textOffset})`}
        fontSize={0.22}
        fontFamily="system-ui, sans-serif"
        fill="#555"
        stroke="none"
      >
        {label}
      </text>
    </g>
  );
}
