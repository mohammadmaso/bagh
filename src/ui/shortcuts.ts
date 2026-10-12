import { useEffect } from 'react'
import { useStore } from '../store/store'
import { copySelection, pasteClipboard, duplicateSelection, deleteSelection, selectAll, nudgeSelection, groupSelection, ungroupSelection, toggleLock, toggleHide } from '../store/actions'
import { engine } from '../render/engine'
import { focusSelection } from './ContextMenu'

export const SHORTCUTS: [string, string][] = [
  ['V', 'Select'], ['W / E / R', 'Move / Rotate / Scale'], ['M', 'Measure'], ['P', 'Draw path (last used line type)'], ['Esc', 'Cancel / deselect tool'],
  ['Ctrl+Z / Ctrl+Shift+Z', 'Undo / Redo'], ['Ctrl+C / Ctrl+V / Ctrl+D', 'Copy / Paste / Duplicate'], ['Del', 'Delete'], ['Ctrl+A', 'Select all'],
  ['Ctrl+G / Ctrl+Shift+G', 'Group / Ungroup'], ['L / H', 'Lock / Hide selection'], ['F', 'Focus selection'], ['Arrows', 'Nudge (Shift = 1 m)'],
  ['1 2 3 4', 'Perspective / Plan / Section / Walk'], ['G', 'Cycle grid snap'], ['Shift+drag', 'Box select'], ['Shift+click', 'Add to selection'], ['Double-click path', 'Add vertex'],
  ['R (placing)', 'Rotate ghost 90°'], ['Enter', 'Finish path'], ['Backspace', 'Remove last point'],
  ['WASD / arrows (walk)', 'Walk; Shift runs; drag to look'],
]

export function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target as HTMLElement)?.isContentEditable) return
      const st = useStore.getState()
      const mod = e.ctrlKey || e.metaKey
      const k = e.key.toLowerCase()
      if (st.ui.view === 'walk' && ['w', 'a', 's', 'd', 'q', 'e', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift'].includes(k) && !mod) return
      if (mod && k === 'z') { e.preventDefault(); e.shiftKey ? st.redo() : st.undo(); return }
      if (mod && k === 'y') { e.preventDefault(); st.redo(); return }
      if (mod && k === 'c') { e.preventDefault(); copySelection(); return }
      if (mod && k === 'v') { e.preventDefault(); pasteClipboard(engine.lastPick() ?? undefined); return }
      if (mod && k === 'd') { e.preventDefault(); duplicateSelection(); return }
      if (mod && k === 'a') { e.preventDefault(); selectAll(); return }
      if (mod && k === 'g') { e.preventDefault(); e.shiftKey ? ungroupSelection() : groupSelection(); return }
      if (mod) return
      if (k === 'delete' || (k === 'backspace' && st.ui.tool === 'select')) { deleteSelection(); return }
      if (st.ui.tool === 'place' && k === 'r') return
      switch (k) {
        case 'v': st.setUI({ tool: 'select', placingType: null }); break
        case 'w': st.setUI({ gizmo: 'translate' }); break
        case 'e': st.setUI({ gizmo: 'rotate' }); break
        case 'r': st.setUI({ gizmo: 'scale' }); break
        case 'm': st.setUI({ tool: 'measure', placingType: null }); break
        case 'p': st.setUI({ tool: 'path', placingType: st.ui.placingType ?? 'path-gravel' }); break
        case 'l': toggleLock(); break
        case 'h': toggleHide(); break
        case 'f': focusSelection(); break
        case 'g': { const steps = [0, 0.25, 0.5, 1]; st.setUI({ gridSnap: steps[(steps.indexOf(st.ui.gridSnap) + 1) % steps.length] }); break }
        case '1': st.setUI({ view: 'persp' }); break
        case '2': st.setUI({ view: 'plan' }); break
        case '3': st.setUI({ view: 'section' }); break
        case '4': st.setUI({ view: 'walk' }); break
        case 'arrowleft': case 'arrowright': case 'arrowup': case 'arrowdown': {
          if (!st.ui.selection.length) return
          e.preventDefault()
          const step = e.shiftKey ? 1 : st.ui.gridSnap || 0.1
          nudgeSelection(k === 'arrowleft' ? -step : k === 'arrowright' ? step : 0, k === 'arrowup' ? -step : k === 'arrowdown' ? step : 0)
          break
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
