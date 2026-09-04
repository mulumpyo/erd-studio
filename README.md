# ERD Studio

까마귀발 ERD를 팀과 함께, 브라우저에서 실시간으로 🦶

## 🚀 핵심 목표

* 까마귀발 표기법 ERD 작성
* SQL 가져오기 / 내보내기 (MySQL, PostgreSQL, MSSQL, Oracle)
* 팀·프로젝트 단위 권한 관리
* 여러 명이 같은 다이어그램을 동시에 편집

## 🛠️ 기술 스택

<p>
  <img src="https://skillicons.dev/icons?i=vue,vite,nestjs,prisma,postgres,redis,nodejs,pnpm,docker,nginx" alt="Vue, Vite, NestJS, Prisma, PostgreSQL, Redis, Node.js, pnpm, Docker, Nginx" />
</p>

## 🗂️ 프로젝트 구조

세 개의 앱과 공유 패키지를 하나의 모노레포에서 관리해요.

```text
apps/
├── web/       # Vue 3 + Vite (port 5173)
├── api/       # NestJS API (port 3000)
└── collab/    # Hocuspocus 협업 서버 (port 3030)

packages/
├── shared/    # 공유 타입, 권한 규칙
├── sql/       # SQL 생성·파싱
└── yjs-erd/   # Yjs 문서 스키마
```

## 📋 시작하기 전에

아래 환경이 필요해요.

* Node.js 20 이상
* pnpm 9 이상
* Docker (PostgreSQL, Redis 실행용)

pnpm은 Corepack을 활성화한 뒤 사용해주세요.

```bash
corepack enable
```

## ✨ 시작하기

### 1) 의존성을 설치해요

루트 디렉터리에서 아래 명령어를 실행해주세요.

```bash
pnpm install
```

### 2) 환경변수를 준비해요

`.env.example`을 복사해서 루트에 `.env` 파일을 만들어주세요.

macOS와 Linux에서는 아래 명령어를 사용해요.

```bash
cp .env.example .env
```

Windows에서는 아래 명령어를 사용해주세요.

```bash
copy .env.example .env
```

`.env.example`에는 로컬 개발에 필요한 기본값이 설정되어 있어요.

별도 설정이 필요하지 않다면 그대로 사용할 수 있어요. 환경에 맞게 변경해야 하는 값이 있다면 복사한 `.env`에서 수정해주세요.

### 3) 데이터베이스를 준비해요

PostgreSQL과 Redis를 Docker로 띄운 뒤 스키마를 반영해주세요.

```bash
pnpm db:up
pnpm db:generate
pnpm db:push
```

`pnpm db:up`은 앱이 아니라 PostgreSQL과 Redis만 실행해요. 앱은 다음 단계에서 호스트에서 직접 실행돼요.

### 4) 개발 서버를 실행해요

```bash
pnpm dev
```

Web, API, 협업 서버가 함께 실행돼요.

| 서비스                | URL                             |
| ------------------ | ------------------------------- |
| Web                | `http://localhost:5173`         |
| API                | `http://localhost:3000`         |
| Collab (WebSocket) | `ws://localhost:3030`           |
| API Docs (Scalar)  | `http://localhost:3000/docs`    |
| API Docs (Swagger) | `http://localhost:3000/swagger` |

앱별 로그를 따로 확인하고 싶다면 `@erd-studio/api#dev`처럼 해당 태스크를 선택하면 돼요.

## 🔐 환경변수

루트의 `.env` 하나를 세 앱이 함께 사용해요.

기본 로컬 개발 환경은 아래와 같아요.

```dotenv
# Database
DATABASE_URL=postgresql://erd:erd@localhost:5432/erdstudio
REDIS_URL=redis://localhost:6379

# Auth
JWT_SECRET=change-me-in-production
JWT_EXPIRES=15m
JWT_REFRESH_EXPIRES=14d

# Ports
API_PORT=3000
COLLAB_PORT=3030

# Origins
WEB_ORIGIN=http://localhost:5173
VITE_COLLAB_URL=ws://localhost:3030
```

각 환경변수는 아래 역할을 해요.

| 변수                    | 설명                     | 기본값                       |
| --------------------- | ---------------------- | ------------------------- |
| `DATABASE_URL`        | PostgreSQL 접속 주소       | `postgresql://erd:erd@localhost:5432/erdstudio` |
| `REDIS_URL`           | Redis 접속 주소            | `redis://localhost:6379`  |
| `JWT_SECRET`          | 토큰 서명 키                | —                         |
| `JWT_EXPIRES`         | 액세스 토큰 만료              | `15m`                     |
| `JWT_REFRESH_EXPIRES` | 리프레시 토큰 만료             | `14d`                     |
| `API_PORT`            | NestJS 포트              | `3000`                    |
| `COLLAB_PORT`         | 협업 서버 포트               | `3030`                    |
| `WEB_ORIGIN`          | CORS 허용 오리진            | `http://localhost:5173`   |
| `VITE_COLLAB_URL`     | Web → 협업 서버 주소         | `ws://localhost:3030`     |
| `INITIAL_ADMIN_EMAIL` | 첫 플랫폼 관리자 이메일. 계정이 있으면 관리자로 올려요 | — |

`JWT_SECRET`은 배포 전에 16자 이상의 랜덤 값으로 바꿔주세요. 프로덕션에서 값이 짧거나 예시 그대로면 API가 기동되지 않아요.

`WEB_ORIGIN`에는 `*`를 사용할 수 없어요. API가 인증 쿠키를 함께 보내기 때문에 실제 오리진을 지정해야 해요.

아래 값은 필요할 때만 설정해요.

| 변수                     | 설명                              |
| ---------------------- | ------------------------------- |
| `SMTP_*` `MAIL_FROM`   | 메일 발송. 비우면 메일 기능만 꺼져요           |
| `ALLOW_DEV_VERIFY_URL` | 로컬에서 인증·초대 링크를 화면에 노출해요         |
| `COOKIE_SECURE`        | HTTPS 환경에서 `true`               |
| `COOKIE_SAMESITE`      | 쿠키 SameSite 값                   |
| `API_PREFIX`           | API 글로벌 prefix. 프로덕션 기본값은 `api` |
| `ENABLE_API_DOCS`      | 프로덕션에서 API 문서를 열 때 `true`       |

`VITE_API_URL`은 비워두세요. 로컬에서는 Vite가 `/api`를 API로 프록시해요.

## ⌨️ 명령어

자주 사용하는 명령어예요.

```bash
pnpm dev          # 개발 서버 실행 (web / api / collab)
pnpm build        # 전체 빌드
pnpm test         # Unit Test
pnpm lint         # ESLint
pnpm format       # Prettier
```

데이터베이스 관련 명령어예요.

```bash
pnpm db:up        # PostgreSQL + Redis 실행
pnpm db:down      # 컨테이너 정리
pnpm db:generate  # Prisma Client 생성
pnpm db:push      # 스키마 반영
pnpm db:migrate   # 마이그레이션 생성
```

필요하다면 앱을 따로 실행할 수도 있어요.

```bash
pnpm --filter @erd-studio/api dev
pnpm --filter @erd-studio/web dev
pnpm --filter @erd-studio/collab dev
```

## ⚙️ API

API는 NestJS로 구성되어 있어요.

```text
src/
├── main.ts
├── common/       # 가드, 쿠키, CORS, 페이징
├── config/       # 포트, prefix, OpenAPI, 시크릿
├── controllers/
├── dto/
├── modules/
└── services/
```

기본 설정은 아래와 같아요.

* TypeScript는 `nodenext`와 `moduleResolution: nodenext`를 사용해요.
* 인증은 HttpOnly 쿠키(`erd_access`, `erd_refresh`)를 사용해요.
* API 문서는 Scalar UI와 Swagger UI로 함께 제공해요.
* 개발 서버를 실행한 뒤 `/docs` 또는 `/swagger`에서 확인할 수 있어요.

개발에서는 글로벌 prefix가 없고 Vite가 `/api`를 떼서 프록시해요. 프로덕션은 기본 prefix가 `api`예요.

API 문서는 개발에서 기본으로 켜지고, 프로덕션에서는 `ENABLE_API_DOCS=true`일 때만 열려요.

새 엔드포인트를 추가할 때는 `@ApiOperation`으로 요약과 설명을, `@ApiResponse`로 응답 코드를 함께 작성해주세요. DTO 필드에는 `@ApiProperty`로 설명과 예시를 남겨주세요.

## 🌐 Web

Web은 Vue 3와 Vite로 구성되어 있어요.

개발 환경에서는 `/api/**` 요청을 NestJS로 프록시해요.

덕분에 로컬 개발에서는 별도의 CORS 설정 없이 API를 호출할 수 있어요.

API를 호출할 때는 URL을 직접 작성하지 않고 API 클라이언트를 사용해주세요. 환경에 따라 주소가 달라져도 애플리케이션 코드를 수정하지 않아도 돼요.

## 🤝 실시간 협업

다이어그램 편집은 API가 아니라 별도의 협업 서버가 담당해요.

Yjs CRDT로 편집 내용을 합치고, Hocuspocus가 WebSocket 연결과 문서 저장을 맡아요.

Web과 협업 서버가 같은 오리진이면 HttpOnly 쿠키를 그대로 읽어서 인증해요. 도메인이 다른 경우에는 `GET /auth/ws-token`으로 2분짜리 토큰을 받아 연결해주세요.

## 📊 사용량 (DAU / WAU / MAU)

한국 날짜(`Asia/Seoul`)로 자른 **로그인한 사용자**만 세요. 관리자는 `/admin`에서 볼 수 있어요.

| 지표 | 기준 |
| --- | --- |
| DAU | 그날 워크스페이스·에디터를 쓴 고유 사용자 |
| WAU | 그날 포함 최근 7일 동안 한 번이라도 쓴 고유 사용자 |
| MAU | 그날 포함 최근 30일 동안 한 번이라도 쓴 고유 사용자 |

세는 것: 로그인, 이메일 인증 후 세션, 로그인한 API 호출, 에디터 WebSocket 연결.

안 세는 것: 랜딩만 본 사람, 공유 링크 익명 방문, 헬스 체크, 토큰 자동 갱신만 일어난 탭, **플랫폼 관리자**(`isAdmin`). 관리자 활동도 `UserActivityDay`에는 남겨 두고, 숫자를 만들 때만 빼요.

같은 사람은 하루에 한 번만 Redis에 찍고, PostgreSQL `UserActivityDay` / `UsageDaily`에 남겨요.

탈퇴하면 이름·이메일을 지우고, 내가 만든 팀과 그 안의 프로젝트는 함께 사라져요. 관리자 화면의 **총 가입자**는 탈퇴하지 않은 계정만 세고, 오늘·누적 탈퇴 숫자를 따로 보여요. 지난 DAU는 그대로 둬요.

첫 관리자는 `INITIAL_ADMIN_EMAIL`로 올려요. 이후 관리자 추가·사용자 목록은 `/admin`에서 해요. 사용자 관리 목록에는 관리자 계정이 안 나와요. 정지된 계정은 로그인과 편집을 할 수 없어요. 마지막 관리자는 탈퇴할 수 없어요.

## 🚀 배포

`deploy` 브랜치에 푸시하거나 PR을 머지하면 배포가 시작돼요.

`.github/workflows/deploy.yml`이 `linux/arm64` 이미지를 GHCR에 올리고, SSH로 서버에서 다시 띄워요. `main`은 배포와 분리해서 개발용으로 사용해요.

* `Dockerfile` — `web` / `api` / `collab` 멀티 스테이지 빌드. web 스테이지의 nginx 설정도 이 안에 있어요.
* `docker-compose.prod.yml` — 세 앱 + PostgreSQL + Redis + 일일 Postgres 백업. 워크플로가 이 파일만 서버로 복사해요.

서버의 `.env`는 워크플로가 GitHub Secrets에서 매번 새로 작성해요. 따로 예시 파일을 두지 않아요.

같은 도메인 하나를 nginx가 나눠 줘요.

```text
https://erd-studio.com
├─ /                → web    127.0.0.1:8082
├─ /api             → api    127.0.0.1:3001  (prefix 유지)
└─ /collaboration   → collab 127.0.0.1:3030  (WebSocket, prefix 제거)
```

앱 포트는 루프백에만 열고, 공개는 nginx의 80/443만 사용해요. PostgreSQL과 Redis는 컨테이너 네트워크에서만 접근해요.

API 컨테이너는 시작할 때 `prisma db push`로 스키마를 맞춘 뒤 Nest를 띄워요.

### GitHub Secrets

필수 항목이에요.

| 이름                                 | 설명                                                |
| ---------------------------------- | ------------------------------------------------- |
| `SSH_HOST` `SSH_USER` `SSH_KEY`    | 배포 대상 서버                                          |
| `JWT_SECRET`                       | 16자 이상 랜덤 값                                       |
| `POSTGRES_PASSWORD`                | DB 비밀번호                                           |
| `DATABASE_URL`                     | `postgresql://erd:<비밀번호>@postgres:5432/erdstudio` |

선택 항목이에요.

| 이름                                            | 설명                    |
| --------------------------------------------- | --------------------- |
| `SSH_PORT`                                    | 22가 아닐 때만             |
| `SMTP_HOST` `SMTP_PORT` `SMTP_USER` `SMTP_PASS` `SMTP_SECURE` `MAIL_FROM` | 메일을 사용할 때 |
| `INITIAL_ADMIN_EMAIL` | 첫 플랫폼 관리자 이메일 |

`GITHUB_TOKEN`은 GitHub이 자동으로 주입해요. 직접 등록하지 않아요.

`DATABASE_URL`의 비밀번호는 `POSTGRES_PASSWORD`와 같아야 하고, 호스트는 `localhost`가 아니라 컨테이너 서비스명인 `postgres`여야 해요.

`VITE_API_URL`과 `VITE_COLLAB_URL`은 비워둬요. 같은 오리진이라 프론트가 `/api`와 `wss://<도메인>/collaboration`으로 연결해요.

### 호스트 nginx

서버에서 처음 한 번만 설정하면 돼요.

<details>
<summary><code>/etc/nginx/sites-available/erd-studio</code></summary>

인증서 줄은 certbot이 `/etc/letsencrypt/live/erd-studio.com/` 아래로 관리해요.

```nginx
server {
    listen 80;
    server_name erd-studio.com www.erd-studio.com;
    return 301 https://erd-studio.com$request_uri;
}

server {
    listen 443 ssl;
    server_name erd-studio.com www.erd-studio.com;

    ssl_certificate /etc/letsencrypt/live/erd-studio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/erd-studio.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # Nest는 프로덕션에서 /api prefix를 유지하므로 떼지 않아요.
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        include proxy_params;
    }

    # Hocuspocus는 루트에서 듣습니다. WebSocket은 301을 따라가지 않으니
    # /collaboration 과 /collaboration/ 둘 다 프록시해야 해요.
    location /collaboration/ {
        proxy_pass http://127.0.0.1:3030/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
        proxy_buffering off;
        include proxy_params;
    }

    location = /collaboration {
        proxy_pass http://127.0.0.1:3030/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
        proxy_buffering off;
        include proxy_params;
    }

    location / {
        proxy_pass http://127.0.0.1:8082;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        include proxy_params;
    }
}
```

</details>

설정을 넣은 뒤 활성화해주세요.

```bash
sudo ln -s /etc/nginx/sites-available/erd-studio /etc/nginx/sites-enabled/erd-studio
sudo nginx -t
sudo systemctl reload nginx
```

### 배포 확인

서버에서 아래 명령어로 상태를 확인할 수 있어요.

```bash
cd /home/ubuntu/erd-studio
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs api --tail 50
```

Postgres는 한국 날짜 기준으로 하루에 한 번 `backup` 컨테이너가 덤프해요. 최근 14일만 남겨 둬요.

```bash
docker compose -f docker-compose.prod.yml exec backup ls -l /backups
```

복구할 때는 `backup` 컨테이너에서 바로 넣으면 돼요. 덮어쓰니 먼저 확인하세요.

```bash
docker compose -f docker-compose.prod.yml exec backup \
  pg_restore --clean --if-exists -h postgres -U erd -d erdstudio \
  /backups/erdstudio-YYYY-MM-DD.dump
```

## 💻 IDE 설정

처음 프로젝트를 받았다면 한 번 확인해주세요.

이 프로젝트는 **TypeScript 5.9 Workspace 버전**을 사용해요.

IDE가 프로젝트의 Workspace 버전이 아닌 다른 TypeScript 버전을 사용하면 `moduleResolution`과 관련된 deprecation 경고가 나타날 수 있어요.

VS Code에서는 아래와 같이 설정해주세요.

1. `Ctrl+Shift+P`를 열어요.
2. **TypeScript: Select TypeScript Version**을 선택해요.
3. **Use Workspace Version**을 선택해요.
4. **TypeScript: Restart TS Server**를 실행해요.

`.vscode/settings.json`에도 Workspace TypeScript를 사용하도록 설정되어 있어요.

처음 Clone한 뒤 한 번만 확인하면 돼요.

## 🎨 코드 스타일

세 앱과 공유 패키지 모두 같은 코드 스타일을 사용해요.

### Prettier

```text
semi: false
singleQuote: true
```

### ESLint

루트의 `eslint.config.mjs` 하나를 모든 워크스페이스가 함께 사용해요.

프로젝트별로 별도의 ESLint 설정을 만들지 않아요.

### 함수 작성 규칙

헬퍼 함수는 화살표 함수로 작성해주세요.

```ts
const createUser = () => {
  // ...
}
```

`main.ts`의 `bootstrap` 진입 함수만 `function` 선언을 허용해요.

그 외 함수는 화살표 함수로 작성해주세요.