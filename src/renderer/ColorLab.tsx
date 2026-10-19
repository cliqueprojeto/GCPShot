import { useEffect, useState, type JSX } from 'react'
import { contrast, harmony, hsl, luminance, normalizeHex, rgb, type ColorLibrary, type Harmony, type Palette } from '../shared/colors'
import './colorLab.css'

type Props = {
  view: 'colors' | 'palettes'
  shortcut: string
  onNavigate: (view: 'home' | 'studio' | 'colors' | 'palettes') => void
  onSettings: () => void
}

const modes: Array<[Harmony, string]> = [['analogous', 'Analogas'], ['complementary', 'Complementares'], ['triadic', 'Triade'], ['monochromatic', 'Monocromatica']]
const empty: ColorLibrary = { palettes: [], history: [] }

export function ColorLab({ view, shortcut, onNavigate, onSettings }: Props): JSX.Element {
  const [hex, setHex] = useState('#9D7BFF')
  const [draft, setDraft] = useState(hex)
  const [library, setLibrary] = useState<ColorLibrary>(empty)
  const [mode, setMode] = useState<Harmony>('analogous')
  const [name, setName] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [picking, setPicking] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [rename, setRename] = useState('')
  const [renameId, setRenameId] = useState<string | null>(null)
  const harmonies = harmony(hex, mode)

  function choose(value: string): void { setHex(value); setDraft(value); setMessage('') }
  function fail(error: unknown): void { setMessage(error instanceof Error ? error.message : 'Nao foi possivel concluir a operacao.') }

  useEffect(() => {
    let active = true
    void window.gcpshot.getColorLibrary().then((value) => {
      if (active) { setLibrary(value); setLoading(false); if (value.history[0]) choose(value.history[0]) }
    }).catch((e) => { if (active) { fail(e); setLoading(false) } })
    const remove = window.gcpshot.onColorPicked((value) => {
      choose(value)
      void window.gcpshot.getColorLibrary().then((next) => { if (active) setLibrary(next) }).catch(fail)
    })
    return () => { active = false; remove() }
  }, [])

  async function save(next: ColorLibrary, text: string): Promise<void> {
    setBusy(true)
    try { setLibrary(await window.gcpshot.saveColorLibrary(next)); setMessage(text) }
    catch (error) { fail(error); throw error }
    finally { setBusy(false) }
  }
  async function copy(text: string): Promise<void> {
    try { await window.gcpshot.copyColorText(text); setMessage(`${text} copiado.`) } catch (error) { fail(error) }
  }
  async function pick(): Promise<void> {
    setPicking(true)
    try {
      const result = await window.gcpshot.pickColor()
      if (result.hex) { choose(result.hex); setLibrary(await window.gcpshot.getColorLibrary()); setMessage(`${result.hex} copiado e guardado no historico.`) }
      else setMessage(result.error ?? 'Selecao cancelada.')
    } catch (error) { fail(error) } finally { setPicking(false) }
  }
  async function savePalette(): Promise<void> {
    if (!name.trim()) { setMessage('Informe um nome para a paleta.'); return }
    if (!selected.length) { setMessage('Adicione ao menos uma cor.'); return }
    const palette: Palette = { id: editing ?? crypto.randomUUID(), name: name.trim(), colors: selected }
    try {
      await save({ ...library, palettes: editing ? library.palettes.map((p) => p.id === editing ? palette : p) : [...library.palettes, palette] }, 'Paleta salva.')
      setName(''); setSelected([]); setEditing(null)
    } catch { /* The save helper reports the error. */ }
  }
  async function importLibrary(): Promise<void> {
    setBusy(true)
    try { const result = await window.gcpshot.importColorLibrary(); if (result) { setLibrary(result); setMessage('Paletas importadas.') } }
    catch (error) { fail(error) } finally { setBusy(false) }
  }
  function addColor(value: string): void { setSelected((current) => current.includes(value) ? current : [...current, value]); setMessage('Cor adicionada a paleta em edicao.') }
  const foreground = luminance(hex) > 0.4 ? '#111111' : '#FFFFFF'

  return <main className="color-workspace">
    <section className="color-content" aria-busy={loading || busy}>
      <header className="color-header"><div><span className="color-eyebrow">GCPShot / CORES</span><h1>{view === 'colors' ? 'Color Lab' : 'Minhas Paletas'}</h1></div>
        {view === 'palettes' && <div className="color-actions"><button disabled={busy || loading} onClick={() => void importLibrary()}>Importar JSON</button><select aria-label="Exportar paletas" defaultValue="" disabled={busy || loading || !library.palettes.length} onChange={(e) => { const format = e.target.value as 'json' | 'css'; e.target.value = ''; void window.gcpshot.exportColorLibrary(format).then((ok) => { if (ok) setMessage('Paletas exportadas.') }).catch(fail) }}><option value="" disabled>Exportar</option><option value="json">JSON</option><option value="css">CSS</option></select></div>}
      </header>
      <p className="color-status" role="status">{loading ? 'Carregando suas cores...' : message}</p>
      {view === 'colors' ? <>
        <div className="color-lab-grid">
          <section className="color-tool"><header><h2>Cor em foco</h2><span className="color-eyebrow">LIVE COLOR</span></header>
            <div className="color-focus" style={{ background: hex, color: foreground }}>{hex}</div>
            <label className="color-selector"><input aria-label="Seletor de cor" type="color" value={hex} onChange={(e) => choose(e.target.value.toUpperCase())} />Seletor de cor</label>
            <form className="color-actions" onSubmit={(e) => { e.preventDefault(); const value = normalizeHex(draft); if (value) choose(value); else setMessage('HEX invalido. Use #RGB ou #RRGGBB.') }}>
              <input aria-label="Cor HEX" value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={7} /><button>Aplicar HEX</button>
            </form>
            <button className="color-wide" disabled={picking || loading || busy} onClick={() => void pick()}>Conta-gotas ao vivo <kbd>{shortcut}</kbd></button>
            <button className="color-wide" disabled={busy || loading} onClick={() => void save({ ...library, history: [hex, ...library.history.filter((c) => c !== hex)].slice(0, 100) }, 'Cor guardada no historico.').catch(() => {})}>+ Guardar no historico</button>
          </section>
          <section className="color-tool"><h2>Pronta para o seu workflow</h2>
            {([['HEX', hex], ['RGB', `rgb(${rgb(hex).join(', ')})`], ['HSL', `hsl(${hsl(hex).map((n, i) => Math.round(n) + (i ? '%' : '')).join(', ')})`]]).map(([label, text]) => <div className="color-format" key={label}><small>{label}</small><code>{text}</code><button onClick={() => void copy(text)}>Copiar</button></div>)}
            <h2 className="contrast-heading">Contraste / WCAG AA</h2>
            {['#FFFFFF', '#000000'].map((background) => { const ratio = contrast(hex, background); return <div className="color-contrast" key={background}><strong>{ratio.toFixed(2)}:1</strong><span>sobre {background === '#FFFFFF' ? 'branco' : 'preto'}</span><span>{ratio >= 7 ? 'AAA texto normal' : ratio >= 4.5 ? 'AA texto normal' : ratio >= 3 ? 'AA texto grande' : 'Abaixo de AA'}</span></div> })}
          </section>
        </div>
        <section className="color-harmonies"><h2>Encontre sua harmonia</h2><div className="color-tabs" role="tablist" aria-label="Harmonias">{modes.map(([value, label]) => <button role="tab" aria-selected={mode === value} key={value} onClick={() => setMode(value)}>{label}</button>)}</div>
          <div className="color-swatches">{harmonies.map((color, i) => <div key={`${color}-${i}`}><button className="color-swatch" style={{ background: color }} title={`Selecionar ${color}`} aria-label={`Selecionar ${color}`} onClick={() => choose(color)} /><div><button onClick={() => void copy(color)} title={`Copiar ${color}`}>{color}</button><button title={`Adicionar ${color} a paleta`} onClick={() => addColor(color)}>+</button></div></div>)}</div>
          <button disabled={busy || loading} onClick={() => { setSelected(harmonies); onNavigate('palettes') }}>Criar paleta com esta harmonia</button>
        </section>
        <section><div className="color-section-heading"><h2>Historico</h2><button disabled={busy || !library.history.length} onClick={() => void save({ ...library, history: [] }, 'Historico limpo.').catch(() => {})}>Limpar</button></div>
          {library.history.length ? <div className="color-history">{library.history.map((color) => <button key={color} title={`Selecionar ${color}`} onClick={() => choose(color)}><span style={{ background: color }} />{color}</button>)}</div> : <p className="color-empty">As cores selecionadas aparecerao aqui.</p>}
        </section>
      </> : <>
        <section className="color-palette-editor"><h2>{editing ? 'Editar paleta' : 'Nova paleta'}</h2><div className="color-actions"><input aria-label="Nome da paleta" placeholder="Nome da paleta" maxLength={100} value={name} onChange={(e) => setName(e.target.value)} /><input aria-label="Cor para adicionar" type="color" value={hex} onChange={(e) => choose(e.target.value.toUpperCase())} /><button onClick={() => addColor(hex)}>+ Adicionar cor</button><button disabled={busy || loading} onClick={() => void savePalette()}>Salvar paleta</button>{editing && <button onClick={() => { setEditing(null); setName(''); setSelected([]) }}>Cancelar</button>}</div>
          <div className="color-history">{selected.map((color) => <button key={color} title={`Remover ${color}`} onClick={() => setSelected((current) => current.filter((c) => c !== color))}><span style={{ background: color }} />{color} ×</button>)}</div>
        </section>
        <input className="color-search" type="search" aria-label="Buscar paletas" placeholder="Buscar paletas" value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="color-palette-list">{library.palettes.filter((p) => p.name.toLocaleLowerCase().includes(search.toLocaleLowerCase())).map((palette) => <article className="color-palette" key={palette.id}>
          <header>{renameId === palette.id ? <form className="color-actions" onSubmit={(e) => { e.preventDefault(); if (rename.trim()) void save({ ...library, palettes: library.palettes.map((p) => p.id === palette.id ? { ...p, name: rename.trim() } : p) }, 'Paleta renomeada.').then(() => setRenameId(null)).catch(() => {}) }}><input aria-label="Novo nome" maxLength={100} value={rename} onChange={(e) => setRename(e.target.value)} /><button disabled={busy}>Salvar nome</button><button type="button" onClick={() => setRenameId(null)}>Cancelar</button></form> : <h2>{palette.name}</h2>}<span>{palette.colors.length} cores</span></header>
          <div className="color-palette-strip">{palette.colors.map((color, i) => <button key={`${color}-${i}`} style={{ background: color, color: luminance(color) > 0.4 ? '#111' : '#fff' }} title={`Copiar ${color}`} onClick={() => void copy(color)}>{color}</button>)}</div>
          <div className="color-actions"><button onClick={() => void copy(palette.colors.join(', '))}>Copiar cores</button><button onClick={() => { setEditing(palette.id); setName(palette.name); setSelected([...new Set(palette.colors)]) }}>Editar</button><button onClick={() => { setRenameId(palette.id); setRename(palette.name) }}>Renomear</button>{deleteId === palette.id ? <><button disabled={busy} onClick={() => void save({ ...library, palettes: library.palettes.filter((p) => p.id !== palette.id) }, 'Paleta excluida.').then(() => { setDeleteId(null); if (editing === palette.id) { setEditing(null); setName(''); setSelected([]) } }).catch(() => {})}>Confirmar exclusao</button><button onClick={() => setDeleteId(null)}>Cancelar</button></> : <button onClick={() => setDeleteId(palette.id)}>Excluir</button>}</div>
        </article>)}</div>
        {!loading && !library.palettes.length && <p className="color-empty">Nenhuma paleta salva. Crie sua primeira paleta ou importe um arquivo JSON.</p>}
        {library.palettes.length > 0 && !library.palettes.some((p) => p.name.toLocaleLowerCase().includes(search.toLocaleLowerCase())) && <p className="color-empty">Nenhuma paleta encontrada.</p>}
      </>}
    </section>
  </main>
}
