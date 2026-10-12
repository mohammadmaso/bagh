import { useEffect, useMemo, useRef, useState } from 'react'
import { CATALOG, CATEGORIES, type CatalogItem } from '../data/catalog'
import { useStore } from '../store/store'
import { useT } from '../i18n'
import { getThumbnail } from '../render/thumbnails'

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

  const nameOf = (c: CatalogItem) => c.name[lang]
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return null
    return CATALOG.filter((c) => c.name.en.toLowerCase().includes(s) || c.name.fa.includes(s) || c.tags.some((x) => x.includes(s)) || c.id.includes(s))
  }, [q])

  const start = (c: CatalogItem) => {
    if (c.kind === 'polyline') setUI({ tool: 'path', placingType: c.id })
    else setUI({ tool: 'place', placingType: c.id })
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
              {isOpen && <ul className="lib-list">{items.map(row)}</ul>}
            </section>
          )
        })
      )}
    </div>
  )
}
