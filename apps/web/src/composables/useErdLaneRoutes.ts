import type { ComputedRef, InjectionKey } from 'vue'
import { inject } from 'vue'
import type { LaneRoute } from '@/lib/erd-edge-route'

export type ErdLaneRoutes = ComputedRef<Map<string, LaneRoute>>

export const ErdLaneRoutesKey: InjectionKey<ErdLaneRoutes> =
  Symbol('erd-lane-routes')

export const useErdLaneRoutes = () => inject(ErdLaneRoutesKey, null)
