-- ============================================================
-- My OS — Migration: Multi-profile & Group Profiles
-- Supabase SQL Editor에서 실행하세요
-- ============================================================

-- 1. profiles 테이블에 멀티프리셋 컬럼 추가
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS profile_presets jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS bio             text,
  ADD COLUMN IF NOT EXISTS title_badge     text;

-- 2. community_group_members: 그룹 역할/설정 컬럼 추가
ALTER TABLE community_group_members
  ADD COLUMN IF NOT EXISTS role text DEFAULT 'member';  -- 'admin' | 'member'

-- 3. group_profiles: 그룹별 프로필 설정 테이블
CREATE TABLE IF NOT EXISTS group_profiles (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id     uuid NOT NULL REFERENCES community_groups(id) ON DELETE CASCADE,
  nickname     text,         -- 그룹 내 별명
  avatar       text,         -- 이모지 아바타 오버라이드
  avatar_bg    integer DEFAULT 0,
  avatar_img   text,         -- 프로필 이미지 오버라이드
  bio          text,         -- 그룹 내 자기소개
  show_title   boolean DEFAULT true,   -- 칭호 표시 여부
  show_avatar  boolean DEFAULT true,   -- 아바타 표시 여부
  preset_id    text,         -- 적용된 프리셋 id (참조용)
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now(),
  UNIQUE(user_id, group_id)
);

CREATE INDEX IF NOT EXISTS idx_gp_user    ON group_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_gp_group   ON group_profiles(group_id);

-- RLS
ALTER TABLE group_profiles ENABLE ROW LEVEL SECURITY;

-- 자기 프로필은 본인만 수정 가능
DROP POLICY IF EXISTS "gp_own_write" ON group_profiles;
CREATE POLICY "gp_own_write" ON group_profiles
  FOR ALL USING (user_id = auth.uid());

-- 같은 그룹 멤버는 읽기 가능
DROP POLICY IF EXISTS "gp_group_read" ON group_profiles;
CREATE POLICY "gp_group_read" ON group_profiles
  FOR SELECT USING (
    group_id IN (
      SELECT group_id FROM community_group_members WHERE user_id = auth.uid()
    )
  );
