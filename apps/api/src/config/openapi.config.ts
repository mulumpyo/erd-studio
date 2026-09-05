import type { INestApplication } from '@nestjs/common'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { apiReference } from '@scalar/nestjs-api-reference'
import { appConfig } from './app.config'
import { ACCESS_COOKIE } from '../common/auth/cookies'

const description = `팀과 함께 ERD를 그리고, SQL로 주고받는 ERD Studio의 REST API예요.

### 인증
로그인하면 \`erd_access\`(15분)와 \`erd_refresh\`(14일) 쿠키를 내려줘요. 둘 다 HttpOnly라
브라우저는 따로 저장할 게 없어요. 액세스 쿠키가 만료되면 \`POST /auth/refresh\`로 새로 받아요.

쿠키를 쓸 수 없는 환경(서버 스크립트 등)에서는 \`Authorization: Bearer <액세스 토큰>\`도 받아요.

### 권한
프로젝트는 \`owner\` / \`editor\` / \`viewer\` 역할로 나뉘어요. 볼 수 없는 프로젝트는 존재 자체를
감추려고 \`403\` 대신 \`404\`로 답해요.

팀에 속한 프로젝트라면 팀원 관리는 팀에서 해요. 프로젝트 팀원 API는 개인 프로젝트에서만 써요.

플랫폼 관리자(\`isAdmin\`)는 팀 역할과 따로예요. 첫 관리자는 \`INITIAL_ADMIN_EMAIL\`로 올리고, 이후에는 관리자 화면에서 추가해요.

### 실시간 편집
다이어그램 편집은 이 API가 아니라 별도 협업 서버(WebSocket)가 담당해요. 같은 도메인이면 쿠키로
바로 붙고, 도메인이 다르면 \`GET /auth/ws-token\`으로 2분짜리 토큰을 받아서 붙여요.

### 오류 형식
모든 오류는 \`{ "statusCode": 400, "message": "...", "error": "Bad Request" }\` 모양이에요.
요청이 너무 잦으면 \`429\`가 오니 잠시 후 다시 시도해 주세요.`

export const openApiConfig = {
  title: 'ERD Studio',
  description,
  version: '0.1.0',
  swaggerPath: 'swagger',
  jsonPath: 'openapi.json',
}

export const openApiTags = [
  {
    name: 'auth',
    description:
      '회원가입, 이메일 인증, 로그인, 비밀번호 관리처럼 계정과 세션에 관한 일을 해요.',
  },
  {
    name: 'projects',
    description:
      'ERD 프로젝트를 만들고 저장해요. 버전, 팀원, 공유 링크도 여기서 다뤄요.',
  },
  {
    name: 'teams',
    description: '팀을 만들고 팀원을 초대해요. 팀 프로젝트의 권한은 팀을 따라가요.',
  },
  { name: 'sql', description: '다이어그램을 SQL로 내보내거나, SQL을 읽어 들여요.' },
  { name: 'chat', description: '프로젝트 안에서 팀원과 메시지를 주고받아요.' },
  {
    name: 'notify',
    description: '워크스페이스에서 채팅·초대 알림을 바로 받아요.',
  },
  { name: 'invites', description: '받은 초대를 확인하고 수락해요.' },
  {
    name: 'admin',
    description:
      '서비스 운영 화면이에요. 사용량과 사용자·관리자를 다루고, 플랫폼 관리자만 쓸 수 있어요.',
  },
  { name: 'health', description: '서버와 Redis가 살아 있는지 확인해요.' },
] as const

export const COOKIE_AUTH = 'cookieAuth'
export const BEARER_AUTH = 'bearerAuth'

export const scalarReferenceOptions = {
  hideDarkModeToggle: true,
  theme: 'fastify',
  showOperationId: true,
  hideClientButton: false,
  showSidebar: true,
  showDeveloperTools: 'localhost',
  showToolbar: 'localhost',
  operationTitleSource: 'summary',
  persistAuth: false,
  telemetry: true,
  externalUrls: {
    dashboardUrl: 'https://dashboard.scalar.com',
    registryUrl: 'https://registry.scalar.com',
    proxyUrl: 'https://proxy.scalar.com',
    apiBaseUrl: 'https://api.scalar.com',
  },
  layout: 'modern',
  isEditable: false,
  hideModels: false,
  documentDownloadType: 'both',
  hideTestRequestButton: false,
  hideSearch: false,
  withDefaultFonts: true,
  defaultOpenFirstTag: true,
  defaultOpenAllTags: false,
  expandAllModelSections: false,
  expandAllResponses: false,
  expandAllSchemaProperties: false,
  orderSchemaPropertiesBy: 'alpha',
  orderRequiredPropertiesFirst: true,
  modelsSectionLabel: 'Models',
  title: 'ERD Studio API',
} as const

export const setupOpenApi = (app: INestApplication) => {
  const prefix = appConfig.prefix()
  const builder = new DocumentBuilder()
    .setTitle(openApiConfig.title)
    .setDescription(openApiConfig.description)
    .setVersion(openApiConfig.version)
    .addServer(prefix ? `/${prefix}` : '/')
    .addCookieAuth(
      ACCESS_COOKIE,
      {
        type: 'apiKey',
        in: 'cookie',
        name: ACCESS_COOKIE,
        description:
          '로그인하면 자동으로 담기는 HttpOnly 쿠키예요. 브라우저에서는 이걸 쓰면 돼요.',
      },
      COOKIE_AUTH,
    )
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description:
          '쿠키를 쓸 수 없을 때만 써요. 로그인 응답의 액세스 토큰을 그대로 넣어 주세요.',
      },
      BEARER_AUTH,
    )

  for (const tag of openApiTags) builder.addTag(tag.name, tag.description)

  const document = SwaggerModule.createDocument(app, builder.build())

  SwaggerModule.setup(openApiConfig.swaggerPath, app, document, {
    useGlobalPrefix: Boolean(prefix),
    jsonDocumentUrl: openApiConfig.jsonPath,
    customSiteTitle: `${openApiConfig.title} Swagger`,
    swaggerOptions: { persistAuthorization: true },
  })

  app.use(
    appConfig.path('docs'),
    apiReference({
      content: document,
      pageTitle: scalarReferenceOptions.title,
      ...scalarReferenceOptions,
    }),
  )
}
