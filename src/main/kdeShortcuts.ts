import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { canonicalShortcut } from '../shared/shortcuts'

/** Qt key codes (Qt::Key / Qt::KeyboardModifier) as kglobalaccel expects them. */
const QT_MODIFIERS: Record<string, number> = { Shift: 0x02000000, Ctrl: 0x04000000, CommandOrControl: 0x04000000, Alt: 0x08000000, Super: 0x10000000, Command: 0x10000000 }
const QT_KEYS: Record<string, number> = {
  Space: 0x20, Esc: 0x01000000, Tab: 0x01000001, Backspace: 0x01000003, Return: 0x01000004, Delete: 0x01000007, PrintScreen: 0x01000009,
  Home: 0x01000010, End: 0x01000011, Left: 0x01000012, Up: 0x01000013, Right: 0x01000014, Down: 0x01000015, PageUp: 0x01000016, PageDown: 0x01000017
}

export function qtKeyCode(accelerator: string): number {
  const parts = canonicalShortcut(accelerator).split('+')
  const key = parts.pop() ?? ''
  let code = QT_KEYS[key] ?? 0
  if (!code && /^[A-Z0-9]$/.test(key)) code = key.charCodeAt(0)
  const fn = /^F(\d{1,2})$/.exec(key)
  if (!code && fn) code = 0x01000030 + Number(fn[1]) - 1
  if (!code) return 0
  for (const modifier of parts) {
    const flag = QT_MODIFIERS[modifier]
    if (!flag) return 0
    code |= flag
  }
  return code
}

type Pending = { prefix: string; resolve: (words: string[]) => void }

/**
 * Global shortcuts on KDE Plasma (Wayland) registered straight in kglobalaccel through the native helper.
 * Chromium's GlobalShortcuts portal on Plasma loses its session and turns Shift+digit into keypad keys,
 * so on KDE GCPShot owns a regular component ("GCPShot" in System Settings › Shortcuts) instead.
 */
export class KdeShortcuts {
  private child: ChildProcessWithoutNullStreams | null = null
  private ready: Promise<boolean> | null = null
  private queue: Pending[] = []
  private handlers = new Map<string, () => void>()

  constructor(private helper: string) {}

  start(): Promise<boolean> {
    if (this.ready) return this.ready
    this.ready = new Promise((resolve) => {
      if (!existsSync(this.helper)) { resolve(false); return }
      const child = spawn(this.helper, ['--kglobalaccel'], { stdio: ['pipe', 'pipe', 'pipe'] })
      this.child = child
      let settled = false
      const done = (value: boolean): void => { if (!settled) { settled = true; resolve(value) } }
      child.on('error', () => done(false))
      child.on('exit', () => {
        this.child = null
        this.ready = null
        for (const pending of this.queue.splice(0)) pending.resolve([])
        done(false)
      })
      child.stderr.on('data', (chunk) => console.warn('GCPShot: atalhos KDE:', String(chunk).trim()))
      createInterface({ input: child.stdout }).on('line', (line) => {
        const words = line.trim().split(' ')
        if (words[0] === 'READY') { done(true); return }
        if (words[0] === 'PRESSED') { this.handlers.get(words[1])?.(); return }
        const index = this.queue.findIndex((pending) => pending.prefix === words[0])
        if (index >= 0) this.queue.splice(index, 1)[0].resolve(words)
      })
      setTimeout(() => done(false), 4000)
    })
    return this.ready
  }

  private request(command: string): Promise<string[]> {
    const child = this.child
    if (!child) return Promise.resolve([])
    return new Promise((resolve) => {
      this.queue.push({ prefix: command.split(' ')[0], resolve })
      child.stdin.write(`${command.replace(/[\r\n]/g, ' ')}\n`)
    })
  }

  /** Binds an action; resolves true only when Plasma actually assigned that exact key. */
  async bind(action: string, accelerator: string, friendly: string, handler: () => void): Promise<boolean> {
    const code = qtKeyCode(accelerator)
    if (!code || !(await this.start())) return false
    const words = await this.request(`SET ${action} ${code} ${friendly}`)
    const ok = Number(words[2]) === code
    if (ok) this.handlers.set(action, handler)
    else { this.handlers.delete(action); if (Number(words[2])) await this.request(`SET ${action} 0 ${friendly}`) }
    return ok
  }

  async unbind(action: string, friendly: string): Promise<void> {
    this.handlers.delete(action)
    if (this.child) await this.request(`SET ${action} 0 ${friendly}`)
  }

  /** Asks Plasma whether a key is free (or already owned by GCPShot). */
  async available(accelerator: string): Promise<boolean> {
    const code = qtKeyCode(accelerator)
    if (!code || !(await this.start())) return false
    const words = await this.request(`AVAIL x ${code}`)
    return words[2] === '1'
  }

  /** Removes leftovers registered by Chromium's portal under the old "gcpshot" component. */
  async purge(component: string): Promise<number> {
    if (!(await this.start())) return 0
    const words = await this.request(`PURGE ${component}`)
    return Number(words[1]) || 0
  }

  stop(): void {
    if (!this.child) return
    this.child.stdin.end('QUIT\n')
  }
}
