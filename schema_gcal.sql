-- ============================================================
-- My OS TODO — Google Calendar 연동 스키마
-- Supabase SQL Editor에서 실행
-- ============================================================

-- profiles 테이블에 Google Calendar 토큰 저장 컬럼 추가
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS gcal_tokens JSONB;

-- gcal_tokens 구조 (참고용):
-- {
--   "access_token":  "ya29.xxx",
--   "refresh_token": "1//xxx",   -- 재발급 불필요, 영구 보관
--   "expires_at":    1714300000000,  -- ms timestamp
--   "scope":         "https://www.googleapis.com/auth/calendar.readonly"
-- }
