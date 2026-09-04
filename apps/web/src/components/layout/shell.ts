import type { InjectionKey } from 'vue'

export const CLOSE_APP_NAV_KEY: InjectionKey<() => void> = Symbol('closeAppNav')
