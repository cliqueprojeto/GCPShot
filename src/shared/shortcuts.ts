export const globalShortcutKeys = ['captureShortcut', 'fullscreenShortcut', 'studioShortcut', 'liveColorShortcut'] as const
export type GlobalShortcutKey = typeof globalShortcutKeys[number]
export type ShortcutInfo = {
  platform: string
  desktop: string
  suggestions: Record<GlobalShortcutKey, string[]>
  issues: string[]
  portal: boolean
  /** Shortcuts already used by the operating system/desktop, as found in its own configuration. */
  reservedCount: number
}

/** Mnemonic keys per action, easiest first. Sets are disjoint so suggestions never collide between actions. */
const actionKeys: Record<GlobalShortcutKey, string[]> = {
  captureShortcut: ['S', 'R', 'A', '1', 'F6'],
  fullscreenShortcut: ['F', 'T', 'G', '2', 'F7'],
  studioShortcut: ['E', 'O', 'J', '3', 'F8'],
  liveColorShortcut: ['C', 'K', 'Q', '4', 'F9']
}

/** Modifier groups ranked by how easy they are to press on each OS. */
function modifierGroups(platform: string): string[] {
  if (platform === 'darwin') return ['Ctrl+Shift', 'Command+Shift', 'Ctrl+Alt', 'Command+Alt+Shift']
  if (platform === 'win32') return ['Alt+Shift', 'Ctrl+Shift', 'Ctrl+Alt+Shift']
  return ['Alt+Shift', 'Ctrl+Alt', 'Super+Shift', 'Ctrl+Shift', 'Ctrl+Alt+Shift']
}

const isLetter = (key: string): boolean => /^[A-Z]$/.test(key)
const isFunction = (key: string): boolean => /^F\d+$/.test(key)

/** Static rules for combinations that each OS or common apps already use (global capture would steal them). */
function staticallyReserved(platform: string, modifiers: string, key: string): boolean {
  // Ctrl+Shift+letter / Cmd+Shift+letter are everyday app shortcuts (Save As, DevTools, new private window…).
  if ((modifiers === 'Ctrl+Shift' && platform !== 'darwin') || modifiers === 'Command+Shift') { if (isLetter(key)) return true }
  if (platform === 'win32') {
    // On ABNT2/international layouts Ctrl+Alt is AltGr (Ctrl+Alt+E = €, Ctrl+Alt+Q = /).
    if (modifiers === 'Ctrl+Alt') return true
  }
  if (platform === 'darwin') {
    if (modifiers === 'Command+Shift' && ['3', '4', '5', '6'].includes(key)) return true // macOS screenshots
    if (modifiers === 'Ctrl+Alt' && isFunction(key)) return true
  }
  if (platform === 'linux') {
    if (modifiers === 'Ctrl+Alt' && (isFunction(key) || ['T', 'L', 'D', 'S'].includes(key))) return true // VT switch, terminal, lock, show desktop
    if (modifiers === 'Super+Shift' && ['S', 'R', 'F', 'E', 'C', 'Q', 'T', 'A'].includes(key)) return true // Spectacle/GNOME/tiling defaults
  }
  return false
}

/** All OS-appropriate candidates for an action, easiest first, already excluding statically reserved combos. */
export function shortcutCandidates(platform: string, key: GlobalShortcutKey): string[] {
  const result: string[] = []
  for (const modifiers of modifierGroups(platform)) {
    for (const letter of actionKeys[key]) {
      if (!staticallyReserved(platform, modifiers, letter)) result.push(canonicalShortcut(`${modifiers}+${letter}`))
    }
  }
  return [...new Set(result)]
}

export function canonicalShortcut(value: string): string {
  const aliases: Record<string, string> = { control: 'Ctrl', ctrl: 'Ctrl', primary: 'Ctrl', shift: 'Shift', alt: 'Alt', option: 'Alt', meta: 'Super', super: 'Super', win: 'Super', cmd: 'Command', command: 'Command', commandorcontrol: 'CommandOrControl', cmdorctrl: 'CommandOrControl', escape: 'Esc', esc: 'Esc', enter: 'Return', return: 'Return', print: 'PrintScreen', printscreen: 'PrintScreen', sysreq: 'PrintScreen', space: 'Space', backspace: 'Backspace', delete: 'Delete', del: 'Delete', tab: 'Tab', up: 'Up', down: 'Down', left: 'Left', right: 'Right', home: 'Home', end: 'End', pageup: 'PageUp', pgup: 'PageUp', pagedown: 'PageDown', pgdown: 'PageDown' }
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

/** Parses KDE `kglobalshortcutsrc` content and returns the active shortcuts it binds. */
export function parseKdeShortcuts(content: string): string[] {
  const found: string[] = []
  for (const line of content.split(/\r?\n/)) {
    const match = /^[^\[#=][^=]*=([^,]*),/.exec(line)
    if (!match) continue
    for (const raw of match[1].split('\t')) {
      const value = raw.trim()
      if (value && value !== 'none') found.push(canonicalShortcut(value))
    }
  }
  return found
}

/** Parses `gsettings list-recursively` output (GNOME) into shortcuts like Ctrl+Alt+T. */
export function parseGnomeShortcuts(content: string): string[] {
  const found: string[] = []
  for (const match of content.matchAll(/'((?:<[A-Za-z]+>)*)([^'<>]+)'/g)) {
    const modifiers = [...match[1].matchAll(/<([A-Za-z]+)>/g)].map((item) => item[1])
    if (!modifiers.length && !/^Print$/i.test(match[2])) continue
    const key = match[2].length === 1 ? match[2].toUpperCase() : match[2]
    found.push(canonicalShortcut([...modifiers, key].join('+')))
  }
  return found
}
