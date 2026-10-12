import { useEffect, useRef } from 'react'
import { engine } from '../render/engine'

export function Viewport() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current!
    engine.init(c)
    ;(window as any).__engine = engine
    return () => engine.dispose()
  }, [])
  return <canvas ref={ref} tabIndex={0} aria-label="3D garden view" />
}
