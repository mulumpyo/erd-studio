import type { ComputedRef, InjectionKey, Ref } from 'vue'
import { inject } from 'vue'

export type ErdFlowView = {
  on: Ref<boolean>
  focusTableId: ComputedRef<string | null>
}

export const ErdFlowKey: InjectionKey<ErdFlowView> = Symbol('erd-flow')

export const useErdFlow = () => inject(ErdFlowKey, null)
