/**
 * /api/groups
 * GET                      → 내 그룹 목록 (멤버인 그룹)
 * GET ?code=XXX            → 초대코드로 그룹 조회 (인증 불필요)
 * POST                     → 그룹 생성 {name, description, avatar}
 * POST ?action=join&id=    → 그룹 참가
 * DELETE ?id=              → 그룹 탈퇴 (admin이면 그룹 삭제)
 */
import supabase from './_lib/supabase.js'
import { withCors, getUserId } from './_lib/cors.js'
import { getAuthUser } from './_lib/auth.js'

function generateInviteCode() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let code = ''
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

export default withCors(async (req, res) => {
  const { id, action, code } = req.query

  // GET ?code=XXX → 초대코드 조회 (인증 불필요)
  if (req.method === 'GET' && code) {
    const { data, error } = await supabase
      .from('community_groups')
      .select('*')
      .eq('invite_code', code.toLowerCase())
      .single()
    if (error || !data) return res.status(404).json({ error: '코드를 찾을 수 없어요' })
    return res.json(data)
  }

  // 나머지는 인증 필요
  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })
  req.user = user
  const uid = getUserId(req)

  // GET → 내 그룹 목록
  if (req.method === 'GET') {
    const { data: memberships, error: me } = await supabase
      .from('community_group_members')
      .select('role, community_groups(*)')
      .eq('user_id', uid)
    if (me) return res.status(500).json({ error: me.message })

    const groups = (memberships || []).map(m => ({
      ...m.community_groups,
      my_role: m.role,
    }))

    // member_count 붙이기
    const groupIds = groups.map(g => g.id)
    if (groupIds.length > 0) {
      const { data: counts } = await supabase
        .from('community_group_members')
        .select('group_id')
        .in('group_id', groupIds)
      const countMap = {}
      ;(counts || []).forEach(r => {
        countMap[r.group_id] = (countMap[r.group_id] || 0) + 1
      })
      groups.forEach(g => { g.member_count = countMap[g.id] || 1 })
    }

    return res.json(groups)
  }

  // POST ?action=join&id= → 그룹 참가
  if (req.method === 'POST' && action === 'join' && id) {
    // 이미 멤버인지 확인
    const { data: existing } = await supabase
      .from('community_group_members')
      .select('id')
      .eq('group_id', id)
      .eq('user_id', uid)
      .maybeSingle()
    if (existing) return res.status(409).json({ error: '이미 멤버입니다' })

    const { error: je } = await supabase
      .from('community_group_members')
      .insert({ group_id: id, user_id: uid, role: 'member' })
    if (je) return res.status(500).json({ error: je.message })

    const { data: grp } = await supabase
      .from('community_groups')
      .select('*')
      .eq('id', id)
      .single()
    return res.status(201).json(grp)
  }

  // POST → 그룹 생성
  if (req.method === 'POST') {
    const { name, description, avatar } = req.body || {}
    if (!name?.trim()) return res.status(400).json({ error: 'name required' })

    let invite_code = generateInviteCode()
    // 중복 방지 재시도
    for (let i = 0; i < 3; i++) {
      const { data: existing } = await supabase
        .from('community_groups')
        .select('id')
        .eq('invite_code', invite_code)
        .maybeSingle()
      if (!existing) break
      invite_code = generateInviteCode()
    }

    const { data: grp, error: ge } = await supabase
      .from('community_groups')
      .insert({
        name: name.trim(),
        description: description?.trim() || '',
        avatar: avatar || '👥',
        avatar_color: '#2c5f2e',
        invite_code,
        created_by: uid,
      })
      .select()
      .single()
    if (ge) return res.status(500).json({ error: ge.message })

    // 생성자는 admin으로 멤버 추가
    await supabase.from('community_group_members').insert({
      group_id: grp.id,
      user_id: uid,
      role: 'admin',
    })

    return res.status(201).json(grp)
  }

  // DELETE ?id= → 탈퇴 또는 그룹 삭제
  if (req.method === 'DELETE') {
    if (!id) return res.status(400).json({ error: 'id required' })

    // 내 역할 확인
    const { data: membership } = await supabase
      .from('community_group_members')
      .select('role')
      .eq('group_id', id)
      .eq('user_id', uid)
      .maybeSingle()

    if (!membership) return res.status(404).json({ error: '멤버가 아닙니다' })

    if (membership.role === 'admin') {
      // admin이면 그룹 전체 삭제 (cascade)
      const { error: de } = await supabase
        .from('community_groups')
        .delete()
        .eq('id', id)
      if (de) return res.status(500).json({ error: de.message })
    } else {
      // 일반 멤버 — 탈퇴만
      const { error: le } = await supabase
        .from('community_group_members')
        .delete()
        .eq('group_id', id)
        .eq('user_id', uid)
      if (le) return res.status(500).json({ error: le.message })
    }

    return res.json({ success: true })
  }

  res.status(405).json({ error: 'Method not allowed' })
})
