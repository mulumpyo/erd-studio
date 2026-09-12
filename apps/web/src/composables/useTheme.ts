import { computed, ref } from 'vue'

export type ThemeMode = 'light' | 'dark'

const KEY = 'erd_theme'

const systemDark = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-color-scheme: dark)').matches

const readMode = (): ThemeMode => {
  try {
    const stored = localStorage.getItem(KEY)
    if (stored === 'light' || stored === 'dark') return stored
    return systemDark() ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

const mode = ref<ThemeMode>('light')

export const applyTheme = (next: ThemeMode) => {
  const dark = next === 'dark'
  document.documentElement.classList.toggle('dark', dark)
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
}

export const initTheme = () => {
  mode.value = readMode()
  applyTheme(mode.value)
  try {
    localStorage.setItem(KEY, mode.value)
  } catch {
    /* ignore */
  }
}

export const useTheme = () => {
  const resolved = computed(() => mode.value)

  const setMode = (next: ThemeMode) => {
    mode.value = next
    try {
      localStorage.setItem(KEY, next)
    } catch {
      /* ignore */
    }
    applyTheme(next)
  }

  const cycle = () => {
    // 아이콘·상태가 실제 화면과 어긋나지 않게, 지금 DOM의 클래스 기준으로 봐요.
    const dark = document.documentElement.classList.contains('dark')
    setMode(dark ? 'light' : 'dark')
  }

  return { mode, resolved, setMode, cycle }
}
