<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import ThemeToggle from '@/components/ThemeToggle.vue'
import SiteFooter from '@/components/SiteFooter.vue'
import Button from '@/components/ui/button/Button.vue'
import {
  CONTACT_INSTAGRAM_HANDLE,
  CONTACT_INSTAGRAM_URL,
  SITE_NAME,
  SITE_OPERATOR,
} from '@/lib/site'

const route = useRoute()
const router = useRouter()
const isPrivacy = computed(() => route.name === 'privacy')
const title = computed(() =>
  isPrivacy.value ? '개인정보처리방침' : '이용약관',
)
const updated = '2026년 9월 5일'

const goBack = () => {
  if (window.history.state?.back != null) {
    router.back()
    return
  }
  router.push('/')
}
</script>

<template>
  <div class="flex min-h-full flex-col bg-background">
    <header
      class="mx-auto flex w-full max-w-3xl items-center justify-between px-6 pb-5 pt-[max(1.25rem,env(safe-area-inset-top))]"
    >
      <RouterLink
        to="/"
        class="flex min-h-12 items-center gap-2.5"
      >
        <div
          class="flex size-9 items-center justify-center rounded-2xl bg-primary text-[15px] font-bold text-white"
        >
          E
        </div>
        <span class="text-[17px] font-bold tracking-[-0.03em]">{{ SITE_NAME }}</span>
      </RouterLink>
      <ThemeToggle />
    </header>

    <article class="mx-auto w-full max-w-3xl flex-1 px-6 pb-16">
      <p class="text-[15px] font-semibold text-primary">베타 서비스</p>
      <h1 class="mt-1 text-[32px] font-bold tracking-[-0.04em]">{{ title }}</h1>
      <p class="mt-2 text-[14px] text-muted-foreground">시행일 {{ updated }}</p>

      <div class="mt-10 space-y-8 text-[15px] leading-7 text-foreground">
        <template v-if="isPrivacy">
          <section class="space-y-2">
            <h2 class="text-[18px] font-bold">1. 수집하는 정보</h2>
            <p>
              {{ SITE_NAME }}는 계정을 만들고 서비스를 쓰는 데 필요한 정보만 받아요.
              이름, 이메일, 비밀번호(암호화해서 저장), 팀·프로젝트·다이어그램,
              채팅, 초대, 그리고 로그인한 날의 사용 기록이에요.
            </p>
          </section>
          <section class="space-y-2">
            <h2 class="text-[18px] font-bold">2. 쓰는 이유</h2>
            <p>
              가입·로그인, 이메일 인증, 비밀번호 찾기, 팀 초대, 실시간 편집,
              서비스 개선과 운영 숫자(DAU 등)를 보는 데 써요. 광고에 팔거나
              다른 서비스에 넘기지 않아요.
            </p>
          </section>
          <section class="space-y-2">
            <h2 class="text-[18px] font-bold">3. 보관과 탈퇴</h2>
            <p>
              쓰는 동안 보관하고, 탈퇴하면 이름·이메일을 지운 뒤 계정을 더 이상
              쓸 수 없게 해요. 내가 만든 팀과 그 안의 프로젝트는 함께 사라지고,
              다른 팀에서 남긴 대화도 지워요. 운영 숫자에 쓰인 익명 집계는 남을 수
              있어요.
            </p>
          </section>
          <section class="space-y-2">
            <h2 class="text-[18px] font-bold">4. 제3자 처리</h2>
            <p>
              인증·초대·비밀번호 메일을 보내려고 이메일 발송 서비스(SMTP)를 쓸 수
              있어요. 그 외 개인정보를 다른 회사에 맡기지 않아요.
            </p>
          </section>
          <section class="space-y-2">
            <h2 class="text-[18px] font-bold">5. 권리</h2>
            <p>
              계정 화면에서 비밀번호를 바꾸거나 탈퇴할 수 있어요. 열람·정정 요청은
              아래 문의로 보내 주세요.
            </p>
          </section>
          <section class="space-y-2">
            <h2 class="text-[18px] font-bold">6. 문의</h2>
            <p>
              개인정보 보호 책임자는 운영자 {{ SITE_OPERATOR }}예요. 문의는
              <a
                :href="CONTACT_INSTAGRAM_URL"
                target="_blank"
                rel="noopener noreferrer"
                class="font-semibold text-primary"
                >인스타그램 {{ CONTACT_INSTAGRAM_HANDLE }}</a
              >
              DM으로 받아요.
            </p>
          </section>
        </template>
        <template v-else>
          <section class="space-y-2">
            <h2 class="text-[18px] font-bold">1. 서비스</h2>
            <p>
              {{ SITE_NAME }}는 브라우저에서 ERD를 그리고 팀과 함께 편집하는
              서비스예요. 지금은 베타라 기능이 바뀌거나, 데이터가 초기화될 수
              있어요. 중요한 작업은 SQL·이미지로 백업해 주세요.
            </p>
          </section>
          <section class="space-y-2">
            <h2 class="text-[18px] font-bold">2. 계정</h2>
            <p>
              이메일 인증을 마친 뒤에 쓸 수 있어요. 계정과 비밀번호는 본인이
              관리하고, 다른 사람에게 넘겨 주지 마세요. 마지막 플랫폼 관리자는
              탈퇴할 수 없어요.
            </p>
          </section>
          <section class="space-y-2">
            <h2 class="text-[18px] font-bold">3. 콘텐츠</h2>
            <p>
              다이어그램과 채팅의 권리는 작성자에게 있어요. 서비스 제공을 위해
              저장·전송할 수 있어요. 불법이거나 다른 사람 권리를 침해하는 내용은
              올리지 마세요.
            </p>
          </section>
          <section class="space-y-2">
            <h2 class="text-[18px] font-bold">4. 탈퇴</h2>
            <p>
              계정 화면에서 탈퇴할 수 있어요. 내가 만든 팀과 그 안의 프로젝트는
              함께 사라지고 되돌릴 수 없어요. 다른 팀의 프로젝트는 남고, 그 안의
              내 대화는 지워져요.
            </p>
          </section>
          <section class="space-y-2">
            <h2 class="text-[18px] font-bold">5. 책임</h2>
            <p>
              베타 동안 서비스 중단, 데이터 손실, 편집 충돌에 대해 법령이 정한
              범위를 넘어서는 책임을 지지 않아요. 유료 계약이 생기면 그때 다시
              안내할게요.
            </p>
          </section>
          <section class="space-y-2">
            <h2 class="text-[18px] font-bold">6. 문의</h2>
            <p>
              이용 문의와 버그 제보는
              <a
                :href="CONTACT_INSTAGRAM_URL"
                target="_blank"
                rel="noopener noreferrer"
                class="font-semibold text-primary"
                >인스타그램 {{ CONTACT_INSTAGRAM_HANDLE }}</a
              >
              DM으로 받아요.
            </p>
          </section>
        </template>
      </div>
      <Button variant="outline" class="mt-10 w-full" @click="goBack">
        돌아가기
      </Button>
    </article>

    <SiteFooter compact />
  </div>
</template>
