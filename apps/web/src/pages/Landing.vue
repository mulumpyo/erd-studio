<script setup lang="ts">
import { RouterLink } from 'vue-router'
import ThemeToggle from '@/components/ThemeToggle.vue'
import SiteFooter from '@/components/SiteFooter.vue'
import { buttonVariants } from '@/components/ui/button'
import { CONTACT_INSTAGRAM_URL } from '@/lib/site'
</script>

<template>
  <div class="flex min-h-full flex-col bg-background">
    <header
      class="mx-auto flex w-full max-w-5xl items-center justify-between gap-2 px-4 pb-5 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-6"
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
    <main class="mx-auto w-full max-w-5xl flex-1 px-6 pb-16 pt-10">
      <span
        class="inline-flex rounded-full bg-accent px-2.5 py-1 text-[13px] font-semibold text-accent-foreground"
        >베타</span
      >
      <p class="mt-3 text-[15px] font-semibold text-[#1b64da] dark:text-[#8ab4f8]">
        팀과 함께 그리는 ERD
      </p>
      <h1
        class="mt-3 max-w-2xl text-[44px] font-bold leading-[1.2] tracking-[-0.05em] sm:text-[56px]"
      >
        데이터베이스 설계,<br />더 쉽고 빠르게
      </h1>
      <p class="mt-5 max-w-lg text-[17px] leading-7 text-[#4e5968] dark:text-[#c2c8d0]">
        브라우저에서 테이블을 그리고, SQL로 주고받고, 팀원과 바로 같이 수정해요.
        지금은 베타라 기능과 데이터가 바뀔 수 있어요.
      </p>
      <div class="mt-10 flex flex-wrap gap-3">
        <RouterLink
          :class="[buttonVariants({ size: 'lg' }), '!bg-[#1b64da] hover:!bg-[#174fb3]']"
          to="/register"
          >무료로 시작</RouterLink
        >
        <RouterLink
          :class="buttonVariants({ variant: 'secondary', size: 'lg' })"
          to="/login"
          >로그인</RouterLink
        >
      </div>
      <div class="mt-20 grid gap-3 md:grid-cols-3">
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
    <SiteFooter />
  </div>
</template>
