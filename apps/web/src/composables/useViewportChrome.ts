import { onMounted, onUnmounted } from 'vue'

const VAR = '--vv-chrome-gap'
const JITTER = 8

/** Map visualViewport shrinkage to a bottom gap (browser chrome + soft keyboard). */
export const clampViewportChromeGap = (delta: number, layoutHeight: number) => {
  if (delta < JITTER) return 0
  const max = Math.max(120, Math.round(layoutHeight * 0.75))
  return Math.min(Math.round(delta), max)
}

export const useViewportChrome = () => {
  onMounted(() => {
    const probe = document.createElement('div')
    probe.setAttribute('aria-hidden', 'true')
    probe.style.cssText =
      'position:fixed;top:0;left:0;width:0;height:100svh;pointer-events:none;visibility:hidden'
    document.body.appendChild(probe)

    let frame = 0
    const publish = () => {
      const visible = window.visualViewport?.height ?? window.innerHeight
      const svh = probe.getBoundingClientRect().height || window.innerHeight
      document.documentElement.style.setProperty(
        VAR,
        `${clampViewportChromeGap(svh - visible, svh)}px`,
      )
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
      document.documentElement.style.removeProperty(VAR)
    })
  })
}
