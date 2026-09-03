import { computed, ref } from 'vue'

export type ThemeMode = 'light' | 'dark' | 'system'

const KEY = 'erd_theme'

const isThemeMode = (value: string | null): value is ThemeMode =>
  value === 'light' || value === 'dark' || value === 'system'

const systemDark = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-color-scheme: dark)').matches

const readMode = (): ThemeMode => {
  try {
    const stored = localStorage.getItem(KEY)
    return isThemeMode(stored) ? stored : 'system'
  } catch {
    return 'system'
  }
}

const mode = ref<ThemeMode>('system')
const systemPrefDark = ref(false)

const resolve = (next: ThemeMode) =>
  next === 'dark' || (next === 'system' && systemPrefDark.value) ? 'dark' : 'light'

export const applyTheme = (next: ThemeMode) => {
  const dark = resolve(next) === 'dark'
  document.documentElement.classList.toggle('dark', dark)
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
}

export const initTheme = () => {
  systemPrefDark.value = systemDark()
  mode.value = readMode()
  applyTheme(mode.value)
  window
    .matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', (event) => {
      systemPrefDark.value = event.matches
      if (mode.value === 'system') applyTheme('system')
    })
}

export const useTheme = () => {
  const resolved = computed(() => resolve(mode.value))

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
    setMode(
      mode.value === 'light'
        ? 'dark'
        : mode.value === 'dark'
          ? 'system'
          : 'light',
    )
  }

  return { mode, resolved, setMode, cycle }
}
