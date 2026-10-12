import { createRoot } from 'react-dom/client'
import { App } from './ui/App'
import { Gallery } from './ui/Gallery'
import './ui/styles.css'

const gallery = new URLSearchParams(location.search).has('gallery')
createRoot(document.getElementById('root')!).render(gallery ? <Gallery /> : <App />)
