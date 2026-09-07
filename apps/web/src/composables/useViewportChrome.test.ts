import { describe, expect, it } from 'vitest'
import { clampViewportChromeGap } from '@/composables/useViewportChrome'

describe('clampViewportChromeGap', () => {
  it('ignores tiny jitter', () => {
    expect(clampViewportChromeGap(4, 800)).toBe(0)
  })

  it('keeps soft-keyboard sized gaps instead of zeroing them', () => {
    expect(clampViewportChromeGap(280, 800)).toBe(280)
  })

  it('caps extreme gaps', () => {
    expect(clampViewportChromeGap(900, 800)).toBe(600)
  })
})
