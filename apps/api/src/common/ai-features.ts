import { ServiceUnavailableException } from '@nestjs/common'

/** `AI_FEATURES_ENABLED=true`일 때만 켜져요. 기본은 준비 중이라 꺼져 있어요. */
export const aiFeaturesEnabled = () => process.env.AI_FEATURES_ENABLED === 'true'

export const assertAiEnabled = () => {
  if (!aiFeaturesEnabled()) {
    throw new ServiceUnavailableException('AI 기능은 준비 중이에요.')
  }
}

export const disabledAiStatus = () =>
  ({
    available: false as const,
    requiresApiKey: true as const,
    providers: [] as const,
    defaultModels: {
      openai: '',
      gemini: '',
      other: '',
    },
  }) as const
