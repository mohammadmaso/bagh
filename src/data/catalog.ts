import { PLANTS } from './plants'

/**
 * Component catalog — data-driven. To add an item: append to CATALOG (or generate it), and if it needs a new 3D shape
 * add a builder with the same `model` key in src/render/models/structures.ts. Dimensions are metres.
 */
export type CategoryId =
  | 'fruit' | 'nut' | 'windbreak' | 'shrubs' | 'growing' | 'animals' | 'bees' | 'structures' | 'infrastructure' | 'landscape' | 'scale' | 'custom'

export interface L10n { en: string; fa: string }

export interface ParamDef {
  key: string
  label: L10n
  type: 'number' | 'select' | 'bool'
  min?: number; max?: number; step?: number
  def: number | string | boolean
  options?: { value: string; label: L10n }[]
}

export type Role =
  | 'tree' | 'shrub' | 'bed' | 'bed-leafy' | 'greenhouse' | 'coop' | 'livestock' | 'hive' | 'bee-water' | 'water-source' | 'tank' | 'well' | 'compost'
  | 'house' | 'shed' | 'path' | 'pipe' | 'barrier' | 'wall' | 'swale' | 'pond' | 'shade' | 'none'

export interface CatalogItem {
  id: string
  category: CategoryId
  name: L10n
  desc?: L10n
  icon: string
  kind: 'point' | 'polyline'
  plant?: string
  model: string
  /** footprint of the base; number or `$param` reference */
  fp: { shape: 'circle' | 'rect'; w: number | string; d: number | string }
  height: number
  params?: ParamDef[]
  /** level the terrain under the object (pad) */
  pad?: boolean
  /** tilt object to terrain slope (otherwise it stays upright) */
  alignToSlope?: boolean
  /** extra clearance (m) required around it before the overlap ghost turns red */
  clearance?: number
  role: Role
  tags: string[]
  polyline?: { width: number; minWidth: number; maxWidth: number; drape: boolean; material: string }
  /** rule-relevant metadata */
  meta?: Record<string, number | string | boolean>
}

export const CATEGORIES: { id: CategoryId; name: L10n; icon: string }[] = [
  { id: 'fruit', name: { en: 'Fruit trees', fa: 'درختان میوه' }, icon: '🍎' },
  { id: 'nut', name: { en: 'Nut trees', fa: 'درختان آجیلی' }, icon: '🌰' },
  { id: 'windbreak', name: { en: 'Windbreak & ornamental', fa: 'بادشکن و زینتی' }, icon: '🌲' },
  { id: 'shrubs', name: { en: 'Shrubs, vines & herbs', fa: 'درختچه، رز و گیاهان' }, icon: '🫐' },
  { id: 'growing', name: { en: 'Growing areas', fa: 'کشت و پرورش' }, icon: '🥬' },
  { id: 'animals', name: { en: 'Animals', fa: 'دام و طیور' }, icon: '🐔' },
  { id: 'bees', name: { en: 'Bees', fa: 'زنبورداری' }, icon: '🐝' },
  { id: 'structures', name: { en: 'Structures', fa: 'سازه‌ها' }, icon: '🏠' },
  { id: 'infrastructure', name: { en: 'Water & infrastructure', fa: 'آب و تأسیسات' }, icon: '💧' },
  { id: 'landscape', name: { en: 'Landscape', fa: 'محوطه‌سازی' }, icon: '🧱' },
  { id: 'scale', name: { en: 'Scale references', fa: 'مراجع مقیاس' }, icon: '🧍' },
  { id: 'custom', name: { en: 'Custom models', fa: 'مدل سفارشی' }, icon: '📦' },
]

const num = (key: string, en: string, fa: string, min: number, max: number, step: number, def: number): ParamDef => ({ key, label: { en, fa }, type: 'number', min, max, step, def })

const TREE_CATEGORY: Record<string, CategoryId> = {
  walnut: 'nut', hazelnut: 'nut', almond: 'nut', cypress: 'windbreak', poplar: 'windbreak', pine: 'windbreak',
}
const TREE_ICON: Record<string, string> = {
  apple: '🍎', pear: '🍐', quince: '🍋', cherry: '🍒', sourcherry: '🍒', plum: '🫐', apricot: '🍑', peach: '🍑', persimmon: '🍊', fig: '🫒',
  pomegranate: '🍎', walnut: '🌰', hazelnut: '🌰', almond: '🌰', mulberry: '🫐', jujube: '🫘', medlar: '🍂', cypress: '🌲', poplar: '🌳', pine: '🌲',
}
const TREES: CatalogItem[] = Object.keys(TREE_ICON).map((id): CatalogItem => {
  const sp = PLANTS[id]
  return {
    id, category: TREE_CATEGORY[id] ?? 'fruit', name: sp.name, icon: TREE_ICON[id], kind: 'point', plant: id, model: 'plant-tree',
    fp: { shape: 'circle', w: 0.6, d: 0.6 }, height: sp.matureHeight, role: 'tree', tags: ['tree', 'plant', sp.latin.toLowerCase(), ...(sp.juglone ? ['juglone'] : [])],
    params: [num('ageOffset', 'Age at planting (yr)', 'سن هنگام کاشت (سال)', 0, 15, 1, 0)],
  }
})

const rowItem = (id: string, name: L10n, icon: string, plant: string, len: number): CatalogItem => ({
  id, category: 'shrubs', name, icon, kind: 'point', plant, model: 'plant-row', fp: { shape: 'rect', w: '$length', d: 0.9 }, height: PLANTS[plant].matureHeight,
  role: 'shrub', tags: ['shrub', 'plant'], params: [num('length', 'Length (m)', 'طول (متر)', 0.5, 30, 0.5, len), num('rows', 'Rows', 'ردیف', 1, 4, 1, 1)],
})

const SIZE_OPTIONS = [
  { value: 'small', label: { en: 'Small (≈6 hens)', fa: 'کوچک (≈۶ مرغ)' } },
  { value: 'medium', label: { en: 'Medium (≈12 hens)', fa: 'متوسط (≈۱۲ مرغ)' } },
  { value: 'large', label: { en: 'Large (≈24 hens)', fa: 'بزرگ (≈۲۴ مرغ)' } },
]

export const CATALOG: CatalogItem[] = [
  ...TREES,
  // --- vines on structures
  { id: 'kiwi-pergola', category: 'fruit', name: PLANTS.kiwi.name, icon: '🥝', kind: 'point', plant: 'kiwi', model: 'pergola-vine', fp: { shape: 'rect', w: '$width', d: '$depth' }, height: 2.5, role: 'tree', tags: ['vine', 'pergola', 'plant'],
    params: [num('width', 'Width (m)', 'عرض (متر)', 2, 12, 0.5, 4), num('depth', 'Depth (m)', 'عمق (متر)', 2, 8, 0.5, 3), num('ageOffset', 'Age at planting (yr)', 'سن هنگام کاشت (سال)', 0, 15, 1, 0)] },
  { id: 'grape-pergola', category: 'fruit', name: { en: 'Grapevine (pergola)', fa: 'انگور (آلاچیق)' }, icon: '🍇', kind: 'point', plant: 'grape', model: 'pergola-vine', fp: { shape: 'rect', w: '$width', d: '$depth' }, height: 2.5, role: 'tree', tags: ['vine', 'pergola', 'plant'],
    params: [num('width', 'Width (m)', 'عرض (متر)', 2, 12, 0.5, 4), num('depth', 'Depth (m)', 'عمق (متر)', 2, 8, 0.5, 3), num('ageOffset', 'Age at planting (yr)', 'سن هنگام کاشت (سال)', 0, 15, 1, 0)] },
  { id: 'grape-trellis', category: 'fruit', name: { en: 'Grapevine (trellis row)', fa: 'انگور (داربست ردیفی)' }, icon: '🍇', kind: 'point', plant: 'grape', model: 'trellis-vine', fp: { shape: 'rect', w: '$length', d: 0.8 }, height: 2, role: 'shrub', tags: ['vine', 'trellis', 'plant'],
    params: [num('length', 'Length (m)', 'طول (متر)', 2, 30, 0.5, 9), num('ageOffset', 'Age at planting (yr)', 'سن هنگام کاشت (سال)', 0, 15, 1, 0)] },
  // --- shrubs / herbs
  rowItem('raspberry', PLANTS.raspberry.name, '🍓', 'raspberry', 5),
  rowItem('blackberry', PLANTS.blackberry.name, '🫐', 'blackberry', 6),
  rowItem('currant', PLANTS.currant.name, '🍇', 'currant', 4.5),
  rowItem('rose-hedge', PLANTS.rosehedge.name, '🌹', 'rosehedge', 6),
  rowItem('lavender', PLANTS.lavender.name, '💜', 'lavender', 4),
  { id: 'herb-bed', category: 'shrubs', name: { en: 'Herb bed', fa: 'باغچه گیاهان دارویی' }, icon: '🌿', kind: 'point', plant: 'herbs', model: 'plant-bed', fp: { shape: 'rect', w: '$length', d: '$width' }, height: 0.5, role: 'bed', tags: ['herb', 'bed', 'plant'],
    params: [num('length', 'Length (m)', 'طول (متر)', 0.5, 12, 0.1, 2), num('width', 'Width (m)', 'عرض (متر)', 0.5, 4, 0.1, 1.2)] },
  { id: 'hedgerow', category: 'shrubs', name: { en: 'Mixed hedgerow', fa: 'پرچین مخلوط' }, icon: '🌳', kind: 'polyline', model: 'hedgerow', fp: { shape: 'rect', w: 1, d: 1 }, height: 2, role: 'barrier', tags: ['hedge', 'plant', 'windbreak'],
    polyline: { width: 1.4, minWidth: 0.6, maxWidth: 4, drape: true, material: 'hedge' } },
  // --- growing areas
  { id: 'raised-bed', category: 'growing', name: { en: 'Raised bed', fa: 'باغچه بلند' }, icon: '🟫', kind: 'point', model: 'raised-bed', fp: { shape: 'rect', w: '$length', d: '$width' }, height: 0.4, role: 'bed-leafy', tags: ['bed', 'vegetable'],
    params: [num('length', 'Length (m)', 'طول (متر)', 0.5, 12, 0.1, 2.4), num('width', 'Width (m)', 'عرض (متر)', 0.5, 3, 0.1, 1.2), num('height', 'Height (m)', 'ارتفاع (متر)', 0.1, 1, 0.05, 0.4)] },
  { id: 'inground-bed', category: 'growing', name: { en: 'In-ground bed', fa: 'باغچه زمینی' }, icon: '🟤', kind: 'point', model: 'inground-bed', fp: { shape: 'rect', w: '$length', d: '$width' }, height: 0.15, role: 'bed-leafy', tags: ['bed', 'vegetable'],
    params: [num('length', 'Length (m)', 'طول (متر)', 0.5, 20, 0.1, 4), num('width', 'Width (m)', 'عرض (متر)', 0.5, 6, 0.1, 1.2)] },
  { id: 'potato-rows', category: 'growing', name: { en: 'Potato rows', fa: 'ردیف سیب‌زمینی' }, icon: '🥔', kind: 'point', model: 'potato-rows', fp: { shape: 'rect', w: '$length', d: '$width' }, height: 0.6, role: 'bed', tags: ['bed', 'vegetable'],
    params: [num('length', 'Length (m)', 'طول (متر)', 1, 20, 0.5, 6), num('width', 'Width (m)', 'عرض (متر)', 0.8, 6, 0.1, 2.4)] },
  { id: 'squash-patch', category: 'growing', name: { en: 'Squash patch', fa: 'کشتزار کدو' }, icon: '🎃', kind: 'point', model: 'squash-patch', fp: { shape: 'rect', w: '$length', d: '$width' }, height: 0.5, role: 'bed', tags: ['bed', 'vegetable'],
    params: [num('length', 'Length (m)', 'طول (متر)', 1, 12, 0.5, 4), num('width', 'Width (m)', 'عرض (متر)', 1, 12, 0.5, 4)] },
  { id: 'herb-spiral', category: 'growing', name: { en: 'Herb spiral', fa: 'مارپیچ گیاهان' }, icon: '🌀', kind: 'point', model: 'herb-spiral', fp: { shape: 'circle', w: 2, d: 2 }, height: 1, role: 'bed', tags: ['herb', 'bed'], params: [num('diameter', 'Diameter (m)', 'قطر (متر)', 1.5, 3, 0.1, 2)] },
  { id: 'greenhouse', category: 'growing', name: { en: 'Greenhouse (glass)', fa: 'گلخانه (شیشه‌ای)' }, icon: '🏡', kind: 'point', model: 'greenhouse', fp: { shape: 'rect', w: '$length', d: '$width' }, height: 2.8, pad: true, role: 'greenhouse', clearance: 0.5, tags: ['greenhouse', 'glass'],
    params: [num('length', 'Length (m)', 'طول (متر)', 2, 12, 0.5, 4), num('width', 'Width (m)', 'عرض (متر)', 2, 6, 0.5, 3)] },
  { id: 'polytunnel', category: 'growing', name: { en: 'Polytunnel (hoop house)', fa: 'تونل پلاستیکی' }, icon: '🏕️', kind: 'point', model: 'polytunnel', fp: { shape: 'rect', w: '$length', d: '$width' }, height: 2.4, pad: true, role: 'greenhouse', clearance: 0.5, tags: ['greenhouse', 'tunnel'],
    params: [num('length', 'Length (m)', 'طول (متر)', 3, 20, 0.5, 8), num('width', 'Width (m)', 'عرض (متر)', 2, 6, 0.5, 3.5)] },
  { id: 'cold-frame', category: 'growing', name: { en: 'Cold frame', fa: 'کلدفریم' }, icon: '🪟', kind: 'point', model: 'cold-frame', fp: { shape: 'rect', w: 1.2, d: 0.9 }, height: 0.5, role: 'bed', tags: ['frame'] },
  { id: 'ginseng-bed', category: 'growing', name: { en: 'Ginseng shade bed', fa: 'باغچه سایه‌دار جینسینگ' }, icon: '🌱', kind: 'point', model: 'ginseng-bed', fp: { shape: 'rect', w: '$length', d: '$width' }, height: 1.8, role: 'bed', tags: ['shade', 'ginseng'],
    params: [num('length', 'Length (m)', 'طول (متر)', 2, 12, 0.5, 4), num('width', 'Width (m)', 'عرض (متر)', 1, 4, 0.5, 1.5)] },
  { id: 'shiitake-rack', category: 'growing', name: { en: 'Shiitake log rack', fa: 'قفسه کنده شیتاکه' }, icon: '🍄', kind: 'point', model: 'shiitake-rack', fp: { shape: 'rect', w: 2, d: 0.9 }, height: 1.1, role: 'shade', tags: ['mushroom', 'shiitake'] },
  { id: 'mushroom-house', category: 'growing', name: { en: 'Mushroom shade house', fa: 'سایه‌بان قارچ' }, icon: '🍄', kind: 'point', model: 'mushroom-house', fp: { shape: 'rect', w: 3, d: 2.4 }, height: 2.2, role: 'shade', pad: true, tags: ['mushroom', 'shade'] },
  { id: 'nursery-table', category: 'growing', name: { en: 'Nursery / seedling table', fa: 'میز نشاء' }, icon: '🪴', kind: 'point', model: 'nursery-table', fp: { shape: 'rect', w: '$length', d: 0.8 }, height: 0.9, role: 'none', tags: ['nursery'], params: [num('length', 'Length (m)', 'طول (متر)', 1, 5, 0.5, 2)] },
  // --- animals
  { id: 'chicken-coop', category: 'animals', name: { en: 'Chicken coop with run', fa: 'مرغدانی با محوطه' }, icon: '🐔', kind: 'point', model: 'coop', fp: { shape: 'rect', w: '$totalLength', d: '$runWidth' }, height: 2, pad: true, role: 'coop', clearance: 0.3, tags: ['chicken', 'coop', 'livestock'], meta: { livestock: true, hens: 12 },
    params: [{ key: 'size', label: { en: 'Size', fa: 'اندازه' }, type: 'select', def: 'medium', options: SIZE_OPTIONS }, num('runLength', 'Run length (m)', 'طول محوطه (متر)', 1, 10, 0.5, 3), num('runWidth', 'Width (m)', 'عرض (متر)', 1.2, 5, 0.1, 2),
      { key: 'totalLength', label: { en: 'Total length', fa: 'طول کل' }, type: 'number', def: 4.6, min: 0, max: 0 }] },
  { id: 'chicken-tractor', category: 'animals', name: { en: 'Chicken tractor', fa: 'مرغدانی متحرک' }, icon: '🐓', kind: 'point', model: 'chicken-tractor', fp: { shape: 'rect', w: 2.4, d: 1.2 }, height: 0.9, role: 'livestock', clearance: 0.2, tags: ['chicken', 'livestock'], meta: { livestock: true } },
  { id: 'rabbit-hutches', category: 'animals', name: { en: 'Rabbit hutch row', fa: 'ردیف لانه خرگوش' }, icon: '🐇', kind: 'point', model: 'rabbit-hutches', fp: { shape: 'rect', w: '$count', d: 0.9 }, height: 1.5, role: 'livestock', clearance: 0.3, tags: ['rabbit', 'livestock'], meta: { livestock: true },
    params: [num('count', 'Hutches', 'تعداد', 1, 6, 1, 3)] },
  { id: 'goose-house', category: 'animals', name: { en: 'Goose house & pond', fa: 'لانه غاز و آبگیر' }, icon: '🪿', kind: 'point', model: 'goose-house', fp: { shape: 'rect', w: 4.5, d: 2.4 }, height: 1.4, pad: true, role: 'livestock', clearance: 0.3, tags: ['goose', 'livestock', 'pond'], meta: { livestock: true } },
  { id: 'goat-shelter', category: 'animals', name: { en: 'Goat shelter', fa: 'آغل بز' }, icon: '🐐', kind: 'point', model: 'goat-shelter', fp: { shape: 'rect', w: 4, d: 3 }, height: 2.2, pad: true, role: 'livestock', clearance: 0.3, tags: ['goat', 'livestock'], meta: { livestock: true } },
  // --- bees
  { id: 'hive-langstroth', category: 'bees', name: { en: 'Langstroth hive', fa: 'کندوی لانگستروث' }, icon: '🐝', kind: 'point', model: 'hive-langstroth', fp: { shape: 'rect', w: 0.6, d: 0.5 }, height: 1.1, role: 'hive', tags: ['bee', 'hive'], meta: { flightCone: true },
    params: [num('boxes', 'Boxes', 'تعداد طبقه', 1, 3, 1, 2)] },
  { id: 'hive-topbar', category: 'bees', name: { en: 'Top-bar hive', fa: 'کندوی تاپ‌بار' }, icon: '🐝', kind: 'point', model: 'hive-topbar', fp: { shape: 'rect', w: 1.2, d: 0.5 }, height: 0.95, role: 'hive', tags: ['bee', 'hive'], meta: { flightCone: true } },
  { id: 'hive-stand', category: 'bees', name: { en: 'Hive stand (2 hives)', fa: 'پایه کندو' }, icon: '🪵', kind: 'point', model: 'hive-stand', fp: { shape: 'rect', w: 1.4, d: 0.6 }, height: 0.4, role: 'none', tags: ['bee'] },
  { id: 'bee-water', category: 'bees', name: { en: 'Bee water station', fa: 'آبشخور زنبور' }, icon: '💧', kind: 'point', model: 'bee-water', fp: { shape: 'circle', w: 0.6, d: 0.6 }, height: 0.3, role: 'bee-water', tags: ['bee', 'water'] },
  { id: 'flight-barrier', category: 'bees', name: { en: 'Flight-barrier hedge / screen', fa: 'پرچین/پرده مسیر پرواز' }, icon: '🧱', kind: 'polyline', model: 'flight-barrier', fp: { shape: 'rect', w: 1, d: 1 }, height: 2.2, role: 'barrier', tags: ['bee', 'barrier'],
    polyline: { width: 0.5, minWidth: 0.2, maxWidth: 2, drape: true, material: 'screen' }, meta: { barrierHeight: 2.2 } },
  // --- structures
  { id: 'house-future', category: 'structures', name: { en: 'Future wooden house', fa: 'خانه چوبی آینده' }, icon: '🏠', kind: 'point', model: 'house-gable', fp: { shape: 'rect', w: '$width', d: '$depth' }, height: 5, pad: true, role: 'house', clearance: 1, tags: ['house', 'template'],
    params: [num('width', 'Width (m)', 'عرض (متر)', 4, 14, 0.5, 8), num('depth', 'Depth (m)', 'عمق (متر)', 4, 12, 0.5, 6), num('wallHeight', 'Wall height (m)', 'ارتفاع دیوار (متر)', 2.4, 4, 0.1, 2.8), num('pitch', 'Roof pitch (°)', 'شیب سقف (درجه)', 10, 50, 1, 30)] },
  { id: 'tool-shed', category: 'structures', name: { en: 'Tool shed', fa: 'انبار ابزار' }, icon: '🛖', kind: 'point', model: 'shed', fp: { shape: 'rect', w: '$width', d: '$depth' }, height: 2.4, pad: true, role: 'shed', clearance: 0.4, tags: ['shed'],
    params: [num('width', 'Width (m)', 'عرض (متر)', 1.5, 6, 0.5, 3), num('depth', 'Depth (m)', 'عمق (متر)', 1.5, 5, 0.5, 2.4)] },
  { id: 'firewood-shelter', category: 'structures', name: { en: 'Firewood shelter', fa: 'هیزم‌خانه' }, icon: '🪵', kind: 'point', model: 'firewood', fp: { shape: 'rect', w: 3, d: 1 }, height: 1.8, role: 'shed', tags: ['firewood'] },
  { id: 'pergola', category: 'structures', name: { en: 'Pergola', fa: 'آلاچیق (پرگولا)' }, icon: '⛩️', kind: 'point', model: 'pergola', fp: { shape: 'rect', w: '$width', d: '$depth' }, height: 2.6, role: 'shade', tags: ['pergola'],
    params: [num('width', 'Width (m)', 'عرض (متر)', 2, 10, 0.5, 4), num('depth', 'Depth (m)', 'عمق (متر)', 2, 8, 0.5, 3)] },
  { id: 'gazebo', category: 'structures', name: { en: 'Gazebo', fa: 'کوشک' }, icon: '🛕', kind: 'point', model: 'gazebo', fp: { shape: 'circle', w: 3.6, d: 3.6 }, height: 3.2, pad: true, role: 'shade', tags: ['gazebo'], params: [num('diameter', 'Diameter (m)', 'قطر (متر)', 2.5, 6, 0.1, 3.6)] },
  { id: 'compost-bins', category: 'structures', name: { en: '3-bay compost bins', fa: 'کمپوست سه‌محفظه‌ای' }, icon: '♻️', kind: 'point', model: 'compost', fp: { shape: 'rect', w: 3.6, d: 1.2 }, height: 1.1, role: 'compost', clearance: 0.3, tags: ['compost'], meta: { pollutes: true } },
  // --- water / infrastructure
  { id: 'tank-ibc', category: 'infrastructure', name: { en: 'IBC tank 1000 L', fa: 'مخزن IBC ۱۰۰۰ لیتری' }, icon: '🧊', kind: 'point', model: 'tank-ibc', fp: { shape: 'rect', w: 1.2, d: 1 }, height: 1.2, pad: true, role: 'tank', tags: ['tank', 'water'], meta: { capacityL: 1000, waterSource: true } },
  { id: 'tank-poly', category: 'infrastructure', name: { en: 'Poly tank on stand', fa: 'مخزن پلی‌اتیلن روی پایه' }, icon: '🛢️', kind: 'point', model: 'tank-poly', fp: { shape: 'circle', w: '$dia', d: '$dia' }, height: 3, pad: true, role: 'tank', tags: ['tank', 'water'], meta: { waterSource: true },
    params: [{ key: 'liters', label: { en: 'Capacity', fa: 'ظرفیت' }, type: 'select', def: '3000', options: ['2000', '3000', '5000'].map((v) => ({ value: v, label: { en: `${v} L`, fa: `${v} لیتر` } })) }, { key: 'dia', label: { en: 'Diameter', fa: 'قطر' }, type: 'number', def: 1.6, min: 0, max: 0 }] },
  { id: 'well', category: 'infrastructure', name: { en: 'Well / borehole + hand pump', fa: 'چاه با پمپ دستی' }, icon: '🪣', kind: 'point', model: 'well', fp: { shape: 'circle', w: 1, d: 1 }, height: 1.4, pad: true, role: 'well', clearance: 0.3, tags: ['well', 'water'], meta: { waterSource: true } },
  { id: 'pond', category: 'infrastructure', name: { en: 'Pond', fa: 'برکه' }, icon: '🏞️', kind: 'point', model: 'pond', fp: { shape: 'circle', w: '$diameter', d: '$diameter' }, height: 0.1, pad: true, role: 'pond', tags: ['pond', 'water'], meta: { waterSource: true }, params: [num('diameter', 'Diameter (m)', 'قطر (متر)', 2, 15, 0.5, 5)] },
  { id: 'solar-array', category: 'infrastructure', name: { en: 'Ground-mount solar array', fa: 'پنل خورشیدی زمینی' }, icon: '☀️', kind: 'point', model: 'solar', fp: { shape: 'rect', w: '$panels', d: 2.2 }, height: 1.6, role: 'none', tags: ['solar'], params: [num('panels', 'Width (m)', 'عرض (متر)', 2, 12, 1, 5)] },
  { id: 'tap', category: 'infrastructure', name: { en: 'Water tap point', fa: 'شیر آب' }, icon: '🚰', kind: 'point', model: 'tap', fp: { shape: 'circle', w: 0.3, d: 0.3 }, height: 0.9, role: 'water-source', tags: ['tap', 'water'], meta: { waterSource: true } },
  { id: 'outdoor-sink', category: 'infrastructure', name: { en: 'Outdoor sink', fa: 'سینک بیرونی' }, icon: '🚿', kind: 'point', model: 'sink', fp: { shape: 'rect', w: 1.4, d: 0.7 }, height: 1.0, role: 'water-source', tags: ['sink'], meta: { waterSource: true } },
  { id: 'bench', category: 'infrastructure', name: { en: 'Bench', fa: 'نیمکت' }, icon: '🪑', kind: 'point', model: 'bench', fp: { shape: 'rect', w: 1.6, d: 0.5 }, height: 0.85, role: 'none', tags: ['bench'] },
  { id: 'picnic-table', category: 'infrastructure', name: { en: 'Picnic table', fa: 'میز پیک‌نیک' }, icon: '🍽️', kind: 'point', model: 'picnic', fp: { shape: 'rect', w: 2, d: 1.7 }, height: 0.8, role: 'none', tags: ['table'] },
  { id: 'light-post', category: 'infrastructure', name: { en: 'Light post', fa: 'تیر روشنایی' }, icon: '💡', kind: 'point', model: 'light-post', fp: { shape: 'circle', w: 0.2, d: 0.2 }, height: 3, role: 'none', tags: ['light'] },
  { id: 'parking-pad', category: 'infrastructure', name: { en: 'Parking pad', fa: 'پارکینگ' }, icon: '🅿️', kind: 'point', model: 'parking', fp: { shape: 'rect', w: '$width', d: '$depth' }, height: 0.05, pad: true, role: 'path', tags: ['parking'], params: [num('width', 'Width (m)', 'عرض (متر)', 2.5, 10, 0.5, 3), num('depth', 'Depth (m)', 'عمق (متر)', 4, 10, 0.5, 5.5)] },
  // --- landscape (polylines & areas)
  { id: 'path-gravel', category: 'landscape', name: { en: 'Gravel path', fa: 'مسیر شنی' }, icon: '〰️', kind: 'polyline', model: 'path', fp: { shape: 'rect', w: 1, d: 1 }, height: 0.04, role: 'path', tags: ['path'], polyline: { width: 1.2, minWidth: 0.4, maxWidth: 5, drape: true, material: 'gravel' } },
  { id: 'path-stone', category: 'landscape', name: { en: 'Stepping-stone / paved path', fa: 'مسیر سنگ‌فرش' }, icon: '〰️', kind: 'polyline', model: 'path', fp: { shape: 'rect', w: 1, d: 1 }, height: 0.05, role: 'path', tags: ['path'], polyline: { width: 1.2, minWidth: 0.4, maxWidth: 5, drape: true, material: 'stone' } },
  { id: 'path-mulch', category: 'landscape', name: { en: 'Mulch path', fa: 'مسیر مالچ' }, icon: '〰️', kind: 'polyline', model: 'path', fp: { shape: 'rect', w: 1, d: 1 }, height: 0.04, role: 'path', tags: ['path'], polyline: { width: 0.9, minWidth: 0.4, maxWidth: 4, drape: true, material: 'mulch' } },
  { id: 'path-grass', category: 'landscape', name: { en: 'Mown grass path', fa: 'مسیر چمنی' }, icon: '〰️', kind: 'polyline', model: 'path', fp: { shape: 'rect', w: 1, d: 1 }, height: 0.02, role: 'path', tags: ['path'], polyline: { width: 1.0, minWidth: 0.4, maxWidth: 4, drape: true, material: 'grass' } },
  { id: 'steps', category: 'landscape', name: { en: 'Steps', fa: 'پله' }, icon: '🪜', kind: 'point', model: 'steps', fp: { shape: 'rect', w: '$width', d: '$length' }, height: 1, role: 'path', alignToSlope: false, tags: ['steps'],
    params: [num('width', 'Width (m)', 'عرض (متر)', 0.6, 4, 0.1, 1.2), num('length', 'Run (m)', 'طول (متر)', 0.6, 8, 0.1, 2.4)] },
  { id: 'retaining-wall', category: 'landscape', name: { en: 'Retaining wall / terrace', fa: 'دیوار حائل / تراس' }, icon: '🧱', kind: 'polyline', model: 'retaining-wall', fp: { shape: 'rect', w: 1, d: 1 }, height: 0.8, role: 'wall', tags: ['wall', 'terrace'], polyline: { width: 0.4, minWidth: 0.2, maxWidth: 1, drape: true, material: 'stone-wall' }, meta: { wallHeight: 0.8 } },
  { id: 'swale', category: 'landscape', name: { en: 'Swale (contour ditch)', fa: 'سوئیل (کانال تراز)' }, icon: '🌊', kind: 'polyline', model: 'swale', fp: { shape: 'rect', w: 1, d: 1 }, height: 0, role: 'swale', tags: ['swale', 'water'], polyline: { width: 1.2, minWidth: 0.6, maxWidth: 3, drape: true, material: 'swale' } },
  { id: 'fence-segment', category: 'landscape', name: { en: 'Fence segment', fa: 'حصار' }, icon: '🚧', kind: 'polyline', model: 'fence-line', fp: { shape: 'rect', w: 1, d: 1 }, height: 1.2, role: 'barrier', tags: ['fence'], polyline: { width: 0.1, minWidth: 0.05, maxWidth: 0.3, drape: true, material: 'fence' } },
  { id: 'level-pad', category: 'landscape', name: { en: 'Level pad (graded platform)', fa: 'سکوی تراز (خاکریزی)' }, icon: '⬜', kind: 'point', model: 'level-pad', fp: { shape: 'rect', w: '$width', d: '$depth' }, height: 0.1, pad: true, role: 'none', tags: ['pad', 'terrace', 'level'], params: [num('width', 'Width (m)', 'عرض (متر)', 1, 20, 0.5, 4), num('depth', 'Depth (m)', 'عمق (متر)', 1, 20, 0.5, 4)] },
  { id: 'gate', category: 'landscape', name: { en: 'Gate', fa: 'درب' }, icon: '🚪', kind: 'point', model: 'gate', fp: { shape: 'rect', w: '$width', d: 0.2 }, height: 1.3, role: 'none', tags: ['gate'], params: [num('width', 'Width (m)', 'عرض (متر)', 0.8, 5, 0.1, 1.2)] },
  { id: 'drip-line', category: 'landscape', name: { en: 'Drip-irrigation line', fa: 'لوله قطره‌ای' }, icon: '💦', kind: 'polyline', model: 'pipe', fp: { shape: 'rect', w: 1, d: 1 }, height: 0.02, role: 'pipe', tags: ['irrigation'], polyline: { width: 0.03, minWidth: 0.01, maxWidth: 0.1, drape: true, material: 'drip' } },
  { id: 'pipe', category: 'landscape', name: { en: 'Water pipe', fa: 'لوله آب' }, icon: '➖', kind: 'polyline', model: 'pipe', fp: { shape: 'rect', w: 1, d: 1 }, height: 0.02, role: 'pipe', tags: ['pipe'], polyline: { width: 0.05, minWidth: 0.02, maxWidth: 0.2, drape: true, material: 'pipe' } },
  // --- scale
  { id: 'human', category: 'scale', name: { en: 'Person (1.75 m)', fa: 'انسان (۱٫۷۵ متر)' }, icon: '🧍', kind: 'point', model: 'human', fp: { shape: 'circle', w: 0.5, d: 0.5 }, height: 1.75, role: 'none', tags: ['scale'] },
  { id: 'car', category: 'scale', name: { en: 'Car', fa: 'خودرو' }, icon: '🚗', kind: 'point', model: 'car', fp: { shape: 'rect', w: 4.5, d: 1.8 }, height: 1.5, role: 'none', clearance: 0.3, tags: ['scale', 'car'] },
  // --- custom
  { id: 'custom-glb', category: 'custom', name: { en: 'Imported model (GLB)', fa: 'مدل واردشده (GLB)' }, icon: '📦', kind: 'point', model: 'glb', fp: { shape: 'rect', w: '$width', d: '$depth' }, height: 2, role: 'none', tags: ['custom'], params: [num('width', 'Footprint W (m)', 'عرض (متر)', 0.1, 50, 0.1, 2), num('depth', 'Footprint D (m)', 'عمق (متر)', 0.1, 50, 0.1, 2), num('modelScale', 'Model scale', 'مقیاس', 0.01, 100, 0.01, 1)] },
]

export const CATALOG_BY_ID: Record<string, CatalogItem> = Object.fromEntries(CATALOG.map((c) => [c.id, c]))

export function defaultParams(item: CatalogItem): Record<string, number | string | boolean> {
  const out: Record<string, number | string | boolean> = {}
  for (const p of item.params ?? []) out[p.key] = p.def
  return out
}

export function resolveDim(v: number | string, params: Record<string, number | string | boolean>): number {
  if (typeof v === 'number') return v
  const x = params[v.slice(1)]
  return typeof x === 'number' ? x : parseFloat(String(x)) || 1
}
