const VAR = {
  top: '--erd-inset-top',
  right: '--erd-inset-right',
  bottom: '--erd-inset-bottom',
  left: '--erd-inset-left',
} as const

let sheetVisible = 0
let headerH = 64
let compact = false
let focus = false

const write = () => {
  const root = document.documentElement
  if (focus) {
    for (const name of Object.values(VAR)) root.style.setProperty(name, '16px')
    return
  }
  root.style.setProperty(VAR.top, `${headerH}px`)
  root.style.setProperty(VAR.left, compact ? '64px' : '304px')
  root.style.setProperty(VAR.right, compact ? '0px' : '340px')
  root.style.setProperty(VAR.bottom, compact ? `${sheetVisible}px` : '0px')
}

export const setSheetVisible = (px: number) => {
  sheetVisible = Math.max(0, Math.round(px))
  write()
}

export const syncCanvasInsets = (opts: {
  focus: boolean
  compact: boolean
  header: number
}) => {
  focus = opts.focus
  compact = opts.compact
  headerH = Math.max(0, Math.round(opts.header))
  write()
}

export const clearCanvasInsets = () => {
  const root = document.documentElement
  for (const name of Object.values(VAR)) root.style.removeProperty(name)
}

const readInset = (name: string) => {
  const n = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name))
  return Number.isFinite(n) ? n : 0
}

export const visibleFitPadding = (extra = 24) => ({
  top: `${readInset(VAR.top) + extra}px`,
  right: `${readInset(VAR.right) + extra}px`,
  bottom: `${readInset(VAR.bottom) + extra}px`,
  left: `${readInset(VAR.left) + extra}px`,
})
