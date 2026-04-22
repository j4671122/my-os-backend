/**
 * /api/profile
 *
 * GET  /api/profile              → 내 프로필 조회
 * POST /api/profile              → 프로필 최초 생성 (온보딩)
 * PUT  /api/profile              → 프로필 수정
 * GET  /api/profile?check=@tag   → user_tag 중복 확인
 * DELETE /api/profile            → 계정 삭제 (모든 데이터 포함)
 */
import supabase from './_lib/supabase.js'
import { withCors } from './_lib/cors.js'
import { getAuthUser } from './_lib/auth.js'

export default withCors(async (req, res) => {
  // user_tag 중복 확인은 인증 없이 가능
  if (req.method === 'GET' && req.query.check) {
    const tag = req.query.check.replace(/^@/, '').toLowerCase().trim()
    if (!tag) return res.json({ available: false, error: '태그를 입력해주세요' })
    if (!/^[a-z0-9_]{3,20}$/.test(tag)) {
      return res.json({ available: false, error: '영문 소문자, 숫자, _ 만 사용 (3~20자)' })
    }
    const { data } = await supabase.from('profiles').select('id').eq('user_tag', tag).maybeSingle()
    return res.json({ available: !data })
  }

  // 나머지는 인증 필요
  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  // ── GET (내 프로필) ──────────────────────────────────────
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()
    if (error) return res.status(500).json({ error: error.message })
    return res.json(data)   // null이면 프로필 미생성 (온보딩 필요)
  }

  // ── POST (프로필 최초 생성) ──────────────────────────────
  if (req.method === 'POST') {
    const { user_tag, display_name, avatar, avatar_img, bio } = req.body || {}

    // user_tag 검증
    const tag = (user_tag || '').replace(/^@/, '').toLowerCase().trim()
    if (!tag || !/^[a-z0-9_]{3,20}$/.test(tag)) {
      return res.status(400).json({ error: '유저 태그: 영문 소문자, 숫자, _ 만 사용 (3~20자)' })
    }

    // 중복 확인
    const { data: existing } = await supabase
      .from('profiles').select('id').eq('user_tag', tag).maybeSingle()
    if (existing) return res.status(409).json({ error: '이미 사용 중인 태그입니다' })

    const { data, error } = await supabase.from('profiles').insert({
      id:           user.id,
      user_tag:     tag,
      display_name: display_name || user.email?.split('@')[0] || tag,
      avatar:       avatar || '😊',
      avatar_img:   avatar_img || null,
      bio:          bio || null,
      permission:   'user'
    }).select().single()

    if (error) return res.status(500).json({ error: error.message })
    return res.status(201).json(data)
  }

  // ── PUT (프로필 수정) ────────────────────────────────────
  if (req.method === 'PUT') {
    const allowed = ['display_name','avatar','avatar_img','bio','ai_personality','lang','preferences','user_tag']
    const updates = {}
    for (const k of allowed) {
      if (req.body?.[k] !== undefined) updates[k] = req.body[k]
    }
    if (!Object.keys(updates).length) return res.status(400).json({ error: '수정할 항목 없음' })

    if (updates.user_tag !== undefined) {
      const tag = String(updates.user_tag || '').replace(/^@/, '').toLowerCase().trim()
      if (!tag || !/^[a-z0-9_]{3,20}$/.test(tag)) {
        return res.status(400).json({ error: '유저 태그: 영문 소문자, 숫자, _ 만 사용 (3~20자)' })
      }
      const { data: existing, error: existingError } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_tag', tag)
        .neq('id', user.id)
        .maybeSingle()
      if (existingError) return res.status(500).json({ error: existingError.message })
      if (existing) return res.status(409).json({ error: '이미 사용 중인 태그입니다' })
      updates.user_tag = tag
    }

    const { data, error } = await supabase
      .from('profiles').update(updates).eq('id', user.id).select().single()
    if (error) return res.status(500).json({ error: error.message })
    return res.json(data)
  }

  // ── DELETE (계정 삭제) ───────────────────────────────────
  if (req.method === 'DELETE') {
    // 모든 유저 데이터 삭제 (CASCADE로 연결된 것들은 자동 삭제)
    await supabase.from('tasks').delete().eq('user_id', user.id)
    await supabase.from('goals').delete().eq('user_id', user.id)
    await supabase.from('folders').delete().eq('user_id', user.id)
    await supabase.from('events').delete().eq('user_id', user.id)
    await supabase.from('tags').delete().eq('user_id', user.id)
    await supabase.from('profiles').delete().eq('id', user.id)

    // Supabase Auth 유저 삭제 (service role 필요)
    const { error } = await supabase.auth.admin.deleteUser(user.id)
    if (error) return res.status(500).json({ error: error.message })
    return res.json({ ok: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
})
