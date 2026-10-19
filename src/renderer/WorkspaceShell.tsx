import type { ReactNode } from 'react'
import { Scan, Images, Pipette, Palette, Crosshair, Settings2, ArrowUpRight } from 'lucide-react'
import appIcon from '../../build/icon.png'
import './workspace.css'

export type WorkspaceView = 'home' | 'studio' | 'colors' | 'palettes'
type Props = { view: WorkspaceView; version: string; shortcut: string; onNavigate: (view: WorkspaceView) => void; onLiveColor: () => void; onSettings: () => void; children: ReactNode }
const views = [
  { view: 'home' as const, label: 'Captura', icon: Scan },
  { view: 'studio' as const, label: 'Estúdio', icon: Images },
  { view: 'colors' as const, label: 'Color Lab', icon: Pipette },
  { view: 'palettes' as const, label: 'Minhas Paletas', icon: Palette }
]

export function WorkspaceShell({ view, version, shortcut, onNavigate, onLiveColor, onSettings, children }: Props) {
  return <div className="workspace-layout">
    <aside className="workspace-sidebar">
      <button className="workspace-brand" aria-label="Início GCPShot" onClick={() => onNavigate('home')}><img src={appIcon} alt="" /><span><strong>GCPShot</strong><small>Seu espaço criativo</small></span></button>
      <span className="workspace-label">WORKSPACE</span>
      <nav aria-label="Navegação principal">{views.map((item) => <button key={item.view} aria-label={item.label} title={item.label} aria-current={view === item.view ? 'page' : undefined} onClick={() => onNavigate(item.view)}><item.icon size={19} strokeWidth={1.7} /><span>{item.label}</span></button>)}</nav>
      <div className="workspace-divider" />
      <button className="workspace-live" aria-label="Live Color" title={`Live Color (${shortcut})`} onClick={onLiveColor}><Crosshair size={19} /><span>Live Color<kbd>{shortcut}</kbd></span></button>
      <div className="workspace-sidebar-footer"><button onClick={onSettings}><Settings2 size={18} /><span>Configurações</span></button><a href="https://gestaoculturalpro.com.br/" target="_blank" rel="noreferrer">Gestão Cultural Pro<ArrowUpRight size={13} /></a><small>GCPShot {version}</small></div>
    </aside>
    <div className="workspace-content">{children}</div>
  </div>
}
