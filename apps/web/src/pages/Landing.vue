<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import ThemeToggle from '@/components/ThemeToggle.vue'
import SiteFooter from '@/components/SiteFooter.vue'
import LandingErdScene from '@/components/landing/LandingErdScene.vue'
import { buttonVariants } from '@/components/ui/button'
import { CONTACT_INSTAGRAM_URL } from '@/lib/site'

/** sm 미만에서는 3D ERD 장면을 마운트하지 않음 */
const showErdScene = ref(false)
let mq: MediaQueryList | null = null
const syncErdScene = () => {
  showErdScene.value = Boolean(mq?.matches)
}

onMounted(() => {
  mq = window.matchMedia('(min-width: 640px)')
  syncErdScene()
  mq.addEventListener('change', syncErdScene)
})

onUnmounted(() => {
  mq?.removeEventListener('change', syncErdScene)
})
</script>

<template>
  <div class="flex min-h-full flex-col overflow-x-clip bg-background">
    <header
      class="relative z-30 mx-auto flex w-full max-w-5xl items-center justify-between gap-2 px-4 pb-5 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-6"
    >
      <div class="flex min-w-0 items-center gap-2 sm:gap-2.5">
        <RouterLink
          to="/"
          class="flex min-h-12 min-w-0 items-center gap-2 rounded-2xl pr-1 sm:gap-2.5"
        >
          <div
            class="flex size-9 shrink-0 items-center justify-center rounded-2xl bg-[#1b64da] text-[15px] font-bold text-white"
            aria-hidden="true"
          >
            E
          </div>
          <span class="truncate text-[17px] font-bold tracking-[-0.03em]"
            >ERD Studio</span
          >
        </RouterLink>
        <ThemeToggle />
      </div>
      <nav class="flex shrink-0 items-center gap-2" aria-label="계정">
        <a
          :href="CONTACT_INSTAGRAM_URL"
          target="_blank"
          rel="noopener noreferrer"
          :class="buttonVariants({ variant: 'ghost' })"
          >문의하기</a
        >
        <div class="hidden sm:flex sm:items-center sm:gap-2">
          <RouterLink :class="buttonVariants({ variant: 'ghost' })" to="/login"
            >로그인</RouterLink
          >
          <RouterLink
            :class="[buttonVariants(), '!bg-[#1b64da] hover:!bg-[#174fb3]']"
            to="/register"
            >무료로 시작</RouterLink
          >
        </div>
      </nav>
    </header>

    <main class="relative z-10 mx-auto w-full max-w-5xl flex-1 overflow-visible px-6 pb-16">
      <!-- 히어로 섹션 밖에 두어 overflow/isolate에 잘리지 않게 -->
      <div
        v-if="showErdScene"
        class="landing-hero-scene pointer-events-none absolute z-[1]"
        aria-hidden="true"
      >
        <LandingErdScene />
      </div>

      <section
        class="landing-hero relative z-10 min-h-[min(34rem,72svh)] overflow-visible pt-6 sm:min-h-[min(38rem,72svh)] sm:pt-10"
      >
        <div class="landing-hero-copy relative z-10 max-w-xl">
          <span
            class="inline-flex rounded-full bg-accent px-2.5 py-1 text-[13px] font-semibold text-accent-foreground"
            >베타</span
          >
          <p
            class="mt-3 text-[15px] font-semibold text-[#1b64da] dark:text-[#8ab4f8]"
          >
            팀과 함께 그리는 ERD
          </p>
          <h1
            class="mt-3 text-[44px] font-bold leading-[1.2] tracking-[-0.05em] sm:text-[56px]"
          >
            데이터베이스 설계,<br />더 쉽고 빠르게
          </h1>
          <p
            class="mt-5 max-w-lg text-[17px] leading-7 text-[#4e5968] dark:text-[#c2c8d0]"
          >
            브라우저에서 테이블을 그리고, SQL로 주고받고, 팀원과 바로 같이
            수정해요. 지금은 베타라 기능과 데이터가 바뀔 수 있어요.
          </p>
          <div class="mt-10 flex flex-wrap gap-3">
            <RouterLink
              :class="[
                buttonVariants({ size: 'lg' }),
                '!bg-[#1b64da] hover:!bg-[#174fb3]',
              ]"
              to="/register"
              >무료로 시작</RouterLink
            >
            <RouterLink
              :class="buttonVariants({ variant: 'secondary', size: 'lg' })"
              to="/login"
              >로그인</RouterLink
            >
          </div>
        </div>
      </section>

      <div class="relative z-20 mt-12 grid gap-3 md:mt-16 md:grid-cols-3">
        <section class="rounded-[24px] bg-card px-6 py-7">
          <div
            class="mb-4 flex size-10 items-center justify-center rounded-2xl bg-accent text-[15px] font-bold text-accent-foreground"
            aria-hidden="true"
          >
            1
          </div>
          <h2 class="text-[18px] font-bold">캔버스 에디터</h2>
          <p class="mt-2 text-[15px] leading-6 text-[#4e5968] dark:text-[#c2c8d0]">
            논리/물리명, PK·FK, 식별·비식별 관계까지 한 화면에서 그려요.
          </p>
        </section>
        <section class="rounded-[24px] bg-card px-6 py-7">
          <div
            class="mb-4 flex size-10 items-center justify-center rounded-2xl bg-accent text-[15px] font-bold text-accent-foreground"
            aria-hidden="true"
          >
            2
          </div>
          <h2 class="text-[18px] font-bold">실시간 협업</h2>
          <p class="mt-2 text-[15px] leading-6 text-[#4e5968] dark:text-[#c2c8d0]">
            테이블을 옮기면 팀원 화면에 바로 반영되고, 채팅도 같이 따라가요.
          </p>
        </section>
        <section class="rounded-[24px] bg-card px-6 py-7">
          <div
            class="mb-4 flex size-10 items-center justify-center rounded-2xl bg-accent text-[15px] font-bold text-accent-foreground"
            aria-hidden="true"
          >
            3
          </div>
          <h2 class="text-[18px] font-bold">권한 관리</h2>
          <p class="mt-2 text-[15px] leading-6 text-[#4e5968] dark:text-[#c2c8d0]">
            팀뿐 아니라 다이어그램마다 편집 권한을 따로 줄 수 있어요.
          </p>
        </section>
      </div>
    </main>
    <SiteFooter class="relative z-20" />
  </div>
</template>

<style scoped>
.landing-hero-copy {
  position: relative;
  isolation: isolate;
  padding: 0.25rem 0 1.25rem;
}

/*
  에이전시 톤: 형체가 드러나지 않는 대기 헤이즈.
  넓은 방사형 + 약한 가우시안, 노이즈/사각 경계 없음.
*/
.landing-hero-copy::before,
.landing-hero-copy::after {
  content: '';
  position: absolute;
  z-index: -1;
  pointer-events: none;
  border-radius: 50%;
}

.landing-hero-copy::before {
  inset: -4rem -5rem -3.5rem -2.5rem;
  background: radial-gradient(
    ellipse 75% 70% at 30% 40%,
    color-mix(in srgb, var(--background) 88%, transparent) 0%,
    color-mix(in srgb, var(--background) 55%, transparent) 28%,
    color-mix(in srgb, var(--background) 22%, transparent) 52%,
    transparent 74%
  );
  backdrop-filter: blur(28px) saturate(1.02);
  -webkit-backdrop-filter: blur(28px) saturate(1.02);
  mask-image: radial-gradient(
    ellipse 72% 68% at 32% 42%,
    #000 0%,
    #000 22%,
    rgb(0 0 0 / 0.7) 45%,
    rgb(0 0 0 / 0.25) 62%,
    transparent 78%
  );
  -webkit-mask-image: radial-gradient(
    ellipse 72% 68% at 32% 42%,
    #000 0%,
    #000 22%,
    rgb(0 0 0 / 0.7) 45%,
    rgb(0 0 0 / 0.25) 62%,
    transparent 78%
  );
}

/* 바깥으로 한 번 더 퍼지는 소프트 글로우 */
.landing-hero-copy::after {
  inset: -6rem -7rem -5rem -3.5rem;
  background: radial-gradient(
    ellipse 80% 75% at 28% 38%,
    color-mix(in srgb, var(--background) 40%, transparent) 0%,
    color-mix(in srgb, var(--background) 12%, transparent) 45%,
    transparent 70%
  );
  backdrop-filter: blur(40px);
  -webkit-backdrop-filter: blur(40px);
  opacity: 0.85;
  mask-image: radial-gradient(
    ellipse 78% 74% at 30% 40%,
    #000 0%,
    rgb(0 0 0 / 0.45) 40%,
    transparent 72%
  );
  -webkit-mask-image: radial-gradient(
    ellipse 78% 74% at 30% 40%,
    #000 0%,
    rgb(0 0 0 / 0.45) 40%,
    transparent 72%
  );
}

/* main 기준 absolute — 히어로 overflow/마스크에 안 묶임 */
.landing-hero-scene {
  top: -1rem;
  right: -1rem;
  bottom: auto;
  left: 6%;
  height: min(34rem, 68svh);
  z-index: 1;
  overflow: visible;
  opacity: 0.94;
  /* 카피 쪽만 약하게 페이드 — 오른쪽/아래는 자르지 않음 */
  mask-image: linear-gradient(
    105deg,
    transparent 0%,
    rgb(0 0 0 / 0.18) 8%,
    #000 28%
  );
  -webkit-mask-image: linear-gradient(
    105deg,
    transparent 0%,
    rgb(0 0 0 / 0.18) 8%,
    #000 28%
  );
}

@media (max-width: 639px) {
  .landing-hero-scene {
    display: none;
  }

  .landing-hero-copy {
    max-width: 100%;
    padding-bottom: 0.5rem;
  }

  .landing-hero-copy::before,
  .landing-hero-copy::after {
    display: none;
  }
}

@media (min-width: 640px) {
  .landing-hero-scene {
    left: 8%;
    right: -2rem;
    height: min(36rem, 70svh);
  }
}

@media (min-width: 1024px) {
  .landing-hero-scene {
    left: 10%;
    right: -3rem;
    height: min(38rem, 72svh);
    opacity: 0.96;
  }
}
</style>
