# My OS — 개인 생산성 앱

개인 운영체제 컨셉의 올인원 생산성 앱. 단일 HTML 파일 프론트엔드 + Vercel 서버리스 API + Supabase DB로 구성.

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| 프론트엔드 | `public/index.html` (CSS/JS 인라인, 단일 파일) |
| 백엔드 | Vercel Serverless Functions (`api/*.js`) |
| 데이터베이스 | Supabase (PostgreSQL + Row Level Security) |
| 인증 | Supabase Auth (Google OAuth) |
| 배포 | Vercel |

---

## 구현된 기능

### 인증
- Google OAuth 로그인 (Supabase Auth)
- JWT 토큰 기반 API 인증
- 게스트 모드 지원

### 할 일 (Tasks)
- 폴더별 작업 분류
- 체크리스트 토글
- 드래그 앤 드롭 정렬
- 서버 동기화

### 습관 트래커 (Habits)
- 습관 추가/삭제
- 최근 7일 체크 셀 (Vine / Lego / Slime 스타일 순환)
- 스트릭 카운트
- 이모티콘 커스터마이징 (클릭으로 변경)

### 목표 (Goals)
- 목표 생성 및 진행률 관리
- 대시보드 마인드맵 뷰

### Time Tracker
- 60블록 시간 시각화
- 시간대별 색상 구분

### 포모도로
- SVG 링 타이머
- 세션 카운트

### 메모
- 자유 텍스트 메모
- 서버 저장

### 이벤트 / 캘린더
- 일정 추가 및 날짜별 뷰

### AI 어시스턴트
- 3가지 모드 (일반 / 집중 / 창의)
- Vercel AI API 연동

### 커뮤니티 (Twitter/X 스타일)
- 전체 유저 공유 피드
- 게시글 작성 (280자 제한, SVG 원형 카운터)
- 좋아요 토글
- 댓글 추가/삭제
- 게시글 삭제 (본인 것만)
- Supabase `community_posts` 테이블에 실시간 동기화

---

## API 엔드포인트

| 파일 | 역할 |
|------|------|
| `api/tasks.js` | 할 일 CRUD |
| `api/habits.js` | 습관 CRUD + 체크 |
| `api/goals.js` | 목표 CRUD |
| `api/events.js` | 이벤트 CRUD |
| `api/folders.js` | 폴더 관리 |
| `api/profile.js` | 프로필 설정 저장 |
| `api/community.js` | 커뮤니티 피드 (GET/POST/PATCH/DELETE) |
| `api/ai.js` | AI 메시지 처리 |

---

## DB 스키마

- `schema_v3.sql` — 메인 테이블 (tasks, habits, goals, events 등)
- `schema_community.sql` — 커뮤니티 게시글 테이블

> Supabase SQL Editor에서 순서대로 실행 필요

---

## 로컬 개발

```bash
npm install
npm run dev   # vercel dev → localhost:3000
```

## 배포

```bash
npm run deploy   # vercel --prod
```

---

## 주요 작업 이력

| 커밋 | 내용 |
|------|------|
| 초기 구축 | Google OAuth + 서버 스토리지 마이그레이션 (localStorage 제거) |
| 기능 추가 | 홈 위젯 · Time Tracker · 메모 · 포모도로 전체 구현 |
| 버그 수정 | 체크리스트 토글 · 드래그 충돌 · 습관 3열 레이아웃 |
| 개선 | 습관 90일 GitHub 히트맵 도입 (이후 7일 셀로 단순화) |
| 모바일 | 반응형 레이아웃 구현 |
| 커뮤니티 | Supabase 공유 피드 서버 연동 |
| 커뮤니티 리디자인 | Twitter/X 스타일 UI, SVG 아이콘, 원형 글자 수 카운터 |
| 버그 수정 | 게시글 업로드 후 사라짐 현상 수정 (임시 포스트 유지 처리) |
