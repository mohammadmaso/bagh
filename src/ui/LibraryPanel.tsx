import { useEffect, useMemo, useRef, useState } from 'react'
import { CATALOG, CATALOG_BY_ID, CATEGORIES, type CatalogItem } from '../data/catalog'
import { useStore } from '../store/store'
import { useT } from '../i18n'
import { getThumbnail } from '../render/thumbnails'
import { importGLBFile } from '../render/models/glb'

function Thumb({ id }: { id: string }) {
  const [src, setSrc] = useState<string>('')
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let alive = true
    const io = new IntersectionObserver((es) => {
      if (es.some((e) => e.isIntersecting)) {
        io.disconnect()
        getThumbnail(id).then((u) => alive && setSrc(u)).catch(() => undefined)
      }
    })
    io.observe(el)
    return () => { alive = false; io.disconnect() }
  }, [id])
  return <div ref={ref} className="thumb" aria-hidden>{src ? <img src={src} alt="" width={56} height={56} draggable={false} /> : <span className="thumb-ph" />}</div>
}

export function LibraryPanel() {
  const { t, lang } = useT()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<Record<string, boolean>>({ fruit: true })
  const setUI = useStore((s) => s.setUI)
  const placing = useStore((s) => s.ui.placingType)
  const assets = useStore((s) => s.project.assets)
  const fileRef = useRef<HTMLInputElement>(null)
  const onGlb = async (f?: File) => {
    if (!f) return
    try {
      const r = await importGLBFile(f)
      const w = Math.max(0.1, Math.round(r.size.x * 100) / 100), d = Math.max(0.1, Math.round(r.size.z * 100) / 100)
      setUI({ tool: 'place', placingType: 'custom-glb', placingParams: { assetId: r.id, width: w, depth: d, modelScale: 1 }, toast: r.name })
    } catch (e) { setUI({ toast: 'Cannot read model: ' + String((e as Error).message) }) }
    if (fileRef.current) fileRef.current.value = ''
  }

  const nameOf = (c: CatalogItem) => c.name[lang]
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return null
    return CATALOG.filter((c) => c.name.en.toLowerCase().includes(s) || c.name.fa.includes(s) || c.tags.some((x) => x.includes(s)) || c.id.includes(s))
  }, [q])

  const start = (c: CatalogItem, params?: Record<string, number | string | boolean>) => {
    if (c.kind === 'polyline') setUI({ tool: 'path', placingType: c.id, placingParams: null })
    else setUI({ tool: 'place', placingType: c.id, placingParams: params ?? null })
  }

  const row = (c: CatalogItem) => (
    <li key={c.id}>
      <button className="lib-item" aria-pressed={placing === c.id} draggable
        onClick={() => start(c)}
        onDragStart={(e) => { e.dataTransfer.setData('application/x-garden-item', c.id); e.dataTransfer.effectAllowed = 'copy'; setUI({ placingType: c.id, tool: 'select' }) }}
        onDragEnd={() => setUI({ placingType: null })}>
        <Thumb id={c.id} />
        <span className="lib-name">{nameOf(c)}<small>{c.kind === 'polyline' ? '↦ ' : ''}{c.height ? `${c.height} m` : ''}</small></span>
      </button>
    </li>
  )

  return (
    <div>
      <input className="search" type="search" placeholder={t('lib.search')} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t('lib.search')} />
      <p className="hint">{t('lib.hint')}</p>
      <input ref={fileRef} type="file" accept=".glb,.gltf,model/gltf-binary" hidden onChange={(e) => onGlb(e.target.files?.[0])} />
      {filtered ? (
        filtered.length ? <ul className="lib-list">{filtered.map(row)}</ul> : <p className="hint">{t('lib.none')}</p>
      ) : (
        CATEGORIES.map((cat) => {
          const items = CATALOG.filter((c) => c.category === cat.id)
          if (!items.length) return null
          const isOpen = open[cat.id]
          return (
            <section key={cat.id} className="lib-cat">
              <button className="lib-cat-h" aria-expanded={!!isOpen} onClick={() => setOpen({ ...open, [cat.id]: !isOpen })}>
                <span>{cat.icon} {cat.name[lang]}</span><span>{items.length} {isOpen ? '▾' : '▸'}</span>
              </button>
              {isOpen && cat.id === 'custom' ? (
                <div>
                  <div className="btn-row"><button className="btn primary" onClick={() => fileRef.current?.click()}>{lang === 'fa' ? 'وارد کردن GLB…' : 'Import GLB / glTF…'}</button></div>
                  <ul className="lib-list">{Object.values(assets ?? {}).map((a) => (
                    <li key={a.id}><button className="lib-item" onClick={() => start(CATALOG_BY_ID['custom-glb'], { assetId: a.id })}><span className="thumb">📦</span><span className="lib-name">{a.name}</span></button></li>
                  ))}</ul>
                </div>
              ) : isOpen && <ul className="lib-list">{items.map(row)}</ul>}
            </section>
          )
        })
      )}
    </div>
  )
}
