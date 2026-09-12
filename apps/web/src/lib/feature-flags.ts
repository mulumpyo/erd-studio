/**
 * 제품 기능 스위치예요 (Vite 빌드 시점에 결정돼요).
 * 릴리스에서 `VITE_AI_FEATURES_ENABLED=true`를 넣기 전엔 AI는 꺼져 있어요.
 */
export const AI_FEATURES_ENABLED =
  import.meta.env.VITE_AI_FEATURES_ENABLED === 'true'
