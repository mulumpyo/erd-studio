import { onUnmounted, readonly, ref } from 'vue'

/** Tailwind의 lg / sm 기준 폭입니다. 넓은 화면부터 확인합니다. */
const STEPS = [
  { query: '(min-width: 1024px)', size: 3 },
  { query: '(min-width: 640px)', size: 2 },
] as const

const NARROW = 1

/**
 * 화면 폭에 따라 목록의 페이지 크기를 정합니다.
 * 넓은 화면은 3개, 중간은 2개, 좁은 화면은 1개를 한 페이지에 담습니다.
 */
export const usePageSize = () => {
  const size = ref(STEPS[0].size)
  if (typeof window === 'undefined') return readonly(size)

  const lists = STEPS.map((step) => ({
    list: window.matchMedia(step.query),
    size: step.size,
  }))

  const sync = () => {
    size.value = lists.find((item) => item.list.matches)?.size ?? NARROW
  }

  sync()
  for (const { list } of lists) list.addEventListener('change', sync)
  onUnmounted(() => {
    for (const { list } of lists) list.removeEventListener('change', sync)
  })

  return readonly(size)
}
