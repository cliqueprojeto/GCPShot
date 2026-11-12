import { useEffect, useState } from 'react'
import { RefreshCw, Download, ExternalLink } from 'lucide-react'
import type { AppSettings } from '../shared/capture'
import type { UpdateStatus } from '../shared/updates'

type Props = { settings: AppSettings; onUpdateSetting: (patch: Partial<AppSettings>) => Promise<void> | void }

function formatDate(iso?: string): string {
  if (!iso) return 'nunca'
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? 'nunca' : date.toLocaleString('pt-BR')
}

export function UpdatesSection({ settings, onUpdateSetting }: Props): JSX.Element {
  const [status, setStatus] = useState<UpdateStatus | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    void window.gcpshot.getUpdateStatus().then(setStatus)
    return window.gcpshot.onUpdateStatus(setStatus)
  }, [])

  const busy = status?.state === 'checking' || status?.state === 'downloading' || status?.state === 'installing'
  const lastCheck = status?.lastCheck || settings.lastUpdateCheck

  async function run(action: () => Promise<unknown>): Promise<void> {
    setError('')
    try { await action() } catch (reason) { setError(reason instanceof Error ? reason.message.replace(/^Error invoking remote method '[^']+': Error: /, '') : 'Falha na atualização.') }
  }

  return (
    <section className="updates-card" aria-labelledby="updates-title">
      <h4 id="updates-title">Atualizações</h4>
      <p className="updates-meta">Versão instalada: {status?.currentVersion ?? '…'}. As novas versões vêm do GitHub ({status?.repository ?? 'cliqueprojeto/GCPShot'}).</p>
      <p className="updates-meta" aria-live="polite">{status?.message || 'Nenhuma verificação nesta sessão.'} · Última verificação: {formatDate(lastCheck)}</p>
      <div className="updates-row">
        <label htmlFor="update-mode">Verificar atualizações automaticamente</label>
        <select id="update-mode" value={settings.updateCheckMode} onChange={(event) => void onUpdateSetting({ updateCheckMode: event.currentTarget.value as AppSettings['updateCheckMode'] })}>
          <option value="startup">Sempre que abrir o programa</option>
          <option value="daily">Uma vez por dia</option>
          <option value="manual">Somente manualmente</option>
        </select>
      </div>
      <label className="updates-check">
        <input type="checkbox" checked={settings.includePrereleases} onChange={(event) => void onUpdateSetting({ includePrereleases: event.currentTarget.checked })} />
        <span>Receber versões de desenvolvimento (pré-lançamento)</span>
      </label>
      <div className="updates-actions">
        <button type="button" className="updates-secondary" disabled={busy} onClick={() => void run(() => window.gcpshot.checkForUpdates())}>
          <RefreshCw size={16} className={status?.state === 'checking' ? 'spin' : ''} /> Verificar agora
        </button>
        {status?.state === 'available' && (
          <button type="button" disabled={busy} onClick={() => void run(() => window.gcpshot.installUpdate())}>
            <Download size={16} /> Baixar e instalar {status.latestVersion}
          </button>
        )}
        {status?.releaseUrl && (status.state === 'available' || status.state === 'error' || status.state === 'ready') && (
          <button type="button" className="updates-secondary" onClick={() => void window.gcpshot.openReleasePage()}>
            <ExternalLink size={16} /> Notas da versão
          </button>
        )}
      </div>
      {(status?.state === 'downloading' || status?.state === 'installing') && (
        <progress className="updates-progress" max={1} value={status.progress ?? 0} aria-label="Progresso da atualização" />
      )}
      {status?.state === 'available' && status.notes && <pre className="updates-notes">{status.notes.slice(0, 2000)}</pre>}
      {error && <p role="alert" className="shortcut-error">{error}</p>}
      <p className="updates-foot">Canal público de atualizações: nenhum login ou chave do GitHub é necessário.</p>
    </section>
  )
}
