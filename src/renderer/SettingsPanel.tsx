import { useEffect, useMemo, useState } from 'react'
import type { AppSettings, SettingsShortcutKey } from '../shared/capture'
import { defaultAppSettings } from '../shared/capture'
import type { AppLanguage, TranslationKey } from '../shared/i18n'
import { t } from '../shared/i18n'
import { ActionIcon, ToolIcon, type EditorTool } from './icons'
import { Settings2, Keyboard, FileImage, X } from 'lucide-react'
import type { GlobalShortcutKey, ShortcutInfo } from '../shared/shortcuts'
import { globalShortcutKeys } from '../shared/shortcuts'
import { UpdatesSection } from './UpdatesSection'
import './settings.css'

export type SettingsTab = 'general' | 'shortcuts' | 'formats' | 'video' | 'audio'

type ShortcutField = {
  key: SettingsShortcutKey
  labelKey: TranslationKey
  icon?: EditorTool | 'copy' | 'save' | 'print' | 'whatsapp' | 'undo' | 'redo' | 'close'
}

const shortcutFields: ShortcutField[] = [
  { key: 'captureShortcut', labelKey: 'shortcutCapture', icon: 'select' },
  { key: 'fullscreenShortcut', labelKey: 'shortcutFullscreen', icon: 'select' },
  { key: 'studioShortcut', labelKey: 'shortcutStudio', icon: 'select' },
  { key: 'liveColorShortcut', labelKey: 'shortcutLiveColor', icon: 'magnifier' },
  { key: 'selectShortcut', labelKey: 'shortcutSelect', icon: 'select' },
  { key: 'moveShortcut', labelKey: 'shortcutMove', icon: 'move' },
  { key: 'penShortcut', labelKey: 'shortcutPen', icon: 'pen' },
  { key: 'arrowShortcut', labelKey: 'shortcutArrow', icon: 'arrow' },
  { key: 'magnifierShortcut', labelKey: 'shortcutMagnifier', icon: 'magnifier' },
  { key: 'blurShortcut', labelKey: 'shortcutBlur', icon: 'blur' },
  { key: 'pixelateShortcut', labelKey: 'shortcutPixelate', icon: 'pixelate' },
  { key: 'textShortcut', labelKey: 'shortcutText', icon: 'text' },
  { key: 'bubbleShortcut', labelKey: 'shortcutBubble', icon: 'bubble' },
  { key: 'stampShortcut', labelKey: 'shortcutStamp', icon: 'stamp' },
  { key: 'numStampShortcut', labelKey: 'shortcutNumStamp', icon: 'numStamp' },
  { key: 'rectShortcut', labelKey: 'shortcutRect', icon: 'rect' },
  { key: 'ellipseShortcut', labelKey: 'shortcutEllipse', icon: 'ellipse' },
  { key: 'lineShortcut', labelKey: 'shortcutLine', icon: 'line' },
  { key: 'starShortcut', labelKey: 'shortcutStar', icon: 'star' },
  { key: 'copyShortcut', labelKey: 'shortcutCopy', icon: 'copy' },
  { key: 'saveShortcut', labelKey: 'shortcutSave', icon: 'save' },
  { key: 'printShortcut', labelKey: 'shortcutPrint', icon: 'print' },
  { key: 'whatsappShortcut', labelKey: 'shortcutWhatsapp', icon: 'whatsapp' },
  { key: 'undoShortcut', labelKey: 'shortcutUndo', icon: 'undo' },
  { key: 'redoShortcut', labelKey: 'shortcutRedo', icon: 'redo' },
  { key: 'cancelShortcut', labelKey: 'shortcutCancel', icon: 'close' }
]

function shortcutFromKeyboardEvent(event: React.KeyboardEvent<HTMLInputElement>): string | null {
  const keyMap: Record<string, string> = {
    ' ': 'Space',
    Control: '',
    Shift: '',
    Alt: '',
    Meta: '',
    Escape: 'Esc',
    ArrowUp: 'Up',
    ArrowDown: 'Down',
    ArrowLeft: 'Left',
    ArrowRight: 'Right'
  }
  const physicalKey = /^Key[A-Z]$/.test(event.code) ? event.code.slice(3) : /^Digit[0-9]$/.test(event.code) ? event.code.slice(5) : null
  const baseKey = physicalKey ?? keyMap[event.key] ?? event.key.toUpperCase()

  if (!baseKey) {
    return null
  }

  const parts = [
    event.ctrlKey ? 'Ctrl' : '',
    event.altKey ? 'Alt' : '',
    event.shiftKey ? 'Shift' : '',
    event.metaKey ? 'Super' : '',
    baseKey.length === 1 ? baseKey.toUpperCase() : baseKey
  ].filter(Boolean)

  return parts.length >= 1 ? parts.join('+') : null
}

function ShortcutIcon({ icon }: { icon: ShortcutField['icon'] }): JSX.Element | null {
  if (!icon) {
    return null
  }

  if (icon === 'copy' || icon === 'save' || icon === 'print' || icon === 'whatsapp' || icon === 'undo' || icon === 'redo' || icon === 'close') {
    return <ActionIcon type={icon} />
  }

  return <ToolIcon tool={icon} />
}

type SettingsPanelProps = {
  settings: AppSettings
  language: AppLanguage
  settingsTab: SettingsTab
  recordingShortcut: SettingsShortcutKey | null
  overlay?: boolean
  onTabChange: (tab: SettingsTab) => void
  onClose: () => void
  onUpdateSetting: (patch: Partial<AppSettings>) => Promise<void> | void
  onReset: () => void
  onRecordingShortcutChange: (key: SettingsShortcutKey | null) => void
}

export function SettingsPanel({
  settings,
  language,
  settingsTab,
  recordingShortcut,
  overlay = false,
  onTabChange,
  onClose,
  onUpdateSetting,
  onReset,
  onRecordingShortcutChange
}: SettingsPanelProps): JSX.Element {
  const [shortcutDrafts, setShortcutDrafts] = useState<Partial<Record<SettingsShortcutKey, string>>>({})
  const [shortcutInfo, setShortcutInfo] = useState<ShortcutInfo | null>(null)
  const [shortcutError, setShortcutError] = useState('')
  const [savingShortcut, setSavingShortcut] = useState(false)

  useEffect(() => {
    let active = true
    void window.gcpshot.setShortcutEditing(true).then(() => window.gcpshot.getShortcutInfo()).then((info) => { if (active) setShortcutInfo(info) }).catch((error) => { if (active) setShortcutError(String(error)) })
    return () => { active = false; void window.gcpshot.setShortcutEditing(false).catch(() => {}) }
  }, [])

  useEffect(() => {
    setShortcutDrafts({})
  }, [settings])

  function displayShortcut(key: SettingsShortcutKey): string {
    return shortcutDrafts[key] ?? settings[key]
  }

  async function commitShortcut(key: SettingsShortcutKey, shortcut: string): Promise<void> {
    setShortcutDrafts((current) => ({ ...current, [key]: shortcut }))
    onRecordingShortcutChange(null)
    setSavingShortcut(true); setShortcutError('')
    try {
      await onUpdateSetting({ [key]: shortcut } as Partial<AppSettings>)
      setShortcutInfo(await window.gcpshot.getShortcutInfo())
    } catch (error) { setShortcutError(error instanceof Error ? error.message.replace(/^Error invoking remote method '[^']+': Error: /, '') : 'Nao foi possivel salvar o atalho.') }
    finally { setSavingShortcut(false) }
  }

  const mainOptions = useMemo(() => [...new Set([settings.captureShortcut, ...(shortcutInfo?.suggestions.captureShortcut ?? [])])], [settings.captureShortcut, shortcutInfo])

  const tabs = useMemo(
    () =>
      [
        { id: 'general' as const, label: t(language, 'tabGeneral'), icon: Settings2 },
        { id: 'shortcuts' as const, label: t(language, 'tabShortcuts'), icon: Keyboard },
        { id: 'formats' as const, label: t(language, 'tabFormats'), icon: FileImage }
      ],
    [language]
  )

  return (
    <section className={overlay ? 'settings-backdrop capture-settings-backdrop' : 'settings-backdrop'} role="dialog" aria-modal="true" aria-labelledby="settings-title" onKeyDown={(event) => {
      if (event.key === 'Escape' && !recordingShortcut) { event.preventDefault(); event.stopPropagation(); onClose() }
      if (event.key === 'Tab') {
        const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled)')).filter((node) => node.offsetParent !== null)
        const first = controls[0], last = controls.at(-1)
        if (event.shiftKey && event.target === first) { event.preventDefault(); last?.focus() }
        if (!event.shiftKey && event.target === last) { event.preventDefault(); first?.focus() }
      }
    }}>
      <div className="settings-window">
        <header>
          <div>
            <p className="eyebrow">{t(language, 'preferences')}</p>
            <h3 id="settings-title">{t(language, 'settingsTitle')}</h3>
          </div>
          <button className="icon-button" title="Fechar" aria-label="Fechar configurações" onClick={onClose}>
            <X size={19} />
          </button>
        </header>

        <div className="settings-tabs" role="tablist" aria-label={t(language, 'settingsTitle')}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={settingsTab === tab.id ? 'active' : ''}
              role="tab"
              aria-selected={settingsTab === tab.id}
              onClick={() => onTabChange(tab.id)}
            >
              <tab.icon size={18} />{tab.label}
            </button>
          ))}
        </div>
        <div className="settings-content" role="tabpanel">
        {settingsTab === 'general' && (
          <div className="settings-list">
            <label>
              <input
                type="checkbox"
                checked={settings.startWithWindows}
                onChange={(event) => onUpdateSetting({ startWithWindows: event.currentTarget.checked })}
              />
              <span>{t(language, 'startWithWindows')}</span>
            </label>
            <label>
              <input
                type="checkbox"
                checked={settings.minimizeToTray}
                onChange={(event) => onUpdateSetting({ minimizeToTray: event.currentTarget.checked })}
              />
              <span>{t(language, 'minimizeToTray')}</span>
            </label>
            <label>
              <input
                type="checkbox"
                checked={settings.showNotifications}
                onChange={(event) => onUpdateSetting({ showNotifications: event.currentTarget.checked })}
              />
              <span>{t(language, 'showNotifications')}</span>
            </label>
            <label>
              <input
                type="checkbox"
                checked={settings.captureCursor}
                onChange={(event) => onUpdateSetting({ captureCursor: event.currentTarget.checked })}
              />
              <span>{t(language, 'captureCursor')}</span>
            </label>
            <UpdatesSection settings={settings} onUpdateSetting={onUpdateSetting} />
          </div>
        )}

        {settingsTab === 'shortcuts' && (
          <>
            <p className="settings-hint">
              Sistema detectado: {shortcutInfo?.platform ?? '…'}.{' '}
              {shortcutInfo?.reservedCount ? `${shortcutInfo.reservedCount} atalhos do ${shortcutInfo.desktop || 'sistema'} foram lidos e excluidos das sugestoes. ` : ''}
              {shortcutInfo?.portal
                ? 'No Wayland o sistema pode pedir uma confirmacao unica para liberar os atalhos do GCPShot.'
                : 'As sugestoes abaixo foram testadas agora e estao livres neste computador.'}
            </p>
            {shortcutInfo?.issues.map((issue) => <p className="settings-hint" key={issue}>{issue}</p>)}
            {shortcutError && <p role="alert" className="shortcut-error">{shortcutError}</p>}
            <div className="settings-grid">
              <label>
                <span>{t(language, 'mainShortcut')}</span>
                <select
                  value={mainOptions.includes(settings.captureShortcut) ? settings.captureShortcut : 'custom'}
                  onChange={(event) => {
                    if (event.currentTarget.value !== 'custom') {
                      void commitShortcut('captureShortcut', event.currentTarget.value)
                    }
                  }}
                >
                  {mainOptions.map((shortcut) => (
                    <option key={shortcut} value={shortcut}>
                      {shortcut}
                    </option>
                  ))}
                  <option value="custom">{t(language, 'custom')}</option>
                </select>
              </label>
              <label>
                <span>{t(language, 'recordShortcut')}</span>
                <div className="shortcut-recorder">
                  <input
                    readOnly={recordingShortcut === 'captureShortcut'}
                    aria-label="Atalho principal de captura"
                    value={
                      recordingShortcut === 'captureShortcut'
                        ? t(language, 'recording')
                        : displayShortcut('captureShortcut')
                    }
                    onChange={(event) => setShortcutDrafts((current) => ({ ...current, captureShortcut: event.target.value }))}
                    onKeyDown={(event) => {
                      if (recordingShortcut !== 'captureShortcut') {
                        return
                      }

                      event.preventDefault()
                      const shortcut = shortcutFromKeyboardEvent(event)

                      if (shortcut) {
                        void commitShortcut('captureShortcut', shortcut)
                      }
                    }}
                  />
                  <button
                    type="button"
                    disabled={savingShortcut}
                    onClick={(event) => { onRecordingShortcutChange(recordingShortcut === 'captureShortcut' ? null : 'captureShortcut'); (event.currentTarget.previousElementSibling as HTMLInputElement)?.focus() }}
                  >
                    {recordingShortcut === 'captureShortcut' ? t(language, 'listening') : t(language, 'record')}
                  </button>
                  <button type="button" disabled={savingShortcut} onClick={() => void commitShortcut('captureShortcut', displayShortcut('captureShortcut'))}>Salvar</button>
                </div>
              </label>
            </div>
            <div className="settings-list compact">
              <label>
                <input
                  type="checkbox"
                  checked={settings.printScreenShortcut}
                  onChange={(event) => onUpdateSetting({ printScreenShortcut: event.currentTarget.checked })}
                />
                <span>{t(language, 'printScreenCapture')}</span>
              </label>
            </div>
            <div className="shortcut-grid">
              {shortcutFields.map((field) => (
                <label key={field.key} className="shortcut-row">
                  <span className="shortcut-row-label">
                    <span className="shortcut-row-icon">{field.icon ? <ShortcutIcon icon={field.icon} /> : null}</span>
                    {t(language, field.labelKey)}
                  </span>
                  <div className="shortcut-recorder">
                    <input
                      readOnly={recordingShortcut === field.key}
                      aria-label={`Atalho ${t(language, field.labelKey)}`}
                      value={
                        recordingShortcut === field.key ? t(language, 'recording') : displayShortcut(field.key)
                      }
                      onChange={(event) => setShortcutDrafts((current) => ({ ...current, [field.key]: event.target.value }))}
                      onKeyDown={(event) => {
                        if (recordingShortcut !== field.key) {
                          return
                        }

                        event.preventDefault()
                        const shortcut = shortcutFromKeyboardEvent(event)

                        if (shortcut) {
                          void commitShortcut(field.key, shortcut)
                        }
                      }}
                    />
                    <button
                      type="button"
                      disabled={savingShortcut}
                      onClick={(event) => { onRecordingShortcutChange(recordingShortcut === field.key ? null : field.key); (event.currentTarget.previousElementSibling as HTMLInputElement)?.focus() }}
                    >
                      {recordingShortcut === field.key ? t(language, 'listening') : t(language, 'record')}
                    </button>
                    <button type="button" disabled={savingShortcut} aria-label={`Salvar atalho ${t(language, field.labelKey)}`} onClick={() => void commitShortcut(field.key, displayShortcut(field.key))}>Salvar</button>
                  </div>
                  {globalShortcutKeys.includes(field.key as GlobalShortcutKey) && <select aria-label={`Sugestoes ${t(language, field.labelKey)}`} value="" disabled={savingShortcut} onChange={(event) => { if (event.target.value) void commitShortcut(field.key, event.target.value) }}><option value="">{shortcutInfo ? `Sugestoes livres (${shortcutInfo.suggestions[field.key as GlobalShortcutKey]?.length ?? 0})` : 'Verificando teclas livres…'}</option>{shortcutInfo?.suggestions[field.key as GlobalShortcutKey]?.map((value) => <option value={value} key={value}>{value}</option>)}</select>}
                </label>
              ))}
            </div>
          </>
        )}

        {settingsTab === 'formats' && (
          <>
            <div className="settings-grid">
              <label>
                <span>{t(language, 'defaultFormat')}</span>
                <select
                  value={settings.defaultFormat}
                  onChange={(event) =>
                    onUpdateSetting({ defaultFormat: event.currentTarget.value as AppSettings['defaultFormat'] })
                  }
                >
                  <option value="png">PNG</option>
                  <option value="jpg">JPG</option>
                </select>
              </label>
              <label>
                <span>{t(language, 'language')}</span>
                <select
                  value={settings.language}
                  onChange={(event) =>
                    onUpdateSetting({ language: event.currentTarget.value as AppSettings['language'] })
                  }
                >
                  <option value="auto">{t(language, 'languageAuto')}</option>
                  <option value="pt-BR">Português (Brasil)</option>
                  <option value="en">English</option>
                  <option value="es">Español</option>
                </select>
              </label>
            </div>
            <button className="reset-button" type="button" onClick={onReset}>
              {t(language, 'resetSettings')}
            </button>
          </>
        )}
        </div>
      </div>
    </section>
  )
}

export { shortcutFromKeyboardEvent }
