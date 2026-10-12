import { createRoot } from 'react-dom/client'
import { App } from './ui/App'
import { Gallery } from './ui/Gallery'
import { loadPrefs, loadAutosave, startAutosave } from './store/persist'
import './ui/styles.css'

const gallery = new URLSearchParams(location.search).has('gallery')
const fresh = new URLSearchParams(location.search).has('fresh')

async function boot() {
  if (!gallery) {
    loadPrefs()
    if (!fresh) await loadAutosave()
    startAutosave()
  }
  createRoot(document.getElementById('root')!).render(gallery ? <Gallery /> : <App />)
}
void boot()
