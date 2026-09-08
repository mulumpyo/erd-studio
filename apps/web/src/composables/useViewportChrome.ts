import { onMounted, onUnmounted } from 'vue'

const GAP_VAR = '--vv-chrome-gap'
const HEIGHT_VAR = '--vv-height'
const OFFSET_VAR = '--vv-offset-top'
const JITTER = 8

export type ViewportChromeMetrics = {
  layoutHeight: number
  innerHeight: number
  visualHeight: number
  offsetTop: number
}

/** Bottom inset for fixed UI (toasts / sheets) — never double-count VV scroll. */
export const measureChromeGap = ({
  layoutHeight,
  innerHeight,
  visualHeight,
  offsetTop,
}: ViewportChromeMetrics) => {
  const bottom = Math.max(0, innerHeight - visualHeight - offsetTop)
  if (bottom < JITTER) return 0
  const max = Math.max(120, Math.round(layoutHeight * 0.75))
  return Math.min(Math.round(bottom), max)
}

/** @deprecated use measureChromeGap — kept for existing tests naming */
export const clampViewportChromeGap = (delta: number, layoutHeight: number) =>
  measureChromeGap({
    layoutHeight,
    innerHeight: layoutHeight,
    visualHeight: Math.max(0, layoutHeight - delta),
    offsetTop: 0,
  })

export const useViewportChrome = () => {
  onMounted(() => {
    const probe = document.createElement('div')
    probe.setAttribute('aria-hidden', 'true')
    probe.style.cssText =
      'position:fixed;top:0;left:0;width:0;height:100svh;pointer-events:none;visibility:hidden'
    document.body.appendChild(probe)

    let frame = 0
    const publish = () => {
      const vv = window.visualViewport
      const layoutHeight =
        probe.getBoundingClientRect().height || window.innerHeight
      const visualHeight = vv?.height ?? window.innerHeight
      const offsetTop = vv?.offsetTop ?? 0
      const gap = measureChromeGap({
        layoutHeight,
        innerHeight: window.innerHeight,
        visualHeight,
        offsetTop,
      })
      const root = document.documentElement.style
      root.setProperty(GAP_VAR, `${gap}px`)
      // Pin fullscreen shells to the visual viewport (avoids keyboard + gap stacking).
      root.setProperty(HEIGHT_VAR, `${Math.round(visualHeight)}px`)
      root.setProperty(OFFSET_VAR, `${Math.round(offsetTop)}px`)
    }

    const schedule = () => {
      if (frame) return
      frame = window.requestAnimationFrame(() => {
        frame = 0
        publish()
      })
    }

    publish()
    window.addEventListener('resize', schedule)
    window.visualViewport?.addEventListener('resize', schedule)
    window.visualViewport?.addEventListener('scroll', schedule)

    onUnmounted(() => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', schedule)
      window.visualViewport?.removeEventListener('resize', schedule)
      window.visualViewport?.removeEventListener('scroll', schedule)
      probe.remove()
      const root = document.documentElement.style
      root.removeProperty(GAP_VAR)
      root.removeProperty(HEIGHT_VAR)
      root.removeProperty(OFFSET_VAR)
    })
  })
}
