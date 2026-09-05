import { onMounted, onUnmounted } from 'vue'

const VAR = '--vv-chrome-gap'
const JITTER = 8
const CHROME_MAX = 96

const clampChrome = (delta: number) => {
  if (delta < JITTER || delta > CHROME_MAX) return 0
  return Math.round(delta)
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
        `${clampChrome(svh - visible)}px`,
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
