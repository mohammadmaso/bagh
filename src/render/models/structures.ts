import type * as THREE from 'three'
import type { CatalogItem } from '../../data/catalog'
import type { PlacedObject } from '../../core/project'
import type { BuildCtx } from './index'
import * as G from './growing'
import * as A from './animals'
import * as B from './buildings'

export type Builder = (item: CatalogItem, obj: PlacedObject, ctx: BuildCtx) => THREE.Object3D

export const STRUCTURE_BUILDERS: Record<string, Builder> = {
  'raised-bed': G.raisedBed, 'inground-bed': G.ingroundBed, 'potato-rows': G.potatoRows, 'squash-patch': G.squashPatch,
  'herb-spiral': G.herbSpiral, greenhouse: G.greenhouse, polytunnel: G.polytunnel, 'cold-frame': G.coldFrame, 'ginseng-bed': G.ginsengBed,
  'shiitake-rack': G.shiitakeRack, 'mushroom-house': G.mushroomHouse, 'nursery-table': G.nurseryTable,
  'plant-row': G.plantRow, 'plant-bed': G.plantBed, 'pergola-vine': G.pergolaVine, 'trellis-vine': G.trellisVine,
  coop: A.coop, 'chicken-tractor': A.chickenTractor, 'rabbit-hutches': A.rabbitHutches, 'goose-house': A.gooseHouse, 'goat-shelter': A.goatShelter,
  'hive-langstroth': A.hiveLangstroth, 'hive-topbar': A.hiveTopbar, 'hive-stand': A.hiveStand, 'bee-water': A.beeWater,
  'house-gable': B.houseGable, shed: B.shed, firewood: B.firewood, pergola: B.pergola, gazebo: B.gazebo, compost: B.compost,
  'tank-ibc': B.tankIBC, 'tank-poly': B.tankPoly, well: B.well, pond: B.pond, solar: B.solar, tap: B.tap, sink: B.sink, bench: B.bench,
  'level-pad': B.levelPad, picnic: B.picnic, 'light-post': B.lightPost, parking: B.parking, steps: B.steps, gate: B.gate, human: B.human, car: B.car, glb: B.glbPlaceholder,
}
