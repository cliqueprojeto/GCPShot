import { measureAngle, measureLabel, type MeasurePoint } from '../shared/measurement'

export function MeasurementLine({ from, to, pixelsPerCm, color, size }: { from: MeasurePoint; to: MeasurePoint; pixelsPerCm?: number; color: string; size: number }) {
  const label = measureLabel(from, to, pixelsPerCm), angle = Math.atan2(to.y - from.y, to.x - from.x), head = Math.max(10, size * 3)
  return <g className="measurement-line" aria-label={label}>
    <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={color} strokeWidth={size} />
    {([[from, angle + Math.PI], [to, angle]] as const).map(([point, direction], index) => <polyline key={index} points={`${point.x - head * Math.cos(direction - .45)},${point.y - head * Math.sin(direction - .45)} ${point.x},${point.y} ${point.x - head * Math.cos(direction + .45)},${point.y - head * Math.sin(direction + .45)}`} fill="none" stroke={color} strokeWidth={size} />)}
    <g transform={`translate(${(from.x + to.x) / 2} ${(from.y + to.y) / 2}) rotate(${measureAngle(from, to) * 180 / Math.PI})`}>
      <rect x={-label.length * 5 - 4} y={-26} width={label.length * 10 + 8} height={22} fill="white" rx={2} />
      <text textAnchor="middle" y={-7} fill={color} fontSize={16} fontWeight={600}>{label}</text>
    </g>
  </g>
}
