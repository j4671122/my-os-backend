-- ============================================================
-- My OS TODO — Schema v3
-- Supabase SQL Editor에서 실행
-- ============================================================

-- ── habits 테이블 추가 ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS habits (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT NOT NULL,
  name        TEXT NOT NULL,
  sort_order  INTEGER DEFAULT 0,
  checks      TEXT[] DEFAULT '{}',   -- 체크한 날짜 배열 (YYYY-MM-DD)
  streak      INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_habits_user_id ON habits(user_id);

ALTER TABLE habits ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "habits_own" ON habits FOR ALL
  USING (auth.uid()::text = user_id);

-- ── profiles: preferences JSONB 컬럼 추가 ──────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}';
-- preferences 저장 내용: { tagReg, notifications }

-- ── habits: RLS 정책 (auth 없는 환경용) ──────────────────
-- RLS 비활성화 상태라면 아래 줄 실행:
-- ALTER TABLE habits DISABLE ROW LEVEL SECURITY;

