import { useEffect, useState } from 'react'
import { CATALOG } from '../data/catalog'
import { renderThumbnailNow } from '../render/thumbnails'

/** Developer view (`?gallery`): renders every catalog thumbnail for visual QA. */
export function Gallery() {
  const [imgs, setImgs] = useState<Record<string, string>>({})
  useEffect(() => {
    let alive = true
    ;(async () => {
      for (const it of CATALOG) {
        if (!alive) return
        await new Promise((r) => setTimeout(r, 0))
        try { const u = renderThumbnailNow(it.id); setImgs((p) => ({ ...p, [it.id]: u })) } catch (e) { console.error(it.id, e) }
      }
      ;(window as any).__galleryDone = true
    })()
    return () => { alive = false }
  }, [])
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 6, padding: 8, overflow: 'auto', height: '100%', background: '#fff' }}>
      {CATALOG.map((it) => (
        <figure key={it.id} style={{ margin: 0, textAlign: 'center', fontSize: 11 }}>
          {imgs[it.id] ? <img src={imgs[it.id]} width={150} height={150} /> : <div style={{ width: 150, height: 150, background: '#eee' }} />}
          <figcaption>{it.id}</figcaption>
        </figure>
      ))}
    </div>
  )
}
