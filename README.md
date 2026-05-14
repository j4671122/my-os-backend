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

## 오픈소스 라이브러리 및 라이선스

> **개발 철학**: 이 프로젝트는 상업적으로 사용 가능한 오픈소스 라이브러리를 적극적으로 활용합니다.
> 새로운 기능을 추가할 때도 MIT / Apache 2.0 / BSD 등 상업적 이용이 허가된 라이선스의 라이브러리를 우선 선택해주세요.
> 향후 산업용·상업용으로 전환 시에도 라이선스 문제 없이 사용할 수 있도록 유지합니다.

| 라이브러리 | 버전 | 용도 | 라이선스 | 상업적 이용 |
|-----------|------|------|---------|-----------|
| **@supabase/supabase-js** | 2.x | 데이터베이스 · 인증 | MIT | ✅ |
| **@xenova/transformers** | 2.17.2 | 음성인식 (Whisper, 브라우저 내 실행) | Apache 2.0 | ✅ |
| **Whisper-tiny 모델** (OpenAI) | — | 다국어 음성→텍스트 변환 | MIT | ✅ |
| **Editor.js** | 2.28.2 | 메모 리치 텍스트 에디터 | Apache 2.0 | ✅ |
| **@editorjs/header** | 2.8.1 | Editor.js 헤딩 블록 | MIT | ✅ |
| **@editorjs/list** | 1.9.0 | Editor.js 목록 블록 | MIT | ✅ |
| **@editorjs/checklist** | 1.6.0 | Editor.js 체크리스트 블록 | MIT | ✅ |
| **@editorjs/simple-image** | 1.6.0 | Editor.js 이미지 블록 | MIT | ✅ |
| **Open-Meteo API** | — | 날씨 데이터 (무료, 무키) | CC-BY 4.0 | ✅ (출처 표기) |
| **Nominatim / OpenStreetMap** | — | 역지오코딩 (위도/경도 → 주소) | ODbL | ✅ (출처 표기) |
| **MediaRecorder API** | Web 표준 | 브라우저 오디오 녹음 | W3C 표준 | ✅ |

### 라이선스 요약

- **MIT / Apache 2.0**: 상업적 이용, 수정, 배포 모두 자유. 저작권 표시만 유지.
- **CC-BY 4.0** (Open-Meteo): 상업적 이용 가능. "Powered by Open-Meteo" 출처 표기 권장.
- **ODbL** (OpenStreetMap/Nominatim): 상업적 이용 가능. 데이터 변경 시 동일 라이선스 적용.

> 산업용 전환 시 주의사항: ODbL의 경우 OSM 데이터를 DB화하여 재배포할 때 Share-Alike 조항 적용.
> Nominatim API를 그대로 호출하는 현재 사용 방식은 제약 없음.

---

## 음성 입력 구현 방식

브라우저 내장 `SpeechRecognition` 대신 **오프라인 동작 가능한 Whisper 방식** 사용:

```
🎤 탭 → MediaRecorder 녹음 시작
🔴 탭 → 녹음 종료
⏳ → @xenova/transformers로 Whisper-tiny 모델 실행 (브라우저 내 WebAssembly)
✅ → 변환된 텍스트를 입력창에 삽입
```

- 최초 1회 약 40MB 모델 다운로드 (이후 브라우저 캐시)
- 서버 전송 없음 — 완전 오프라인 처리
- AI API 호출 없음 — 추가 비용 없음
- 한국어 · 영어 · 중국어 자동 감지

---

## 구현된 기능

### 인증
- Google OAuth 로그인 (Supabase Auth)
- JWT 토큰 기반 API 인증
- 게스트 모드 지원

### 할 일 (Tasks)
- 폴더별 작업 분류
- 체크리스트 토글 (항목 추가 후 키보드 유지, 한국어 IME 마지막 글자 중복 방지)
- 드래그 앤 드롭 정렬
- 서버 동기화

### 습관 트래커 (Habits)
- 습관 추가/삭제
- 최근 7일 체크 셀 (Vine / Lego / Slime 블록 디자인 선택 가능)
- 스트릭 카운트
- 이모티콘 커스터마이징

### 목표 (Goals)
- 목표 생성 및 진행률 관리
- 대시보드 마인드맵 뷰

### Time Tracker
- 60블록 시간 시각화
- 시간대별 색상 구분
- 모바일 글래스모피즘 사이드바

### 포모도로
- SVG 링 타이머, 세션 카운트, 설정 서버 저장

### 루틴
- 아침/점심/저녁 루틴, 요일별 설정, 서버 저장

### 메모
- Editor.js 기반 리치 텍스트 에디터, 서버 저장

### 홈 위젯
- 날씨 위젯 (Open-Meteo + Nominatim, 옷차림 추천)
- 스트릭 30일 점 그리드
- 시계, 목표, 습관, 포모도로, 메모, 검색, 캘린더 등 19종

### AI 어시스턴트
- 3가지 모드 (일반 / 집중 / 창의)
- 음성 입력: MediaRecorder + Whisper.js (오프라인, 무료)

### 커뮤니티
- Twitter/X 스타일 피드
- 좋아요, 댓글, Supabase 실시간 동기화

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

## 핵심 설계 원칙

> 각 유저의 개인화 OS를 통한 개인화된 삶을 우선시합니다.
> 모든 설정·데이터는 계정별로 서버에 영구 저장됩니다.
> 오픈소스 라이브러리를 적극 활용하되, 항상 상업적 이용 가능한 라이선스(MIT/Apache 2.0/BSD)를 선택합니다.

---

## AI 호출 정책

| 호출 위치 | 빈도 | 비고 |
|-----------|------|------|
| 할일 생성 시 태그 자동 분류 | 태스크당 1회 | — |
| 홈 AI 코치 메시지 | 10분 쿨다운 | — |
| AI 배지 생성 | 1시간 쿨다운 | — |
| 습관 추가 시 이모티콘+스타일 추천 | 습관당 1회 | — |
| 음성 입력 | **없음** | Whisper 로컬 처리 |
| 날씨 위젯 | **없음** | Open-Meteo 무료 API |

---

## 주요 작업 이력

| 날짜 | 내용 |
|------|------|
| 초기 구축 | Google OAuth + 서버 스토리지 마이그레이션 (localStorage 제거) |
| 기능 추가 | 홈 위젯 · Time Tracker · 메모 · 포모도로 전체 구현 |
| 버그 수정 | 체크리스트 토글 · 드래그 충돌 · 습관 3열 레이아웃 |
| 개선 | 습관 90일 GitHub 히트맵 도입 (이후 7일 셀로 단순화) |
| 모바일 | 반응형 레이아웃 구현 |
| 커뮤니티 | Supabase 공유 피드 서버 연동 |
| 2026-05 | 모바일 전반 개선 — 안전 영역, 스크롤 방지, FAB 바텀네비 위 배치 |
| 2026-05 | 타임 트래커 모바일 사이드바 — 글래스모피즘 슬라이드 드로어 |
| 2026-05 | 날씨 위젯 — Open-Meteo + Nominatim, 옷차림/우산 추천 |
| 2026-05 | 스트릭 위젯 — 30일 점 그리드 추가 |
| 2026-05 | 체크리스트 키보드 유지 + 한국어 IME 마지막 글자 중복 방지 |
| 2026-05 | 음성 입력 — Whisper.js 오프라인 변환 (AI 호출 없음) |
