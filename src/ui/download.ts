/** Trigger a browser download of text or binary data (all local, no network). */
export function downloadBlob(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
export const downloadText = (name: string, text: string, mime = 'text/plain') => downloadBlob(name, new Blob([text], { type: mime }))
