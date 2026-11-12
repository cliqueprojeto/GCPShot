import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { execFile } from 'node:child_process'
import { parseGnomeShortcuts, parseKdeShortcuts, shortcutIdentity } from '../shared/shortcuts'

export type DesktopKind = 'kde' | 'gnome' | 'other'
export type DesktopShortcuts = { desktop: DesktopKind; label: string; reserved: Set<string> }

export function detectDesktop(): DesktopKind {
  const value = `${process.env.XDG_CURRENT_DESKTOP ?? ''}:${process.env.DESKTOP_SESSION ?? ''}`.toLowerCase()
  if (value.includes('kde') || value.includes('plasma')) return 'kde'
  if (value.includes('gnome') || value.includes('unity') || value.includes('ubuntu') || value.includes('budgie') || value.includes('cinnamon')) return 'gnome'
  return 'other'
}

function gsettings(schema: string): Promise<string> {
  return new Promise((resolve) => execFile('gsettings', ['list-recursively', schema], { timeout: 3000 }, (error, stdout) => resolve(error ? '' : stdout)))
}

/** Reads the shortcuts the Linux desktop itself already uses, so suggestions never collide with them. */
export async function readDesktopShortcuts(): Promise<DesktopShortcuts> {
  const desktop = process.platform === 'linux' ? detectDesktop() : 'other'
  const values: string[] = []
  if (desktop === 'kde') {
    const config = process.env.XDG_CONFIG_HOME || join(homedir(), '.config')
    values.push(...parseKdeShortcuts(await readFile(join(config, 'kglobalshortcutsrc'), 'utf8').catch(() => '')))
  } else if (desktop === 'gnome') {
    const schemas = ['org.gnome.desktop.wm.keybindings', 'org.gnome.shell.keybindings', 'org.gnome.settings-daemon.plugins.media-keys', 'org.gnome.mutter.keybindings', 'org.gnome.mutter.wayland.keybindings', 'org.cinnamon.desktop.keybindings.wm']
    for (const output of await Promise.all(schemas.map(gsettings))) values.push(...parseGnomeShortcuts(output))
  }
  const label = desktop === 'kde' ? 'KDE Plasma' : desktop === 'gnome' ? 'GNOME' : ''
  return { desktop, label, reserved: new Set(values.map((value) => shortcutIdentity(value, process.platform))) }
}
