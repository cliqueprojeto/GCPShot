const TOOLBAR_WIDTH = 720
const TOOLBAR_HEIGHT = 46
const TOOLBAR_OPTIONS_HEIGHT = 52
const TOOLBAR_GAP = 14

export type Point = { x: number; y: number }

export type CaptureRect = {
  x: number
  y: number
  width: number
  height: number
}

export function createRect(start: Point, end: Point): CaptureRect {
  const x = Math.min(start.x, end.x)
  const y = Math.min(start.y, end.y)

  return {
    x,
    y,
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y)
  }
}

export function clampToolbarPosition(position: Point, hasOptionsRow = false): Point {
  const toolbarBlockHeight = TOOLBAR_HEIGHT + (hasOptionsRow ? TOOLBAR_OPTIONS_HEIGHT + 8 : 0)

  return {
    x: Math.max(12, Math.min(position.x, window.innerWidth - TOOLBAR_WIDTH - 12)),
    y: Math.max(14, Math.min(position.y, window.innerHeight - toolbarBlockHeight - 14))
  }
}

export function getToolbarPositionForRect(rect: CaptureRect, hasOptionsRow = false): Point {
  const toolbarBlockHeight = TOOLBAR_HEIGHT + (hasOptionsRow ? TOOLBAR_OPTIONS_HEIGHT + 8 : 0)
  const centerX = rect.x + rect.width / 2 - TOOLBAR_WIDTH / 2
  let y = rect.y + rect.height + TOOLBAR_GAP

  if (y + toolbarBlockHeight > window.innerHeight - 14) {
    y = rect.y - toolbarBlockHeight - TOOLBAR_GAP
  }

  if (y < 14) {
    y = rect.y + rect.height + TOOLBAR_GAP
  }

  return clampToolbarPosition({ x: centerX, y }, hasOptionsRow)
}

export type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'move'

const MIN_SELECTION_SIZE = 12
const HANDLE_HIT_SIZE = 12

export function clampRectToViewport(
  rect: CaptureRect,
  viewport: { width: number; height: number }
): CaptureRect {
  const width = Math.max(MIN_SELECTION_SIZE, Math.min(rect.width, viewport.width))
  const height = Math.max(MIN_SELECTION_SIZE, Math.min(rect.height, viewport.height))
  const x = Math.max(0, Math.min(rect.x, viewport.width - width))
  const y = Math.max(0, Math.min(rect.y, viewport.height - height))

  return { x, y, width, height }
}

export function resizeSelectionRect(
  origin: CaptureRect,
  handle: ResizeHandle,
  dx: number,
  dy: number,
  viewport: { width: number; height: number }
): CaptureRect {
  if (handle === 'move') {
    return clampRectToViewport(
      {
        x: origin.x + dx,
        y: origin.y + dy,
        width: origin.width,
        height: origin.height
      },
      viewport
    )
  }

  let { x, y, width, height } = origin

  if (handle === 'nw' || handle === 'w' || handle === 'sw') {
    const nextX = x + dx
    const nextWidth = width - dx
    if (nextWidth >= MIN_SELECTION_SIZE) {
      x = nextX
      width = nextWidth
    }
  }

  if (handle === 'ne' || handle === 'e' || handle === 'se') {
    width = Math.max(MIN_SELECTION_SIZE, width + dx)
  }

  if (handle === 'nw' || handle === 'n' || handle === 'ne') {
    const nextY = y + dy
    const nextHeight = height - dy
    if (nextHeight >= MIN_SELECTION_SIZE) {
      y = nextY
      height = nextHeight
    }
  }

  if (handle === 'sw' || handle === 's' || handle === 'se') {
    height = Math.max(MIN_SELECTION_SIZE, height + dy)
  }

  return clampRectToViewport({ x, y, width, height }, viewport)
}

export function getSelectionResizeHandle(point: Point, rect: CaptureRect): ResizeHandle | null {
  const { x, y, width, height } = rect
  const midX = x + width / 2
  const midY = y + height / 2

  const near = (px: number, py: number): boolean =>
    Math.abs(point.x - px) <= HANDLE_HIT_SIZE && Math.abs(point.y - py) <= HANDLE_HIT_SIZE

  const handles: Array<[ResizeHandle, number, number]> = [
    ['nw', x, y],
    ['n', midX, y],
    ['ne', x + width, y],
    ['e', x + width, midY],
    ['se', x + width, y + height],
    ['s', midX, y + height],
    ['sw', x, y + height],
    ['w', x, midY]
  ]

  for (const [handle, px, py] of handles) {
    if (near(px, py)) {
      return handle
    }
  }

  if (point.x >= x && point.x <= x + width && point.y >= y && point.y <= y + height) {
    return 'move'
  }

  return null
}

export function getSelectionHandlePositions(rect: CaptureRect): Array<{ handle: ResizeHandle; x: number; y: number }> {
  const { x, y, width, height } = rect
  const midX = x + width / 2
  const midY = y + height / 2

  return [
    { handle: 'nw', x, y },
    { handle: 'n', x: midX, y },
    { handle: 'ne', x: x + width, y },
    { handle: 'e', x: x + width, y: midY },
    { handle: 'se', x: x + width, y: y + height },
    { handle: 's', x: midX, y: y + height },
    { handle: 'sw', x, y: y + height },
    { handle: 'w', x, y: midY }
  ]
}

export function cursorForResizeHandle(handle: ResizeHandle): string {
  switch (handle) {
    case 'nw':
    case 'se':
      return 'nwse-resize'
    case 'ne':
    case 'sw':
      return 'nesw-resize'
    case 'n':
    case 's':
      return 'ns-resize'
    case 'e':
    case 'w':
      return 'ew-resize'
    default:
      return 'move'
  }
}

export function eventMatchesShortcut(event: KeyboardEvent, shortcut: string): boolean {
  const parts = shortcut.split('+').map((part) => part.trim())
  const key = parts[parts.length - 1] ?? ''
  const commandOrControl = parts.includes('CommandOrControl') || parts.includes('CmdOrCtrl')
  const mac = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform || navigator.userAgent)
  const needsCtrl = parts.includes('Ctrl') || parts.includes('Control') || (commandOrControl && !mac)
  const needsAlt = parts.includes('Alt')
  const needsShift = parts.includes('Shift')
  const needsMeta = parts.includes('Super') || parts.includes('Command') || parts.includes('Cmd') || (commandOrControl && mac)

  const keyMap: Record<string, string> = {
    Enter: 'Return',
    Escape: 'Esc',
    ' ': 'Space',
    ArrowUp: 'Up',
    ArrowDown: 'Down',
    ArrowLeft: 'Left',
    ArrowRight: 'Right'
  }

  const physicalKey = /^Key[A-Z]$/.test(event.code) ? event.code.slice(3) : /^Digit[0-9]$/.test(event.code) ? event.code.slice(5) : null
  const eventKey = physicalKey ?? keyMap[event.key] ?? (event.key.length === 1 ? event.key.toUpperCase() : event.key)

  return (
    event.ctrlKey === needsCtrl &&
    event.altKey === needsAlt &&
    event.shiftKey === needsShift &&
    event.metaKey === needsMeta &&
    eventKey.toUpperCase() === key.toUpperCase()
  )
}
