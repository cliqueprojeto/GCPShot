export type MeasurePoint = { x: number; y: number }
export const defaultPixelsPerCm = 96 / 2.54
export function validMeasureScale(value: number): boolean { return Number.isFinite(value) && value >= 0.01 && value <= 1000000 }
export function measureCm(from: MeasurePoint, to: MeasurePoint, pixelsPerCm = defaultPixelsPerCm): number {
  if (!validMeasureScale(pixelsPerCm)) throw new Error('Escala de medicao invalida.')
  return Math.hypot(to.x - from.x, to.y - from.y) / pixelsPerCm
}
export function measureLabel(from: MeasurePoint, to: MeasurePoint, pixelsPerCm = defaultPixelsPerCm): string {
  return `${measureCm(from, to, pixelsPerCm).toFixed(2).replace('.', ',')} cm`
}
export function measureAngle(from: MeasurePoint, to: MeasurePoint): number {
  const angle = Math.atan2(to.y - from.y, to.x - from.x)
  return angle > Math.PI / 2 ? angle - Math.PI : angle < -Math.PI / 2 ? angle + Math.PI : angle
}
export function drawMeasurement(ctx: CanvasRenderingContext2D, from: MeasurePoint, to: MeasurePoint, label: string, color: string, width: number, scale = 1): void {
  ctx.save()
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = Math.max(1, width); ctx.lineCap = 'round'
  ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke()
  const angle = Math.atan2(to.y - from.y, to.x - from.x), head = Math.max(10 * scale, width * 3)
  for (const [point, direction] of [[from, angle + Math.PI], [to, angle]] as const) {
    ctx.beginPath(); ctx.moveTo(point.x - head * Math.cos(direction - .45), point.y - head * Math.sin(direction - .45))
    ctx.lineTo(point.x, point.y); ctx.lineTo(point.x - head * Math.cos(direction + .45), point.y - head * Math.sin(direction + .45)); ctx.stroke()
  }
  ctx.translate((from.x + to.x) / 2, (from.y + to.y) / 2); ctx.rotate(measureAngle(from, to))
  ctx.font = `600 ${16 * scale}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'
  const textWidth = ctx.measureText(label).width
  ctx.fillStyle = '#ffffff'; ctx.fillRect(-textWidth / 2 - 4 * scale, -26 * scale, textWidth + 8 * scale, 22 * scale)
  ctx.fillStyle = color; ctx.fillText(label, 0, -6 * scale)
  ctx.restore()
}
