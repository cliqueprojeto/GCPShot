export const globalShortcutKeys = ['captureShortcut', 'fullscreenShortcut', 'studioShortcut', 'liveColorShortcut'] as const
export type GlobalShortcutKey = typeof globalShortcutKeys[number]
export type ShortcutInfo = { platform: string; suggestions: Record<GlobalShortcutKey, string[]>; issues: string[]; portal: boolean }

export function shortcutCandidates(platform: string, key: GlobalShortcutKey): string[] {
  const letter = { captureShortcut: 'S', fullscreenShortcut: 'F', studioShortcut: 'E', liveColorShortcut: 'C' }[key]
  const prefix = platform === 'darwin' ? 'Command+Alt+Shift' : 'Ctrl+Alt+Shift'
  return [`${prefix}+${letter}`, `${prefix}+F${{ captureShortcut: 6, fullscreenShortcut: 7, studioShortcut: 8, liveColorShortcut: 9 }[key]}`, `Ctrl+Shift+F${{ captureShortcut: 6, fullscreenShortcut: 7, studioShortcut: 8, liveColorShortcut: 9 }[key]}`]
}

export function canonicalShortcut(value: string): string {
  const aliases: Record<string, string> = { control: 'Ctrl', ctrl: 'Ctrl', shift: 'Shift', alt: 'Alt', option: 'Alt', meta: 'Super', super: 'Super', cmd: 'Command', command: 'Command', commandorcontrol: 'CommandOrControl', cmdorctrl: 'CommandOrControl', escape: 'Esc', esc: 'Esc', enter: 'Return', return: 'Return', printscreen: 'PrintScreen', space: 'Space', backspace: 'Backspace', delete: 'Delete', tab: 'Tab', up: 'Up', down: 'Down', left: 'Left', right: 'Right', home: 'Home', end: 'End', pageup: 'PageUp', pagedown: 'PageDown' }
  const parts = value.trim().split('+').map((part) => aliases[part.trim().toLowerCase()] ?? part.trim().toUpperCase())
  const key = parts.pop() ?? ''
  const order = ['CommandOrControl', 'Command', 'Ctrl', 'Super', 'Alt', 'Shift']
  return [...parts.sort((a, b) => order.indexOf(a) - order.indexOf(b)), key].join('+')
}

export function shortcutIdentity(value: string, platform: string): string {
  return canonicalShortcut(value).replace(/CommandOrControl/g, platform === 'darwin' ? 'Command' : 'Ctrl').replace(/Super/g, platform === 'darwin' ? 'Command' : 'Super').split('+').sort().join('+')
}

export function validGlobalShortcut(value: string): boolean {
  const parts = canonicalShortcut(value).split('+')
  return parts.length > 1 && new Set(parts).size === parts.length && parts.slice(0, -1).every((part) => ['Ctrl', 'Alt', 'Shift', 'Command', 'CommandOrControl', 'Super'].includes(part)) && /^(?:[A-Z0-9]|F(?:[1-9]|1[0-9]|2[0-4])|Space|Return|Tab|Backspace|Delete|Up|Down|Left|Right|Home|End|PageUp|PageDown)$/.test(parts.at(-1) ?? '')
}
