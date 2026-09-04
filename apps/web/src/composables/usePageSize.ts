import {
  nextTick,
  onMounted,
  onUnmounted,
  readonly,
  ref,
  watch,
  type Ref,
} from 'vue'

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

/**
 * 목록이 들어갈 영역의 높이를 재서, 한 페이지에 스크롤 없이 담길 개수를 정합니다.
 * 실제 행 높이를 우선하고, 짧은 화면에서는 1개부터 맞춰요.
 */
export const useFitPageSize = (
  viewport: Ref<HTMLElement | null>,
  row: () => number,
  sources: Ref<unknown>[] = [],
  options?: { min?: number; max?: number },
) => {
  const min = options?.min ?? 1
  const max = options?.max ?? 50
  const size = ref(min)

  const rowHeight = (el: HTMLElement) => {
    const sample = el.querySelector<HTMLElement>('[data-fit-row]')
    const actual = sample?.getBoundingClientRect().height ?? 0
    return Math.max(1, actual > 20 ? Math.ceil(actual) : row())
  }

  const measure = () => {
    const el = viewport.value
    if (!el || el.clientHeight < 32) return
    const next = clamp(
      Math.max(min, Math.floor(el.clientHeight / rowHeight(el))),
      min,
      max,
    )
    if (next !== size.value) size.value = next
  }

  let resize: ResizeObserver | undefined
  let mutations: MutationObserver | undefined

  const observe = (el: HTMLElement) => {
    resize?.observe(el)
    mutations?.observe(el, { childList: true, subtree: true })
    void nextTick(measure)
  }

  onMounted(() => {
    size.value = clamp(
      Math.floor((window.innerHeight - 280) / Math.max(1, row())) || min,
      min,
      max,
    )
    resize = new ResizeObserver(measure)
    mutations = new MutationObserver(() => {
      void nextTick(measure)
    })
    watch(
      viewport,
      (el, _prev, onCleanup) => {
        if (!el) return
        observe(el)
        onCleanup(() => {
          resize?.unobserve(el)
          mutations?.disconnect()
        })
      },
      { immediate: true },
    )
    if (sources.length) {
      watch(sources, () => {
        void nextTick(measure)
      })
    }
  })

  onUnmounted(() => {
    resize?.disconnect()
    mutations?.disconnect()
  })

  return readonly(size)
}
