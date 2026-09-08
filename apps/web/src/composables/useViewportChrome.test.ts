import { describe, expect, it } from 'vitest'
import {
  clampViewportChromeGap,
  measureChromeGap,
} from '@/composables/useViewportChrome'

describe('measureChromeGap', () => {
  it('ignores tiny jitter', () => {
    expect(
      measureChromeGap({
        layoutHeight: 800,
        innerHeight: 800,
        visualHeight: 796,
        offsetTop: 0,
      }),
    ).toBe(0)
  })

  it('keeps soft-keyboard sized gaps instead of zeroing them', () => {
    expect(
      measureChromeGap({
        layoutHeight: 800,
        innerHeight: 800,
        visualHeight: 520,
        offsetTop: 0,
      }),
    ).toBe(280)
  })

  it('does not double-count when the visual viewport already scrolled', () => {
    expect(
      measureChromeGap({
        layoutHeight: 800,
        innerHeight: 800,
        visualHeight: 520,
        offsetTop: 280,
      }),
    ).toBe(0)
  })

  it('caps extreme gaps', () => {
    expect(
      measureChromeGap({
        layoutHeight: 800,
        innerHeight: 800,
        visualHeight: 50,
        offsetTop: 0,
      }),
    ).toBe(600)
  })
})

describe('clampViewportChromeGap', () => {
  it('ignores tiny jitter', () => {
    expect(clampViewportChromeGap(4, 800)).toBe(0)
  })

  it('keeps soft-keyboard sized gaps instead of zeroing them', () => {
    expect(clampViewportChromeGap(280, 800)).toBe(280)
  })
})
