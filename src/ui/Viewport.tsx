import { useEffect, useRef } from 'react'
import { engine, Engine } from '../render/engine'
import { ObjectsLayer } from '../render/objectsLayer'
import { OverlayLayer } from '../render/overlayLayer'
import { SectionLayer } from '../render/sectionLayer'
import { GrassLayer } from '../render/grassLayer'
import { startAnalysisController, useAnalysis } from '../store/analysis'
import { ImageryLayer } from '../render/imageryLayer'
import { startOverlayController } from '../render/analysisOverlay'
import { Interaction } from '../render/interaction'
import { addObject, useStore, activeScenario } from '../store/store'
import * as actions from '../store/actions'
import { CompassAndScale, Labels, Hud } from './Overlays'
import { ContextMenu } from './ContextMenu'
import { ArrayDialog } from './ArrayDialog'

export let interaction: Interaction | null = null

export function Viewport() {
  const ref = useRef<HTMLCanvasElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const c = ref.current!
    const objects = new ObjectsLayer()
    const overlay = new OverlayLayer()
    engine.extraPads = (base) => objects.padsFor(Object.values(activeScenario(useStore.getState().project).objects), base)
    engine.extraCuts = () => objects.cutsFor(Object.values(activeScenario(useStore.getState().project).objects))
    engine.init(c)
    engine.addLayer(objects)
    const imagery = new ImageryLayer()
    imagery.onSkyChange = (t) => engine.setSkyPhoto(t)
    engine.addLayer(new GrassLayer())
    engine.addLayer(imagery)
    engine.addLayer(overlay)
    engine.addLayer(new SectionLayer())
    interaction = new Interaction(engine, objects, overlay, stage.current!)
    interaction.imageryGroup = imagery.group
    useAnalysis.subscribe(() => overlay.invalidate(engine.ctx))
    startAnalysisController()
    startOverlayController()
    ;(window as any).__engine = engine
    ;(window as any).__objects = objects
    ;(window as any).__overlay = overlay
    ;(window as any).__garden = { addObject, store: useStore, actions, analysis: useAnalysis }
    // react to UI state that drives the engine
    let lastView = useStore.getState().ui.view
    let lastTool = useStore.getState().ui.tool
    const unsub = useStore.subscribe((s) => {
      if (s.ui.view !== lastView) { lastView = s.ui.view; engine.setView(s.ui.view) }
      if (s.ui.tool !== lastTool) {
        if (lastTool === 'path' || lastTool === 'measure' || lastTool === 'place' || lastTool === 'sculpt') interaction?.cancelTool()
        lastTool = s.ui.tool
      }
    })
    return () => { unsub(); interaction?.dispose(); engine.dispose() }
  }, [])
  const tool = useStore((s) => s.ui.tool)
  return (
    <div className="stage" ref={stage} data-tool={tool}>
      <canvas ref={ref} tabIndex={0} aria-label="3D garden view" />
      <div className="overlay-ui">
        <Labels />
        <CompassAndScale />
        <Hud />
        <ContextMenu />
        <ArrayDialog />
      </div>
    </div>
  )
}

/** Read-only second engine showing another plan from the same camera (side-by-side compare). */
export function ComparePane({ scenarioId }: { scenarioId: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current!
    const e = new Engine()
    e.readOnly = true
    e.scenarioOverride = scenarioId
    const objects = new ObjectsLayer()
    const scn = () => useStore.getState().project.scenarios[scenarioId] ?? activeScenario(useStore.getState().project)
    e.extraPads = (base) => objects.padsFor(Object.values(scn().objects), base)
    e.extraCuts = () => objects.cutsFor(Object.values(scn().objects))
    e.init(c)
    e.addLayer(objects)
    e.addLayer(new GrassLayer())
    const follow = () => {
      e.camera.position.copy(engine.camera.position)
      e.camera.quaternion.copy(engine.camera.quaternion)
      e.camera.fov = engine.camera.fov
      e.camera.updateProjectionMatrix()
    }
    engine.onFrame.push(follow)
    return () => { engine.onFrame = engine.onFrame.filter((f) => f !== follow); e.dispose() }
  }, [scenarioId])
  return <canvas ref={ref} aria-label="comparison view" />
}
