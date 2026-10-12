import { useEffect, useRef } from 'react'
import { engine } from '../render/engine'
import { ObjectsLayer } from '../render/objectsLayer'
import { addObject, useStore, activeScenario } from '../store/store'

export function Viewport() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current!
    const objects = new ObjectsLayer()
    engine.extraPads = (base) => objects.padsFor(Object.values(activeScenario(useStore.getState().project).objects), base)
    engine.extraCuts = () => objects.cutsFor(Object.values(activeScenario(useStore.getState().project).objects))
    engine.init(c)
    engine.addLayer(objects)
    ;(window as any).__objects = objects
    ;(window as any).__garden = { addObject, store: useStore }
    ;(window as any).__engine = engine
    return () => engine.dispose()
  }, [])
  return <canvas ref={ref} tabIndex={0} aria-label="3D garden view" />
}
