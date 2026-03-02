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
  const extOver = Math.sign(offset) * 0.10;

  // Text position (midpoint of dimension line)
  const tx = (ox1 + ox2) / 2;
  const ty = (oy1 + oy2) / 2;

  // Text rotation — keep readable (never upside-down)
  let angle = Math.atan2(dy, dx) * (180 / Math.PI);
  if (angle > 90) angle -= 180;
  if (angle < -90) angle += 180;

  // Estimate label bounding box for the white background
  const charW = 0.13;
  const labelW = label.length * charW + 0.1;
  const labelH = 0.26;

  return (
    <g stroke="#777" strokeWidth={0.02} fill="none">
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

      {/* Tick marks (perpendicular slash style) */}
      <line
        x1={ox1 - nx * 0.06 - dx / len * 0.04}
        y1={oy1 - ny * 0.06 - dy / len * 0.04}
        x2={ox1 + nx * 0.06 + dx / len * 0.04}
        y2={oy1 + ny * 0.06 + dy / len * 0.04}
        strokeWidth={0.025}
      />
      <line
        x1={ox2 - nx * 0.06 - dx / len * 0.04}
        y1={oy2 - ny * 0.06 - dy / len * 0.04}
        x2={ox2 + nx * 0.06 + dx / len * 0.04}
        y2={oy2 + ny * 0.06 + dy / len * 0.04}
        strokeWidth={0.025}
      />

      {/* White background behind label to prevent overlap */}
      <rect
        x={tx - labelW / 2}
        y={ty - labelH / 2}
        width={labelW}
        height={labelH}
        fill="white"
        stroke="none"
        transform={`rotate(${angle}, ${tx}, ${ty})`}
      />

      {/* Label */}
      <text
        x={tx}
        y={ty}
        textAnchor="middle"
        dominantBaseline="central"
        transform={`rotate(${angle}, ${tx}, ${ty})`}
        fontSize={0.22}
        fontWeight={600}
        fontFamily="system-ui, sans-serif"
        fill="#444"
        stroke="none"
      >
        {label}
      </text>
    </g>
  );
}
