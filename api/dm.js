/**
 * /api/dm
 * GET  ?groupId=<id>    → 이 그룹에서 내가 교환한 DM 스레드 목록 (유저별 최신 메시지)
 * GET  ?with=<userId>   → 특정 유저와의 전체 대화 (최근 100개, 오래된 순)
 * POST                  → 메시지 전송 { toUserId, groupId, content }
 * PATCH ?id=<msgId>     → 읽음 처리 (수신자만)
 * DELETE ?id=<msgId>    → 내 메시지 삭제
 */
import supabase from './_lib/supabase.js'
import { withCors, getUserId } from './_lib/cors.js'
import { getAuthUser } from './_lib/auth.js'

export default withCors(async (req, res) => {
  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })
  req.user = user
  const uid = getUserId(req)
  const { groupId, with: withUser, id } = req.query

  // GET ?groupId= → 그룹 내 DM 스레드 목록 (상대방별 최신 메시지)
  if (req.method === 'GET' && groupId && !withUser) {
    const { data: msgs, error } = await supabase
      .from('direct_messages')
      .select('*')
      .eq('group_id', groupId)
      .or(`from_user_id.eq.${uid},to_user_id.eq.${uid}`)
      .order('created_at', { ascending: false })
    if (error) return res.status(500).json({ error: error.message })

    // 상대방 ID별로 가장 최신 메시지 1개씩 추출
    const threadMap = {}
    for (const msg of msgs || []) {
      const partnerId = msg.from_user_id === uid ? msg.to_user_id : msg.from_user_id
      if (!threadMap[partnerId]) {
        threadMap[partnerId] = { ...msg, partnerId }
      }
    }
    return res.json(Object.values(threadMap))
  }

  // GET ?with=<userId> → 특정 유저와의 대화 전체 (최신 100개, 오래된 순)
  if (req.method === 'GET' && withUser) {
    const { data, error } = await supabase
      .from('direct_messages')
      .select('*')
      .or(
        `and(from_user_id.eq.${uid},to_user_id.eq.${withUser}),and(from_user_id.eq.${withUser},to_user_id.eq.${uid})`
      )
      .order('created_at', { ascending: true })
      .limit(100)
    if (error) return res.status(500).json({ error: error.message })
    return res.json(data || [])
  }

  // POST → 메시지 전송
  if (req.method === 'POST') {
    const { toUserId, groupId: gId, content } = req.body || {}
    if (!toUserId) return res.status(400).json({ error: 'toUserId required' })
    if (!content?.trim()) return res.status(400).json({ error: 'content required' })

    // 프로필에서 작성자 정보 가져오기 (선택적)
    const { data: profile } = await supabase
      .from('profiles')
      .select('name, avatar, avatar_img')
      .eq('id', uid)
      .maybeSingle()

    const { data, error } = await supabase
      .from('direct_messages')
      .insert({
        from_user_id: uid,
        to_user_id:   toUserId,
        group_id:     gId || null,
        content:      content.trim(),
        read:         false,
        author:       profile?.name    || null,
        avatar:       profile?.avatar  || null,
        avatar_img:   profile?.avatar_img || null,
      })
      .select()
      .single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(201).json(data)
  }

  // PATCH ?id= → 읽음 처리 (수신자만)
  if (req.method === 'PATCH') {
    if (!id) return res.status(400).json({ error: 'id required' })
    const { data, error } = await supabase
      .from('direct_messages')
      .update({ read: true })
      .eq('id', id)
      .eq('to_user_id', uid)
      .select()
      .single()
    if (error) return res.status(500).json({ error: error.message })
    return res.json(data)
  }

  // DELETE ?id= → 내 메시지 삭제
  if (req.method === 'DELETE') {
    if (!id) return res.status(400).json({ error: 'id required' })
    const { error } = await supabase
      .from('direct_messages')
      .delete()
      .eq('id', id)
      .eq('from_user_id', uid)
    if (error) return res.status(500).json({ error: error.message })
    return res.json({ success: true })
  }

  res.status(405).json({ error: 'Method not allowed' })
})
