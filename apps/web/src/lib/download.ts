export const downloadBlob = (blob: Blob, filename: string) => {
  const href = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  a.click()
  URL.revokeObjectURL(href)
}

export const downloadText = (text: string, filename: string, type: string) => {
  downloadBlob(new Blob([text], { type }), filename)
}

export const downloadDataUrl = (dataUrl: string, filename: string) => {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename
  a.click()
}

export const safeFilename = (name: string, fallback = 'erd') =>
  (name.trim() || fallback).replace(/[<>:"/\\|?*]+/g, '_')
