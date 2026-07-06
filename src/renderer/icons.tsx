import type { CaptureAction } from '../shared/capture'

export type EditorTool = CaptureAction['tool'] | 'select' | 'move'

export function ToolIcon({ tool }: { tool: EditorTool }): JSX.Element {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeWidth: 2
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="tool-svg">
      {tool === 'select' && <path {...common} d="M5 4l11 8-5 1.5L8.5 19 5 4z" />}
      {tool === 'move' && (
        <>
          <path {...common} d="M12 3v18M3 12h18" />
          <path {...common} d="M12 3l-3 3M12 3l3 3M21 12l-3-3M21 12l-3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3" />
        </>
      )}
      {tool === 'pen' && <path {...common} d="M4 20l4-1 10-10a2.8 2.8 0 0 0-4-4L4 15v5zM13 6l5 5" />}
      {tool === 'arrow' && <path {...common} d="M5 19L19 5M10 5h9v9" />}
      {tool === 'rect' && <rect {...common} x="5" y="6" width="14" height="12" rx="2" />}
      {tool === 'ellipse' && <circle {...common} cx="12" cy="12" r="7" />}
      {tool === 'line' && <path {...common} d="M5 19L19 5" />}
      {tool === 'star' && <path {...common} d="M12 3l2.7 5.5 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.8 1-6.1-4.4-4.3 6.1-.9L12 3z" />}
      {tool === 'magnifier' && (
        <>
          <circle {...common} cx="10.5" cy="10.5" r="5.5" />
          <path {...common} d="M15 15l5 5M8 11h5M10.5 8.5v5" />
        </>
      )}
      {tool === 'blur' && (
        <>
          <path {...common} d="M12 3s5 5.7 5 10a5 5 0 0 1-10 0c0-4.3 5-10 5-10z" />
          <path {...common} d="M9.5 14.5a3 3 0 0 0 4 1.4" opacity=".6" />
        </>
      )}
      {tool === 'pixelate' && (
        <>
          <rect {...common} x="4" y="4" width="6" height="6" />
          <rect {...common} x="14" y="4" width="6" height="6" />
          <rect {...common} x="4" y="14" width="6" height="6" />
          <rect {...common} x="14" y="14" width="6" height="6" />
        </>
      )}
      {tool === 'text' && <path {...common} d="M5 6h14M12 6v12M9 18h6" />}
      {tool === 'bubble' && <path {...common} d="M5 6h14v9H9l-4 4V6z" />}
      {tool === 'stamp' && (
        <>
          <path {...common} d="M9 11h6l1.5 5h-9L9 11z" />
          <path {...common} d="M10 11V7a2 2 0 0 1 4 0v4M5 19h14M7 16h10" />
        </>
      )}
      {tool === 'numStamp' && (
        <>
          <circle {...common} cx="12" cy="12" r="8" />
          <path {...common} d="M9.5 12h5M12 9.5v5" />
        </>
      )}
    </svg>
  )
}

export function ActionIcon({
  type
}: {
  type: 'copy' | 'save' | 'print' | 'whatsapp' | 'undo' | 'redo' | 'clear' | 'close' | 'settings' | 'shapes'
}): JSX.Element {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeWidth: 2
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="tool-svg">
      {type === 'copy' && (
        <>
          <rect {...common} x="8" y="8" width="10" height="10" rx="2" />
          <path {...common} d="M6 16H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </>
      )}
      {type === 'save' && (
        <>
          <path {...common} d="M5 4h12l2 2v14H5z" />
          <path {...common} d="M8 4v6h8M8 20v-6h8v6" />
        </>
      )}
      {type === 'print' && (
        <>
          <path {...common} d="M7 8V4h10v4M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" />
          <path {...common} d="M7 14h10v6H7z" />
        </>
      )}
      {type === 'whatsapp' && (
        <>
          <path {...common} d="M5 19l1-3a7 7 0 1 1 2.6 2.3L5 19z" />
          <path {...common} d="M9.5 8.8c.5 3 2.1 4.7 5.2 5.7l1.1-1.1" />
        </>
      )}
      {type === 'undo' && (
        <>
          <path {...common} d="M9 14 4 9 9 4" />
          <path {...common} d="M4 9h11" />
        </>
      )}
      {type === 'redo' && (
        <>
          <path {...common} d="M15 14l5-5-5-5" />
          <path {...common} d="M20 9H9" />
        </>
      )}
      {type === 'clear' && (
        <>
          <path {...common} d="M4 7h16" />
          <path {...common} d="M9 7V5h6v2M7 7l1 13h8l1-13" />
          <path {...common} d="M10 11v5M14 11v5" />
        </>
      )}
      {type === 'settings' && (
        <>
          <circle {...common} cx="12" cy="12" r="3" />
          <path
            {...common}
            d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1a7 7 0 0 0-1.7-1L14.5 3h-5l-.4 3.1a7 7 0 0 0-1.7 1l-2.4-1-2 3.4L5 11a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.4-1a7 7 0 0 0 1.7 1l.4 3.1h5l.4-3.1a7 7 0 0 0 1.7-1l2.4 1 2-3.4-2-1.5a7 7 0 0 0 .1-1z"
          />
        </>
      )}
      {type === 'shapes' && (
        <>
          <rect {...common} x="4" y="5" width="7" height="7" rx="1" />
          <circle {...common} cx="16.5" cy="8.5" r="3.5" />
          <path {...common} d="M6 19l5-5 5 5H6z" />
        </>
      )}
      {type === 'close' && <path {...common} d="M6 6l12 12M18 6L6 18" />}
    </svg>
  )
}
