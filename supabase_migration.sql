-- ============================================================
-- My OS — Migration: DM / Channels / Reactions / Shared Goals
-- Supabase SQL Editor에서 실행하세요
-- ============================================================

-- 1. community_posts: reactions (jsonb) + pinned (bool) 컬럼 추가
ALTER TABLE community_posts
  ADD COLUMN IF NOT EXISTS reactions jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS pinned    boolean DEFAULT false;

-- 2. goals: group_id + is_shared 컬럼 추가
ALTER TABLE goals
  ADD COLUMN IF NOT EXISTS group_id  uuid REFERENCES community_groups(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_shared boolean DEFAULT false;

-- 3. folders: group_id 컬럼 추가
ALTER TABLE folders
  ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES community_groups(id) ON DELETE SET NULL;

-- 4. direct_messages 테이블 생성
CREATE TABLE IF NOT EXISTS direct_messages (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id      uuid REFERENCES community_groups(id) ON DELETE SET NULL,
  content       text NOT NULL,
  read          boolean DEFAULT false,
  author        text,
  avatar        text,
  avatar_img    text,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dm_from ON direct_messages(from_user_id);
CREATE INDEX IF NOT EXISTS idx_dm_to   ON direct_messages(to_user_id);
CREATE INDEX IF NOT EXISTS idx_dm_group ON direct_messages(group_id);

-- RLS
ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "dm_own" ON direct_messages;
CREATE POLICY "dm_own" ON direct_messages
  USING (from_user_id = auth.uid() OR to_user_id = auth.uid());

-- 5. channels 테이블 생성
CREATE TABLE IF NOT EXISTS channels (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    uuid NOT NULL REFERENCES community_groups(id) ON DELETE CASCADE,
  name        text NOT NULL,
  description text,
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_channels_group ON channels(group_id);

ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "channels_group_member" ON channels;
CREATE POLICY "channels_group_member" ON channels
  USING (
    group_id IN (
      SELECT group_id FROM community_group_members WHERE user_id = auth.uid()
    )
  );

-- 6. channel_messages 테이블 생성
CREATE TABLE IF NOT EXISTS channel_messages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content    text NOT NULL,
  author     text,
  avatar     text,
  avatar_img text,
  reactions  jsonb DEFAULT '{}'::jsonb,
  pinned     boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cm_channel ON channel_messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_cm_user    ON channel_messages(user_id);

ALTER TABLE channel_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cm_group_member" ON channel_messages;
CREATE POLICY "cm_group_member" ON channel_messages
  USING (
    channel_id IN (
      SELECT c.id FROM channels c
      JOIN community_group_members m ON m.group_id = c.group_id
      WHERE m.user_id = auth.uid()
    )
  );
