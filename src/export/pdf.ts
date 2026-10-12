import { useStore, activeScenario } from '../store/store'
import { engine } from '../render/engine'
import { CATALOG_BY_ID, CATEGORIES } from '../data/catalog'
import { PLANTS } from '../data/plants'
import { plantSizeAt } from '../core/growth'
import { shapeOf } from '../core/footprint'
import { rectCorners, polylineLength, type Shape } from '../core/geometry2d'
import { contourLines } from '../core/analysis/contours'
import { computeQuantities } from '../core/quantities'
import { houseShape } from '../core/collision'
import { formatDates, toPersianDigits, translateDyn } from '../i18n'
import type { PlacedObject } from '../core/project'

const ROLE_COLOR: Record<string, string> = {
  tree: '#4caf50', shrub: '#9ccc65', bed: '#a1887f', 'bed-leafy': '#8d6e63', greenhouse: '#80deea', coop: '#ffb74d', livestock: '#ffb74d', hive: '#fdd835', 'bee-water': '#4fc3f7',
  'water-source': '#4fc3f7', tank: '#4fc3f7', well: '#4fc3f7', pond: '#29b6f6', compost: '#a1887f', house: '#ef9a9a', shed: '#bcaaa4', shade: '#ce93d8', path: '#bdbdbd', pipe: '#1e88e5',
  barrier: '#66bb6a', wall: '#757575', swale: '#8d6e63', none: '#cfd8dc',
}
const ROLE_NAMES: Record<string, [string, string]> = {
  tree: ['Trees', 'درختان'], shrub: ['Shrubs & vines', 'درختچه و مو'], bed: ['Beds', 'باغچه‌ها'], 'bed-leafy': ['Vegetable beds', 'باغچه سبزی'], greenhouse: ['Greenhouse / tunnel', 'گلخانه'],
  coop: ['Poultry', 'طیور'], livestock: ['Livestock', 'دام'], hive: ['Beehives', 'کندوها'], 'bee-water': ['Water', 'آب'], 'water-source': ['Water points', 'نقاط آب'], tank: ['Water tanks', 'مخازن آب'], well: ['Well', 'چاه'],
  pond: ['Pond', 'برکه'], compost: ['Compost', 'کمپوست'], house: ['House / cabin', 'کابین / خانه'], shed: ['Sheds', 'انبارها'], shade: ['Shade structures', 'سایه‌بان‌ها'], path: ['Paths', 'مسیرها'],
  pipe: ['Pipes', 'لوله‌ها'], barrier: ['Hedges / barriers', 'پرچین / مانع'], wall: ['Retaining walls', 'دیوار حائل'], swale: ['Swales', 'سوئیل'], none: ['Other', 'سایر'],
}
const hex = (h: string): [number, number, number] => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]

export interface PdfOptions { paper?: 'a3' | 'a2' | 'a4'; denominator?: number; lang: 'en' | 'fa'; persianDigits: boolean }

const PAPER: Record<string, [number, number]> = { a4: [297, 210], a3: [420, 297], a2: [594, 420] }

/** Vector plan drawing: title block, scale bar, north arrow, legend, contours, grid, dimensions, every object footprint. */
export async function buildPlanPDF(opts: PdfOptions): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const st = useStore.getState()
  const project = st.project
  const site = project.site
  const sc = activeScenario(project)
  const objs = Object.values(sc.objects).filter((o) => !o.hidden)
  const t = engine.terrain
  const fa = opts.lang === 'fa'
  const [pw, ph] = PAPER[opts.paper ?? 'a3']
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [pw, ph] })
  if (fa) {
    const url = (await import('vazirmatn/fonts/ttf/Vazirmatn-Regular.ttf?url')).default
    const buf = await (await fetch(url)).arrayBuffer()
    let bin = ''
    const u8 = new Uint8Array(buf)
    for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode(...u8.subarray(i, i + 0x8000))
    doc.addFileToVFS('Vazirmatn-Regular.ttf', btoa(bin))
    doc.addFont('Vazirmatn-Regular.ttf', 'Vazirmatn', 'normal')
    doc.addFont('Vazirmatn-Regular.ttf', 'Vazirmatn', 'bold')
    doc.setFont('Vazirmatn')
  } else doc.setFont('helvetica')
  const dig = (s: string | number) => (fa || opts.persianDigits ? toPersianDigits(String(s)) : String(s))
  const T = (key: string, vars?: Record<string, string | number>) => translateDyn(opts.lang, key, vars)
  const shape = (s: string) => (fa ? (doc as any).processArabic(s) : s)
  const text = (s: string, x: number, y: number, o: { align?: 'left' | 'right' | 'center'; size?: number; bold?: boolean; color?: [number, number, number] } = {}) => {
    doc.setFontSize(o.size ?? 8)
    if (!fa) doc.setFont('helvetica', o.bold ? 'bold' : 'normal')
    doc.setTextColor(...(o.color ?? [30, 40, 30]))
    doc.text(shape(s), x, y, { align: o.align ?? 'left' })
  }
  const margin = 10, tbW = 82
  const area = { x: margin, y: margin, w: pw - margin * 2 - tbW - 6, h: ph - margin * 2 }
  // scale
  const pad = 5 // metres of margin around the plot
  const needW = site.width + pad * 2, needH = site.depth + pad * 2
  const denominators = [20, 25, 50, 75, 100, 125, 150, 200, 250, 300, 400, 500, 750, 1000]
  const denom = opts.denominator ?? denominators.find((d) => (needW * 1000) / d <= area.w && (needH * 1000) / d <= area.h) ?? 1000
  const k = 1000 / denom // mm per metre
  const ox = area.x + (area.w - needW * k) / 2 + pad * k, oy = area.y + (area.h - needH * k) / 2 + pad * k
  const X = (x: number) => ox + x * k, Z = (z: number) => oy + z * k

  // frame
  doc.setDrawColor(40, 50, 40); doc.setLineWidth(0.5)
  doc.rect(margin - 3, margin - 3, pw - 2 * (margin - 3), ph - 2 * (margin - 3))
  doc.setLineWidth(0.2); doc.rect(area.x, area.y, area.w, area.h)

  // ground tint
  doc.setFillColor(243, 247, 236); doc.rect(X(0), Z(0), site.width * k, site.depth * k, 'F')
  // 5 m grid + ticks
  doc.setDrawColor(205, 214, 198); doc.setLineWidth(0.1)
  for (let x = 0; x <= site.width + 1e-6; x += 5) doc.line(X(x), Z(0), X(x), Z(site.depth))
  for (let z = 0; z <= site.depth + 1e-6; z += 5) doc.line(X(0), Z(z), X(site.width), Z(z))
  // contours (0.5 m minor / 2 m major) over plot + 3 m margin, clipped to plot
  const cl = contourLines(t.groundAt, 0, 0, site.width, site.depth, 0.5, 0.5, 4)
  for (const lv of cl) {
    if (lv.major) { doc.setDrawColor(140, 100, 60); doc.setLineWidth(0.3) } else { doc.setDrawColor(190, 160, 120); doc.setLineWidth(0.12) }
    for (const s of lv.segments) doc.line(X(s[0]), Z(s[1]), X(s[2]), Z(s[3]))
    if (lv.major && lv.segments.length) {
      const s = lv.segments[Math.floor(lv.segments.length * 0.15)]
      text(dig(`${lv.level.toFixed(0)} m`), X(s[0]), Z(s[1]) - 0.8, { size: 5, color: [120, 80, 40] })
    }
  }
  // edge ticks
  doc.setDrawColor(40, 50, 40); doc.setLineWidth(0.2)
  for (let x = 0; x <= site.width + 1e-6; x += 5) { doc.line(X(x), Z(site.depth), X(x), Z(site.depth) + 1.5); text(dig(x), X(x), Z(site.depth) + 4.5, { size: 5.5, align: 'center' }) }
  for (let z = 0; z <= site.depth + 1e-6; z += 5) { doc.line(X(0) - 1.5, Z(z), X(0), Z(z)); text(dig(z), X(0) - 2.4, Z(z) + 0.8, { size: 5.5, align: 'right' }) }

  const poly = (pts: { x: number; z: number }[], style: 'S' | 'F' | 'FD', closed = true) => {
    const p = pts.map((q) => [X(q.x), Z(q.z)] as [number, number])
    const lines = p.slice(1).map((q, i) => [q[0] - p[i][0], q[1] - p[i][1]])
    ;(doc as any).lines(lines, p[0][0], p[0][1], [1, 1], style, closed)
  }
  const fillOpacity = (a: number) => { (doc as any).setGState((doc as any).GState({ opacity: a })) }

  // house
  const hs = houseShape(site) as Extract<Shape, { type: 'rect' }>
  const hw = site.house.width, hd = site.house.depth
  const hcx = hs.x, hcz = hs.z
  doc.setFillColor(...hex(ROLE_COLOR.house)); doc.setDrawColor(90, 40, 40); doc.setLineWidth(0.4)
  doc.rect(X(hcx - hw / 2), Z(hcz - hd / 2), hw * k, hd * k, 'FD')
  doc.setLineWidth(0.15); doc.line(X(hcx - hw / 2), Z(hcz), X(hcx + hw / 2), Z(hcz)) // ridge
  text(fa ? 'کابین' : 'Cabin', X(hcx), Z(hcz) - 0.8, { size: 7, align: 'center', bold: true })
  text(dig(`${hw} × ${hd} m`), X(hcx), Z(hcz) + 2.6, { size: 6, align: 'center' })

  // polylines first (under footprints)
  for (const o of objs) {
    const item = CATALOG_BY_ID[o.type]
    if (!item || item.kind !== 'polyline' || !o.points || o.points.length < 2) continue
    const w = typeof o.params.width === 'number' ? (o.params.width as number) : item.polyline!.width
    const col = hex(ROLE_COLOR[item.role] ?? '#999999')
    doc.setDrawColor(...col)
    if (item.role === 'path') { doc.setLineWidth(Math.max(0.3, w * k)); (doc as any).setLineCap('butt') }
    else if (item.role === 'pipe') { doc.setLineWidth(0.35); (doc as any).setLineDashPattern([1.2, 0.8], 0) }
    else if (item.role === 'swale') { doc.setLineWidth(Math.max(0.4, w * k * 0.5)); (doc as any).setLineDashPattern([2, 1], 0) }
    else if (item.model === 'retaining-wall') { doc.setLineWidth(Math.max(0.5, w * k)); doc.setDrawColor(90, 90, 90) }
    else { doc.setLineWidth(Math.max(0.4, w * k)) }
    const pts = o.points
    for (let i = 1; i < pts.length; i++) doc.line(X(pts[i - 1].x), Z(pts[i - 1].z), X(pts[i].x), Z(pts[i].z))
    ;(doc as any).setLineDashPattern([], 0)
    const mid = pts[Math.floor(pts.length / 2)]
    text(`${o.label || item.name[opts.lang]} ${dig(polylineLength(pts).toFixed(1))} m`, X(mid.x), Z(mid.z) - 1.2, { size: 5.5, align: 'center' })
  }

  // footprints
  const labelled: { s: string; x: number; z: number }[] = []
  const age = st.ui.time.ageYears
  for (const o of objs) {
    const item = CATALOG_BY_ID[o.type]
    if (!item || item.kind !== 'point') continue
    const sh = shapeOf(o)
    if (!sh) continue
    const col = hex(ROLE_COLOR[item.role] ?? '#cfd8dc')
    doc.setFillColor(...col); doc.setDrawColor(60, 70, 60); doc.setLineWidth(0.2)
    if (item.model === 'plant-tree' && item.plant) {
      const size = plantSizeAt(PLANTS[item.plant], Math.max(0, age + o.ageOffset))
      fillOpacity(0.55); doc.circle(X(o.x), Z(o.z), (size.canopy / 2) * k, 'FD'); fillOpacity(1)
      doc.setFillColor(80, 60, 40); doc.circle(X(o.x), Z(o.z), Math.max(0.5, 0.18 * k), 'F')
      // dashed mature canopy
      doc.setDrawColor(90, 140, 90); doc.setLineWidth(0.12); (doc as any).setLineDashPattern([0.8, 0.6], 0)
      doc.circle(X(o.x), Z(o.z), (PLANTS[item.plant].matureCanopy / 2) * k, 'S'); (doc as any).setLineDashPattern([], 0)
      labelled.push({ s: o.label || item.name[opts.lang], x: o.x, z: o.z + size.canopy / 2 + 0.9 })
      continue
    }
    if (sh.type === 'circle') { fillOpacity(0.8); doc.circle(X(sh.x), Z(sh.z), sh.r * k, 'FD'); fillOpacity(1) }
    else {
      const c = rectCorners(sh)
      fillOpacity(0.8); poly(c, 'FD'); fillOpacity(1)
      if (item.role === 'hive') { // entrance direction arrow
        const fx = Math.sin(o.rotY), fz = Math.cos(o.rotY)
        doc.setDrawColor(150, 100, 0); doc.setLineWidth(0.4)
        doc.line(X(o.x), Z(o.z), X(o.x + fx * 1.4), Z(o.z + fz * 1.4))
      }
    }
    const dims = sh.type === 'rect' ? `${dig((sh.w).toFixed(1))}×${dig((sh.d).toFixed(1))}` : `⌀${dig((sh.r * 2).toFixed(1))}`
    labelled.push({ s: `${o.label || item.name[opts.lang]}${item.role === 'bed' || item.role === 'bed-leafy' || sh.type === 'rect' && sh.w > 1.8 ? ' ' + dims : ''}`, x: o.x, z: o.z })
  }
  for (const l of labelled) text(l.s, X(l.x), Z(l.z) + 0.8, { size: 5.5, align: 'center' })

  // boundary + gates
  doc.setDrawColor(20, 20, 20); doc.setLineWidth(0.9); doc.rect(X(0), Z(0), site.width * k, site.depth * k)
  for (const g of site.gates) {
    doc.setDrawColor(235, 140, 20); doc.setLineWidth(1.4)
    const a = g.offset, b = g.offset + g.width
    if (g.edge === 'west') doc.line(X(0), Z(a), X(0), Z(b)); else if (g.edge === 'east') doc.line(X(site.width), Z(a), X(site.width), Z(b))
    else if (g.edge === 'north') doc.line(X(a), Z(0), X(b), Z(0)); else doc.line(X(a), Z(site.depth), X(b), Z(site.depth))
    const lx = g.edge === 'west' ? X(0) - 2 : g.edge === 'east' ? X(site.width) + 2 : X((a + b) / 2)
    const lz = g.edge === 'north' ? Z(0) - 2 : g.edge === 'south' ? Z(site.depth) + 2 : Z((a + b) / 2)
    text(dig(`${g.width} m`), lx, lz, { size: 5.5, align: g.edge === 'west' ? 'right' : g.edge === 'east' ? 'left' : 'center', color: [180, 90, 0] })
  }
  // overall dimensions
  doc.setDrawColor(40, 50, 40); doc.setLineWidth(0.2)
  const dy = Z(0) - 7
  doc.line(X(0), dy, X(site.width), dy); doc.line(X(0), dy - 1.5, X(0), dy + 1.5); doc.line(X(site.width), dy - 1.5, X(site.width), dy + 1.5)
  text(dig(`${site.width} m`), X(site.width / 2), dy - 1, { align: 'center', size: 7, bold: true })
  const dx = X(site.width) + 9
  doc.line(dx, Z(0), dx, Z(site.depth)); doc.line(dx - 1.5, Z(0), dx + 1.5, Z(0)); doc.line(dx - 1.5, Z(site.depth), dx + 1.5, Z(site.depth))
  doc.text(shape(dig(`${site.depth} m`)), dx + 3.2, Z(site.depth / 2), { angle: 90, align: 'center' })
  // slope arrow
  text(dig(`${T('an.layer.slope')} ${site.slopeDeg}° ↓`), X(site.width / 2), Z(site.depth) + 10, { size: 6.5, align: 'center', color: [120, 80, 40] })

  // ---- title block
  const bx = pw - margin - tbW
  doc.setDrawColor(40, 50, 40); doc.setLineWidth(0.4); doc.rect(bx, margin, tbW, ph - 2 * margin)
  let y = margin + 9
  const right = fa
  const lx = right ? bx + tbW - 4 : bx + 4
  const al = right ? 'right' : 'left'
  text(project.name || 'Garden', lx, y, { size: 14, bold: true, align: al }); y += 6
  text(sc.name, lx, y, { size: 10, align: al }); y += 8
  const dt = st.ui.time
  const dates = formatDates(dt.year, dt.month, dt.day, opts.lang, opts.persianDigits)
  const rowT = (label: string, val: string) => { text(label, lx, y, { size: 7, color: [100, 110, 100], align: al }); y += 3.6; text(val, lx, y, { size: 8.5, align: al }); y += 5.2 }
  rowT(fa ? 'مقیاس' : 'Scale', dig(`1:${denom}  (${(opts.paper ?? 'a3').toUpperCase()})`))
  rowT(fa ? 'تاریخ' : 'Date', `${dates.greg}${fa ? '' : ' / ' + dates.jal}`)
  rowT(fa ? 'سن درختان' : 'Tree age', dig(`${age} ${fa ? 'سال' : 'yr'}`))
  rowT(fa ? 'موقعیت' : 'Location', dig(`${site.lat.toFixed(4)}°N, ${site.lon.toFixed(4)}°E`))
  rowT(fa ? 'زمین' : 'Plot', dig(`${site.width} × ${site.depth} m  (${(site.width * site.depth).toFixed(0)} m²)`))
  // north arrow
  const nx = bx + tbW - 14, ny = margin + 18
  doc.setFillColor(40, 50, 40); doc.setDrawColor(40, 50, 40); doc.setLineWidth(0.3)
  doc.circle(nx, ny, 7, 'S')
  doc.triangle(nx, ny - 6.2, nx - 2.4, ny + 3, nx, ny + 1.5, 'F'); doc.setFillColor(255, 255, 255); doc.triangle(nx, ny - 6.2, nx + 2.4, ny + 3, nx, ny + 1.5, 'FD')
  text(fa ? 'ش' : 'N', nx, ny - 8.5, { size: 8, bold: true, align: 'center' })
  // scale bar
  y += 2
  const bar = [0, 5, 10]
  const sbx = right ? bx + tbW - 4 - 10 * k : bx + 4
  doc.setLineWidth(0.3)
  for (let i = 0; i < 2; i++) { doc.setFillColor(i % 2 ? 255 : 40, i % 2 ? 255 : 50, i % 2 ? 255 : 40); doc.rect(sbx + bar[i] * k, y, 5 * k, 2, 'FD') }
  bar.forEach((b) => text(dig(b), sbx + b * k, y + 5, { size: 6, align: 'center' }))
  text('m', sbx + 10 * k + 4, y + 5, { size: 6 })
  y += 12
  // legend
  text(fa ? 'راهنما' : 'Legend', lx, y, { size: 9, bold: true, align: al }); y += 4.5
  const usedRoles = new Set<string>(); const usedCats = new Map<string, string>()
  const roleName = (r: string) => (ROLE_NAMES[r] ?? ROLE_NAMES.none)[fa ? 1 : 0]
  for (const o of objs) { const it = CATALOG_BY_ID[o.type]; if (it) { usedRoles.add(it.role); usedCats.set(it.role, roleName(it.role)) } }
  usedRoles.add('house')
  for (const role of usedRoles) {
    if (y > ph - margin - 58) break
    doc.setFillColor(...hex(ROLE_COLOR[role] ?? '#cfd8dc')); doc.setDrawColor(60, 70, 60); doc.setLineWidth(0.15)
    const swx = right ? bx + tbW - 4 - 5 : bx + 4
    doc.rect(swx, y - 2.6, 5, 3.2, 'FD')
    const label = usedCats.get(role) ?? roleName(role)
    text(label, right ? swx - 2 : swx + 7, y, { size: 6.5, align: al }); y += 4.2
  }
  y += 2
  const q = computeQuantities(objs, site)
  text(fa ? 'مقادیر' : 'Quantities', lx, y, { size: 9, bold: true, align: al }); y += 4.5
  const qrows: [string, string][] = [
    [T('q.trees'), dig(q.totals.trees)], [T('q.beds'), dig(`${q.totals.beds} · ${q.totals.bedArea.toFixed(1)} m²`)], [T('q.paths'), dig(`${q.totals.pathLength.toFixed(1)} m`)],
    [T('q.fence'), dig(`${q.totals.fenceLength.toFixed(0)} m`)], [T('q.tanks'), dig(`${q.totals.tankCapacityL} L`)],
  ]
  for (const [a, b] of qrows) { text(`${a}: ${b}`, lx, y, { size: 7, align: al }); y += 4 }
  text(fa ? 'داده‌های گیاهی تقریبی است – بررسی شود' : 'Plant data approximate – verify locally', lx, ph - margin - 4, { size: 6, color: [140, 80, 20], align: al })
  text('Garden Studio', lx, ph - margin - 8, { size: 6, color: [120, 130, 120], align: al })

  return doc.output('blob')
}
