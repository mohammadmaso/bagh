import { useEffect, useRef } from 'react'
import { engine } from '../render/engine'
import { ObjectsLayer } from '../render/objectsLayer'
import { OverlayLayer } from '../render/overlayLayer'
import { SectionLayer } from '../render/sectionLayer'
import { GrassLayer } from '../render/grassLayer'
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
    engine.addLayer(new GrassLayer())
    engine.addLayer(overlay)
    engine.addLayer(new SectionLayer())
    interaction = new Interaction(engine, objects, overlay, stage.current!)
    ;(window as any).__engine = engine
    ;(window as any).__objects = objects
    ;(window as any).__overlay = overlay
    ;(window as any).__garden = { addObject, store: useStore, actions }
    // react to UI state that drives the engine
    let lastView = useStore.getState().ui.view
    let lastTool = useStore.getState().ui.tool
    const unsub = useStore.subscribe((s) => {
      if (s.ui.view !== lastView) { lastView = s.ui.view; engine.setView(s.ui.view) }
      if (s.ui.tool !== lastTool) {
        if (lastTool === 'path' || lastTool === 'measure' || lastTool === 'place') interaction?.cancelTool()
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
