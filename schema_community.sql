-- ============================================================
-- My OS TODO — Community Posts Schema
-- Supabase SQL Editor에서 실행
-- ============================================================

CREATE TABLE IF NOT EXISTS community_posts (
  id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    TEXT    NOT NULL,
  author     TEXT    NOT NULL DEFAULT '익명',
  handle     TEXT    NOT NULL DEFAULT '',
  avatar     TEXT    NOT NULL DEFAULT '😊',
  avatar_bg  INTEGER NOT NULL DEFAULT 0,
  avatar_img TEXT    NOT NULL DEFAULT '',
  content    TEXT    NOT NULL,
  likes      INTEGER NOT NULL DEFAULT 0,
  liked_by   TEXT[]  NOT NULL DEFAULT '{}',
  comments   JSONB   NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_community_posts_created_at
  ON community_posts(created_at DESC);

ALTER TABLE community_posts ENABLE ROW LEVEL SECURITY;

-- 모든 인증 유저가 읽기 가능
CREATE POLICY IF NOT EXISTS "comm_read_all"
  ON community_posts FOR SELECT USING (true);

-- 자기 게시글만 작성
CREATE POLICY IF NOT EXISTS "comm_insert_own"
  ON community_posts FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

-- 좋아요/댓글은 모든 유저가 업데이트 가능
CREATE POLICY IF NOT EXISTS "comm_update_all"
  ON community_posts FOR UPDATE USING (true);

-- 자기 게시글만 삭제
CREATE POLICY IF NOT EXISTS "comm_delete_own"
  ON community_posts FOR DELETE
  USING (auth.uid()::text = user_id);
