/**
 * /api/channels
 *
 * 채널 관리:
 *   GET  ?groupId=<id>                          → 그룹 채널 목록
 *   POST ?groupId=<id>                          → 채널 생성 { name, description }
 *   DELETE ?id=<channelId>                      → 채널 삭제 (생성자만)
 *
 * 메시지:
 *   GET  ?messages=1&channelId=<id>             → 최근 100개 메시지
 *   POST ?message=1&channelId=<id>              → 메시지 전송 { content, author, avatar }
 *   DELETE ?messageId=<id>                      → 내 메시지 삭제
 *   PATCH ?messageId=<id>&action=react          → 리액션 토글 { emoji, userId }
 *   PATCH ?messageId=<id>&action=pin            → 핀 토글
 */
import supabase from '../../api/_lib/supabase.js'
import { withCors, getUserId } from '../../api/_lib/cors.js'
import { getAuthUser } from '../../api/_lib/auth.js'

export default withCors(async (req, res) => {
  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })
  req.user = user
  const uid = getUserId(req)
  const { groupId, id, messages, message, channelId, messageId, action } = req.query

  // ── 채널 목록 ──────────────────────────────────────────────────────────
  if (req.method === 'GET' && groupId && !messages) {
    const { data, error } = await supabase
      .from('channels')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: true })
    if (error) return res.status(500).json({ error: error.message })
    return res.json(data || [])
  }

  // ── 채널 생성 ──────────────────────────────────────────────────────────
  if (req.method === 'POST' && groupId && !message) {
    const { name, description } = req.body || {}
    if (!name?.trim()) return res.status(400).json({ error: 'name required' })
    const { data, error } = await supabase
      .from('channels')
      .insert({
        group_id:    groupId,
        name:        name.trim(),
        description: description?.trim() || '',
        created_by:  uid,
      })
      .select()
      .single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(201).json(data)
  }

  // ── 채널 삭제 (생성자만) ───────────────────────────────────────────────
  if (req.method === 'DELETE' && id && !messageId) {
    const { data: ch, error: fe } = await supabase
      .from('channels')
      .select('created_by')
      .eq('id', id)
      .single()
    if (fe || !ch) return res.status(404).json({ error: '채널을 찾을 수 없어요' })
    if (ch.created_by !== uid) return res.status(403).json({ error: '생성자만 삭제할 수 있어요' })

    const { error } = await supabase.from('channels').delete().eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    return res.json({ success: true })
  }

  // ── 메시지 목록 (최근 100개) ───────────────────────────────────────────
  if (req.method === 'GET' && messages && channelId) {
    const { data, error } = await supabase
      .from('channel_messages')
      .select('*')
      .eq('channel_id', channelId)
      .order('created_at', { ascending: false })
      .limit(100)
    if (error) return res.status(500).json({ error: error.message })
    // 오래된 순으로 뒤집어서 반환
    return res.json((data || []).reverse())
  }

  // ── 메시지 전송 ────────────────────────────────────────────────────────
  if (req.method === 'POST' && message && channelId) {
    const { content, author, avatar } = req.body || {}
    if (!content?.trim()) return res.status(400).json({ error: 'content required' })
    const { data, error } = await supabase
      .from('channel_messages')
      .insert({
        channel_id: channelId,
        user_id:    uid,
        content:    content.trim(),
        author:     author || null,
        avatar:     avatar || null,
        reactions:  {},
        pinned:     false,
      })
      .select()
      .single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(201).json(data)
  }

  // ── 내 메시지 삭제 ─────────────────────────────────────────────────────
  if (req.method === 'DELETE' && messageId) {
    const { error } = await supabase
      .from('channel_messages')
      .delete()
      .eq('id', messageId)
      .eq('user_id', uid)
    if (error) return res.status(500).json({ error: error.message })
    return res.json({ success: true })
  }

  // ── 리액션 토글 ────────────────────────────────────────────────────────
  if (req.method === 'PATCH' && messageId && action === 'react') {
    const { emoji, userId } = req.body || {}
    if (!emoji) return res.status(400).json({ error: 'emoji required' })
    const reactorId = userId || uid

    const { data: msg, error: fe } = await supabase
      .from('channel_messages')
      .select('reactions')
      .eq('id', messageId)
      .single()
    if (fe || !msg) return res.status(404).json({ error: '메시지를 찾을 수 없어요' })

    const reactions = { ...(msg.reactions || {}) }
    const users = reactions[emoji] || []
    if (users.includes(reactorId)) {
      // 이미 반응함 → 제거
      const next = users.filter(u => u !== reactorId)
      if (next.length === 0) {
        delete reactions[emoji]
      } else {
        reactions[emoji] = next
      }
    } else {
      // 반응 추가
      reactions[emoji] = [...users, reactorId]
    }

    const { data, error } = await supabase
      .from('channel_messages')
      .update({ reactions })
      .eq('id', messageId)
      .select()
      .single()
    if (error) return res.status(500).json({ error: error.message })
    return res.json(data)
  }

  // ── 핀 토글 ────────────────────────────────────────────────────────────
  if (req.method === 'PATCH' && messageId && action === 'pin') {
    const { data: msg, error: fe } = await supabase
      .from('channel_messages')
      .select('pinned')
      .eq('id', messageId)
      .single()
    if (fe || !msg) return res.status(404).json({ error: '메시지를 찾을 수 없어요' })

    const { data, error } = await supabase
      .from('channel_messages')
      .update({ pinned: !msg.pinned })
      .eq('id', messageId)
      .select()
      .single()
    if (error) return res.status(500).json({ error: error.message })
    return res.json(data)
  }

  res.status(405).json({ error: 'Method not allowed' })
})
