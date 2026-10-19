import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type PointerEvent } from 'react'
import ReactCrop, { type PercentCrop } from 'react-image-crop'
import { Crop, Sun, SlidersHorizontal, Brush, Stamp, Image as ImageIcon, ZoomIn, ZoomOut, Scan, Undo2, Redo2, RotateCcw, RotateCw, FlipHorizontal2, FlipVertical2, WandSparkles, Eraser, Highlighter, Pen, Check, X, Save, Layers } from 'lucide-react'
import { backgroundMask, loadPhoto, originalPhoto, photoCanvas, renderPhoto, type PhotoAdjustments } from './photoEngine'
import 'react-image-crop/dist/ReactCrop.css'
import './photo-editor.css'

type Snapshot = { url: string; values: PhotoAdjustments }
type Point = { x: number; y: number }
type Tool = 'crop' | 'light' | 'filters' | 'draw' | 'retouch' | 'background'
export type PhotoEditorHandle = { exportImage: () => Promise<string> }
const tools = [
  { id: 'crop', label: 'Recorte', icon: Crop }, { id: 'light', label: 'Luz e cor', icon: Sun },
  { id: 'filters', label: 'Filtros', icon: SlidersHorizontal }, { id: 'draw', label: 'Marcação', icon: Brush },
  { id: 'retouch', label: 'Retoque local', icon: Stamp }, { id: 'background', label: 'Fundo', icon: ImageIcon }
] as const
const presets = [ ['none', 'Original'], ['pb', 'P&B'], ['sepia', 'Sépia'], ['noir', 'Noir'], ['retro', 'Retrô'], ['chrome', 'Chrome'], ['film', 'Filme'], ['warm', 'Quente'] ] as const
const sliders = [ ['brightness', 'Brilho'], ['exposure', 'Exposição'], ['contrast', 'Contraste'], ['highlights', 'Destaques'], ['shadows', 'Sombras'], ['saturation', 'Saturação'], ['warmth', 'Temperatura'], ['tint', 'Matiz'], ['vignette', 'Vinheta'] ] as const

export const PhotoEditor = forwardRef<PhotoEditorHandle, { source: string; name: string; onSave: () => void; onLayer: () => void }>(function PhotoEditor({ source, name, onSave, onLayer }, ref) {
  const [document, setDocument] = useState<Snapshot>({ url: source, values: { ...originalPhoto } })
  const documentRef = useRef(document); documentRef.current = document
  const [history, setHistory] = useState<{ undo: Snapshot[]; redo: Snapshot[] }>({ undo: [], redo: [] })
  const [tool, setTool] = useState<Tool>('light')
  const [preview, setPreview] = useState('')
  const [dimensions, setDimensions] = useState({ width: 1, height: 1 })
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const [zoom, setZoom] = useState<number | null>(null), [fit, setFit] = useState(1)
  const [crop, setCrop] = useState<PercentCrop>(), [aspect, setAspect] = useState<number>()
  const [ink, setInk] = useState('#5F42EB'), [brushSize, setBrushSize] = useState(18)
  const [brush, setBrush] = useState<'pen' | 'highlight' | 'erase' | 'clone' | 'soften'>('pen')
  const [points, setPoints] = useState<Point[]>([])
  const stroke = useRef<Point[]>([]), strokeId = useRef<number | null>(null)
  const [clonePoint, setClonePoint] = useState<Point>({ x: .5, y: .5 })
  const [seed, setSeed] = useState<Point>({ x: 0, y: 0 }), [selectSeed, setSelectSeed] = useState(false)
  const [tolerance, setTolerance] = useState(12), [background, setBackground] = useState('#ffffff')
  const [blur, setBlur] = useState(16)
  const viewport = useRef<HTMLDivElement>(null)
  const operation = useRef({ key: '', time: 0 })
  const request = useRef(0)
  useImperativeHandle(ref, () => ({ exportImage: async () => {
    if (busy || strokeId.current !== null) throw new Error('Conclua a operação de edição antes de exportar.')
    const current = documentRef.current
    return (await renderPhoto(current.url, current.values)).toDataURL('image/png')
  } }), [busy])

  useEffect(() => {
    const id = ++request.current
    setError('')
    const timer = setTimeout(() => {
      void renderPhoto(document.url, document.values, 1400).then((canvas) => {
        if (request.current !== id) return
        setPreview(canvas.toDataURL('image/png'))
      }).catch(() => { if (request.current === id) setError('Não foi possível renderizar esta imagem.') })
      void loadPhoto(document.url).then((image) => {
        if (request.current !== id) return
        const angle = document.values.rotation * Math.PI / 180
        setDimensions({ width: Math.round(Math.abs(image.naturalWidth * Math.cos(angle)) + Math.abs(image.naturalHeight * Math.sin(angle))), height: Math.round(Math.abs(image.naturalHeight * Math.cos(angle)) + Math.abs(image.naturalWidth * Math.sin(angle))) })
      }).catch(() => {})
    }, 70)
    return () => { clearTimeout(timer); request.current++ }
  }, [document])

  useEffect(() => {
    const node = viewport.current
    if (!node) return
    const resize = () => setFit(Math.min(1, Math.max(1, node.clientWidth - 48) / dimensions.width, Math.max(1, node.clientHeight - 48) / dimensions.height))
    const observer = new ResizeObserver(resize); observer.observe(node); resize()
    return () => observer.disconnect()
  }, [dimensions])

  function commit(next: Snapshot, key = '') {
    const now = Date.now()
    const previous = documentRef.current
    if (!key || key !== operation.current.key || now - operation.current.time > 600) {
      setHistory((current) => ({ undo: [...current.undo.slice(-11), previous], redo: [] }))
    }
    operation.current = { key, time: now }
    documentRef.current = next; setDocument(next)
  }
  function adjust(patch: Partial<PhotoAdjustments>, key = '') { commit({ ...documentRef.current, values: { ...documentRef.current.values, ...patch } }, key); setCrop(undefined) }
  function moveHistory(direction: 'undo' | 'redo') {
    const entries = history[direction], next = entries.at(-1)
    if (!next) return
    setHistory(direction === 'undo'
      ? { undo: entries.slice(0, -1), redo: [...history.redo, documentRef.current] }
      : { redo: entries.slice(0, -1), undo: [...history.undo, documentRef.current] })
    operation.current = { key: '', time: 0 }; documentRef.current = next; setDocument(next); setCrop(undefined)
  }
  async function rasterEdit(edit: (canvas: HTMLCanvasElement) => HTMLCanvasElement | void) {
    if (busy) return
    setBusy(true); setError('')
    try {
      const canvas = await renderPhoto(documentRef.current.url, documentRef.current.values)
      const result = edit(canvas) || canvas
      commit({ url: result.toDataURL('image/png'), values: { ...originalPhoto } })
      setCrop(undefined)
    } catch { setError('Não foi possível aplicar a edição. Sua imagem foi preservada.') }
    finally { setBusy(false) }
  }
  function applyCrop() {
    if (!crop || crop.width <= 0 || crop.height <= 0) return
    void rasterEdit((canvas) => {
      const x = Math.round(crop.x / 100 * canvas.width), y = Math.round(crop.y / 100 * canvas.height)
      const output = photoCanvas(Math.min(canvas.width - x, canvas.width * crop.width / 100), Math.min(canvas.height - y, canvas.height * crop.height / 100))
      output.getContext('2d')!.drawImage(canvas, x, y, output.width, output.height, 0, 0, output.width, output.height)
      return output
    })
  }
  function point(event: PointerEvent<HTMLDivElement>): Point {
    const bounds = event.currentTarget.getBoundingClientRect()
    return { x: Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)), y: Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height)) }
  }
  function beginStroke(event: PointerEvent<HTMLDivElement>) {
    if (busy || event.button !== 0) return
    const start = point(event)
    if (selectSeed && tool === 'background') { setSeed(start); setSelectSeed(false); return }
    if (tool !== 'draw' && tool !== 'retouch') return
    if (tool === 'retouch' && event.altKey) { setClonePoint(start); return }
    event.currentTarget.setPointerCapture(event.pointerId)
    strokeId.current = event.pointerId; stroke.current = [start]; setPoints([start])
  }
  function endStroke(event: PointerEvent<HTMLDivElement>) {
    if (strokeId.current !== event.pointerId) return
    strokeId.current = null
    const path = [...stroke.current], selectedBrush = brush
    stroke.current = []; setPoints([])
    void rasterEdit((canvas) => {
      const ctx = canvas.getContext('2d')!, radius = brushSize / Math.max(.01, (zoom ?? fit)) / 2
      const backup = photoCanvas(canvas.width, canvas.height); backup.getContext('2d')!.drawImage(canvas, 0, 0)
      ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = radius * 2; ctx.strokeStyle = ink
      if (selectedBrush === 'erase') ctx.globalCompositeOperation = 'destination-out'
      if (selectedBrush === 'highlight') ctx.globalAlpha = .35
      if (selectedBrush === 'clone' || selectedBrush === 'soften') {
        const dx = (clonePoint.x - path[0].x) * canvas.width, dy = (clonePoint.y - path[0].y) * canvas.height
        const spacing = Math.max(1, radius / 3)
        for (let index = 0; index < path.length; index++) {
          const from = path[Math.max(0, index - 1)], to = path[index]
          const steps = Math.max(1, Math.ceil(Math.hypot((to.x - from.x) * canvas.width, (to.y - from.y) * canvas.height) / spacing))
          for (let step = 0; step <= steps; step++) {
            const x = (from.x + (to.x - from.x) * step / steps) * canvas.width, y = (from.y + (to.y - from.y) * step / steps) * canvas.height
            ctx.save(); ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.clip()
            if (selectedBrush === 'soften') { ctx.filter = `blur(${Math.max(2, radius / 3)}px)`; ctx.drawImage(backup, 0, 0) }
            else ctx.drawImage(backup, -dx, -dy)
            ctx.restore()
          }
        }
      } else {
        ctx.beginPath(); ctx.moveTo(path[0].x * canvas.width, path[0].y * canvas.height)
        for (const item of path) ctx.lineTo(item.x * canvas.width, item.y * canvas.height)
        if (path.length === 1) ctx.lineTo(path[0].x * canvas.width + .01, path[0].y * canvas.height)
        ctx.stroke()
      }
    })
  }
  function applyBackground(mode: 'remove' | 'blur' | 'replace') {
    void rasterEdit((canvas) => {
      const foreground = backgroundMask(canvas, tolerance, seed)
      if (mode === 'remove') return foreground
      const output = photoCanvas(canvas.width, canvas.height), ctx = output.getContext('2d')!
      if (mode === 'replace') { ctx.fillStyle = background; ctx.fillRect(0, 0, output.width, output.height) }
      else { ctx.filter = `blur(${blur}px)`; ctx.drawImage(canvas, -blur * 2, -blur * 2, canvas.width + blur * 4, canvas.height + blur * 4); ctx.filter = 'none' }
      ctx.drawImage(foreground, 0, 0)
      return output
    })
  }
  const scale = zoom ?? fit
  const changeTool = (next: Tool) => { setTool(next); setSelectSeed(false); if (next === 'draw') setBrush('pen'); if (next === 'retouch') setBrush('clone') }
  return <section className="photo-editor" aria-label="Editor de imagem">
    <div className="photo-toolbar" role="toolbar" aria-label="Ferramentas de imagem">
      {tools.map(({ id, label, icon: Icon }) => <button type="button" key={id} title={label} aria-label={label} aria-pressed={tool === id} onClick={() => changeTool(id)}><Icon size={18} /><span>{label}</span></button>)}
    </div>
    <div className="photo-stage">
      <div className="photo-view-controls">
        <button title="Diminuir zoom" aria-label="Diminuir zoom" onClick={() => setZoom(Math.max(.05, scale / 1.25))}><ZoomOut size={17} /></button>
        <output>{Math.round(scale * 100)}%</output>
        <button title="Aumentar zoom" aria-label="Aumentar zoom" onClick={() => setZoom(Math.min(8, scale * 1.25))}><ZoomIn size={17} /></button>
        <button title="Tamanho real (1:1)" aria-label="Tamanho real" onClick={() => setZoom(1)}>1:1</button>
        <button title="Ajustar à tela" aria-label="Ajustar à tela" onClick={() => setZoom(null)}><Scan size={17} /></button>
        <i />
        <button title="Desfazer" aria-label="Desfazer edição" disabled={!history.undo.length || busy} onClick={() => moveHistory('undo')}><Undo2 size={17} /></button>
        <button title="Refazer" aria-label="Refazer edição" disabled={!history.redo.length || busy} onClick={() => moveHistory('redo')}><Redo2 size={17} /></button>
        <button title="Restaurar original" aria-label="Restaurar original" disabled={busy} onClick={() => { commit({ url: source, values: { ...originalPhoto } }); setCrop(undefined) }}><RotateCcw size={17} /></button>
      </div>
      <div className="photo-viewport" ref={viewport}>
        {preview && <div className="photo-image-frame" style={{ width: dimensions.width * scale, height: dimensions.height * scale }}>
          {tool === 'crop' ? <ReactCrop crop={crop} aspect={aspect} ruleOfThirds onChange={(_, percent) => setCrop(percent)}><img src={preview} alt={name} draggable={false} /></ReactCrop> : <div className={tool === 'draw' || tool === 'retouch' || selectSeed ? 'photo-paint active' : 'photo-paint'} onPointerDown={beginStroke} onPointerMove={(event) => { if (strokeId.current === event.pointerId) { stroke.current.push(point(event)); setPoints([...stroke.current]) } }} onPointerUp={endStroke} onPointerCancel={() => { strokeId.current = null; stroke.current = []; setPoints([]) }}>
            <img src={preview} alt={name} draggable={false} />
            {points.length > 0 && <svg viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden><polyline points={points.map((p) => `${p.x * 1000},${p.y * 1000}`).join(' ')} fill="none" stroke={brush === 'erase' ? '#ffffff' : ink} strokeOpacity={brush === 'highlight' ? .35 : .8} vectorEffect="non-scaling-stroke" strokeWidth={brushSize} strokeLinecap="round" strokeLinejoin="round" /></svg>}
            {tool === 'background' && <span className="photo-seed" style={{ left: `${seed.x * 100}%`, top: `${seed.y * 100}%` }} />}
            {tool === 'retouch' && brush === 'clone' && <span className="photo-seed clone" style={{ left: `${clonePoint.x * 100}%`, top: `${clonePoint.y * 100}%` }} />}
          </div>}
        </div>}
        {!preview && !error && <span className="photo-loading">Carregando imagem…</span>}
      </div>
      <div className="photo-status"><span>{dimensions.width} × {dimensions.height} px</span><span role="status">{busy ? 'Aplicando edição…' : error || name}</span></div>
    </div>
    <aside className="photo-properties" aria-label="Propriedades da imagem">
      <h3>{tools.find((item) => item.id === tool)?.label}</h3>
      <fieldset disabled={busy}>
      {tool === 'crop' && <>
        <label>Proporção<select aria-label="Proporção do recorte" value={aspect || 0} onChange={(event) => { setAspect(Number(event.target.value) || undefined); setCrop(undefined) }}><option value={0}>Livre</option><option value={1}>1:1</option><option value={4 / 3}>4:3</option><option value={3 / 2}>3:2</option><option value={16 / 9}>16:9</option><option value={9 / 16}>9:16</option></select></label>
        <div className="photo-button-row"><button title="Girar à esquerda" aria-label="Girar à esquerda" onClick={() => adjust({ rotation: document.values.rotation - 90 })}><RotateCcw size={19} /></button><button title="Girar à direita" aria-label="Girar à direita" onClick={() => adjust({ rotation: document.values.rotation + 90 })}><RotateCw size={19} /></button><button title="Espelhar horizontalmente" aria-label="Espelhar horizontalmente" onClick={() => adjust({ flipHorizontal: !document.values.flipHorizontal })}><FlipHorizontal2 size={19} /></button><button title="Espelhar verticalmente" aria-label="Espelhar verticalmente" onClick={() => adjust({ flipVertical: !document.values.flipVertical })}><FlipVertical2 size={19} /></button></div>
        <label>Endireitar <output>{document.values.rotation}°</output><input aria-label="Endireitar" type="range" min={-180} max={180} step={.5} value={document.values.rotation % 360} onChange={(event) => adjust({ rotation: Number(event.target.value) }, 'rotation')} /></label>
        <div className="photo-button-row"><button disabled={!crop} onClick={applyCrop}><Check size={17} />Aplicar recorte</button><button title="Cancelar recorte" aria-label="Cancelar recorte" onClick={() => setCrop(undefined)}><X size={17} /></button></div>
      </>}
      {tool === 'light' && <>{sliders.map(([key, label]) => <label key={key}>{label}<output>{document.values[key]}</output><input aria-label={label} type="range" min={key === 'vignette' ? 0 : -100} max={100} value={document.values[key]} onChange={(event) => adjust({ [key]: Number(event.target.value) }, key)} /></label>)}</>}
      {tool === 'filters' && <>
        <button className="photo-wide" onClick={() => adjust({ brightness: 5, contrast: 12, saturation: 8, shadows: 12, highlights: -10 })}><WandSparkles size={17} />Aprimorar</button>
        <div className="photo-filter-grid">{presets.map(([id, label]) => <button key={id} className={document.values.filterPreset === id ? 'active' : ''} onClick={() => adjust({ filterPreset: id })}><img className={`filter-${id}`} src={source} alt="" /><span>{label}</span></button>)}</div>
      </>}
      {(tool === 'draw' || tool === 'retouch') && <>
        <div className="photo-button-row">{(tool === 'draw' ? [{ id: 'pen', label: 'Caneta', icon: Pen }, { id: 'highlight', label: 'Marca-texto', icon: Highlighter }, { id: 'erase', label: 'Borracha', icon: Eraser }] : [{ id: 'clone', label: 'Clonar', icon: Stamp }, { id: 'soften', label: 'Suavizar', icon: Brush }]).map(({ id, label, icon: Icon }) => <button key={id} title={label} aria-label={label} className={brush === id ? 'active' : ''} onClick={() => setBrush(id as typeof brush)}><Icon size={19} /></button>)}</div>
        {tool === 'draw' && <label>Cor<input aria-label="Cor da marcação" type="color" value={ink} onChange={(event) => setInk(event.target.value)} /></label>}
        <label>Tamanho do pincel<output>{brushSize} px</output><input aria-label="Tamanho do pincel" type="range" min={2} max={100} value={brushSize} onChange={(event) => setBrushSize(Number(event.target.value))} /></label>
        {tool === 'retouch' && brush === 'clone' && <p className="photo-note">Alt + clique define a origem da clonagem. Retoque local, sem IA generativa.</p>}
      </>}
      {tool === 'background' && <>
        <button className={selectSeed ? 'photo-wide active' : 'photo-wide'} onClick={() => setSelectSeed(!selectSeed)}>Selecionar cor de fundo</button>
        <label>Tolerância<output>{tolerance}%</output><input aria-label="Tolerância do fundo" type="range" min={1} max={65} value={tolerance} onChange={(event) => setTolerance(Number(event.target.value))} /></label>
        <button className="photo-wide" onClick={() => applyBackground('remove')}>Remover fundo</button>
        <label>Desfoque<output>{blur} px</output><input aria-label="Desfoque de fundo" type="range" min={2} max={50} value={blur} onChange={(event) => setBlur(Number(event.target.value))} /></label>
        <button className="photo-wide" onClick={() => applyBackground('blur')}>Desfocar fundo</button>
        <label>Cor de substituição<input aria-label="Cor de substituição" type="color" value={background} onChange={(event) => setBackground(event.target.value)} /></label>
        <button className="photo-wide" onClick={() => applyBackground('replace')}>Substituir fundo</button>
        <p className="photo-note">Seleção de área contínua por cor. Refine as bordas com a borracha em Marcação.</p>
      </>}
      </fieldset>
      <div className="photo-save-actions"><button className="photo-wide" disabled={busy} onClick={onLayer}><Layers size={17} />Adicionar como camada</button><button className="photo-wide primary" disabled={busy || !preview} onClick={onSave}><Save size={17} />Salvar cópia na biblioteca</button></div>
    </aside>
  </section>
})
