import { useMemo } from 'react'
import type { AppSettings, SettingsShortcutKey } from '../shared/capture'
import { defaultAppSettings } from '../shared/capture'
import type { AppLanguage, TranslationKey } from '../shared/i18n'
import { t } from '../shared/i18n'
import { ActionIcon, ToolIcon, type EditorTool } from './icons'

export type SettingsTab = 'general' | 'shortcuts' | 'formats' | 'video' | 'audio'

type ShortcutField = {
  key: SettingsShortcutKey
  labelKey: TranslationKey
  icon?: EditorTool | 'copy' | 'save' | 'print' | 'whatsapp' | 'undo' | 'redo' | 'close'
}

const shortcutOptions = ['Alt+Shift+S', 'Ctrl+Shift+S', 'Alt+Q', 'Ctrl+Alt+S']

const shortcutFields: ShortcutField[] = [
  { key: 'captureShortcut', labelKey: 'shortcutCapture', icon: 'select' },
  { key: 'fullscreenShortcut', labelKey: 'shortcutFullscreen', icon: 'select' },
  { key: 'recordRegionShortcut', labelKey: 'shortcutRecordRegion', icon: 'select' },
  { key: 'recordFullscreenShortcut', labelKey: 'shortcutRecordFullscreen', icon: 'select' },
  { key: 'recordPauseShortcut', labelKey: 'shortcutRecordPause', icon: 'select' },
  { key: 'studioShortcut', labelKey: 'shortcutStudio', icon: 'select' },
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
  const baseKey = keyMap[event.key] ?? event.key.toUpperCase()

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
  onUpdateSetting: (patch: Partial<AppSettings>) => void
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
  const tabs = useMemo(
    () =>
      [
        { id: 'general' as const, label: t(language, 'tabGeneral') },
        { id: 'shortcuts' as const, label: t(language, 'tabShortcuts') },
        { id: 'video' as const, label: t(language, 'tabVideo') },
        { id: 'audio' as const, label: t(language, 'tabAudio') },
        { id: 'formats' as const, label: t(language, 'tabFormats') }
      ],
    [language]
  )

  return (
    <section className={overlay ? 'settings-backdrop capture-settings-backdrop' : 'settings-backdrop'} role="dialog" aria-modal="true">
      <div className="settings-window">
        <header>
          <div>
            <p className="eyebrow">{t(language, 'preferences')}</p>
            <h3>{t(language, 'settingsTitle')}</h3>
          </div>
          <button className="icon-button" onClick={onClose}>
            ×
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
              {tab.label}
            </button>
          ))}
        </div>

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
                checked={settings.keepSelectionAfterAction}
                onChange={(event) => onUpdateSetting({ keepSelectionAfterAction: event.currentTarget.checked })}
              />
              <span>{t(language, 'keepSelection')}</span>
            </label>
            <label>
              <input
                type="checkbox"
                checked={settings.captureCursor}
                onChange={(event) => onUpdateSetting({ captureCursor: event.currentTarget.checked })}
              />
              <span>{t(language, 'captureCursor')}</span>
            </label>
          </div>
        )}

        {settingsTab === 'shortcuts' && (
          <>
            <div className="settings-grid">
              <label>
                <span>{t(language, 'mainShortcut')}</span>
                <select
                  value={shortcutOptions.includes(settings.captureShortcut) ? settings.captureShortcut : 'custom'}
                  onChange={(event) => {
                    if (event.currentTarget.value !== 'custom') {
                      onUpdateSetting({ captureShortcut: event.currentTarget.value })
                    }
                  }}
                >
                  {shortcutOptions.map((shortcut) => (
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
                    readOnly
                    value={
                      recordingShortcut === 'captureShortcut'
                        ? t(language, 'recording')
                        : settings.captureShortcut
                    }
                    onFocus={() => onRecordingShortcutChange('captureShortcut')}
                    onKeyDown={(event) => {
                      if (recordingShortcut !== 'captureShortcut') {
                        return
                      }

                      event.preventDefault()
                      const shortcut = shortcutFromKeyboardEvent(event)

                      if (shortcut) {
                        onRecordingShortcutChange(null)
                        onUpdateSetting({ captureShortcut: shortcut })
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      onRecordingShortcutChange(recordingShortcut === 'captureShortcut' ? null : 'captureShortcut')
                    }
                  >
                    {recordingShortcut === 'captureShortcut' ? t(language, 'listening') : t(language, 'record')}
                  </button>
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
                      readOnly
                      value={
                        recordingShortcut === field.key ? t(language, 'recording') : settings[field.key]
                      }
                      onFocus={() => onRecordingShortcutChange(field.key)}
                      onKeyDown={(event) => {
                        if (recordingShortcut !== field.key) {
                          return
                        }

                        event.preventDefault()
                        const shortcut = shortcutFromKeyboardEvent(event)

                        if (shortcut) {
                          onRecordingShortcutChange(null)
                          onUpdateSetting({ [field.key]: shortcut } as Partial<AppSettings>)
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        onRecordingShortcutChange(recordingShortcut === field.key ? null : field.key)
                      }
                    >
                      {recordingShortcut === field.key ? t(language, 'listening') : t(language, 'record')}
                    </button>
                  </div>
                </label>
              ))}
            </div>
          </>
        )}

        {settingsTab === 'video' && (
          <div className="settings-grid">
            <label>
              <span>{t(language, 'videoQuality')}</span>
              <select
                value={settings.videoQuality}
                onChange={(event) => onUpdateSetting({ videoQuality: event.currentTarget.value as AppSettings['videoQuality'] })}
              >
                <option value="balanced">{t(language, 'videoQualityBalanced')}</option>
                <option value="sharp">{t(language, 'videoQualitySharp')}</option>
                <option value="fluid">{t(language, 'videoQualityFluid')}</option>
              </select>
            </label>
            <label>
              <span>{t(language, 'videoFps')}</span>
              <select
                value={settings.videoFps}
                onChange={(event) => onUpdateSetting({ videoFps: Number(event.currentTarget.value) as AppSettings['videoFps'] })}
              >
                <option value="24">24 fps</option>
                <option value="30">30 fps</option>
                <option value="60">60 fps</option>
              </select>
            </label>
            <label>
              <span>{t(language, 'videoResolution')}</span>
              <select
                value={settings.videoResolution}
                onChange={(event) =>
                  onUpdateSetting({ videoResolution: event.currentTarget.value as AppSettings['videoResolution'] })
                }
              >
                <option value="auto">{t(language, 'videoResolutionAuto')}</option>
                <option value="1080p">1080p</option>
                <option value="720p">720p</option>
              </select>
            </label>
            <label>
              <input
                type="checkbox"
                checked={settings.webcamEnabled}
                onChange={(event) => onUpdateSetting({ webcamEnabled: event.currentTarget.checked })}
              />
              <span>{t(language, 'webcamEnabled')}</span>
            </label>
            <label>
              <span>{t(language, 'webcamShape')}</span>
              <select
                value={settings.webcamShape}
                onChange={(event) => onUpdateSetting({ webcamShape: event.currentTarget.value as AppSettings['webcamShape'] })}
              >
                <option value="circle">{t(language, 'webcamShapeCircle')}</option>
                <option value="rounded">{t(language, 'webcamShapeRounded')}</option>
                <option value="square">{t(language, 'webcamShapeSquare')}</option>
              </select>
            </label>
            <label>
              <span>{t(language, 'webcamSize')}</span>
              <input
                type="range"
                min="120"
                max="320"
                value={settings.webcamSize}
                onChange={(event) => onUpdateSetting({ webcamSize: Number(event.currentTarget.value) })}
              />
            </label>
            <label>
              <span>{t(language, 'webcamFrameColor')}</span>
              <input
                type="color"
                value={settings.webcamFrameColor}
                onChange={(event) => onUpdateSetting({ webcamFrameColor: event.currentTarget.value })}
              />
            </label>
            <p className="settings-hint opfs-hint">{t(language, 'videoOpfsHint')}</p>
            <p className="settings-hint">{t(language, 'videoFormatHint')}</p>
          </div>
        )}

        {settingsTab === 'audio' && (
          <div className="settings-grid">
            <label>
              <input
                type="checkbox"
                checked={settings.recordAudio}
                onChange={(event) => onUpdateSetting({ recordAudio: event.currentTarget.checked })}
              />
              <span>{t(language, 'recordAudio')}</span>
            </label>
            <label>
              <span>{t(language, 'audioSource')}</span>
              <select
                value={settings.audioSource}
                onChange={(event) => onUpdateSetting({ audioSource: event.currentTarget.value as AppSettings['audioSource'] })}
              >
                <option value="none">{t(language, 'audioSourceNone')}</option>
                <option value="microphone">{t(language, 'audioSourceMic')}</option>
                <option value="system">{t(language, 'audioSourceSystem')}</option>
                <option value="both">{t(language, 'audioSourceBoth')}</option>
              </select>
            </label>
            <label>
              <span>{t(language, 'microphoneGain')}</span>
              <input
                type="range"
                min="50"
                max="200"
                value={settings.microphoneGain}
                onChange={(event) => onUpdateSetting({ microphoneGain: Number(event.currentTarget.value) })}
              />
            </label>
          </div>
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
    </section>
  )
}

export { shortcutFromKeyboardEvent }
