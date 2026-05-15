/**
 * /api/community
 * GET              → 최신 50개 게시글 (전체 유저 피드)
 * POST             → 게시글 작성
 * PATCH?id=&action=like      → 좋아요 토글
 * PATCH?id=&action=comment   → 댓글 추가
 * PATCH?id=&action=uncomment → 댓글 삭제
 * DELETE?id=       → 게시글 삭제 (자기 것만)
 */
import supabase from './_lib/supabase.js'
import { withCors, getUserId } from './_lib/cors.js'
import { getAuthUser } from './_lib/auth.js'
import channelsHandler from '../server/community-routes/channels.js'
import dmHandler from '../server/community-routes/dm.js'
import groupProfilesHandler from '../server/community-routes/group-profiles.js'
import groupsHandler from '../server/community-routes/groups.js'
import resourcesHandler from '../server/community-routes/resources.js'

function mapPost(p, uid) {
  return {
    ...p,
    liked: (p.liked_by || []).includes(uid),
    isOwn: p.user_id === uid,
    showComments: false,
    comments: (p.comments || []).map(c => ({ ...c, isOwn: c.user_id === uid })),
  }
}

export default withCors(async (req, res) => {
  const { module } = req.query
  if (module === 'channels') return channelsHandler(req, res)
  if (module === 'dm') return dmHandler(req, res)
  if (module === 'group-profiles') return groupProfilesHandler(req, res)
  if (module === 'groups') return groupsHandler(req, res)
  if (module === 'resources') return resourcesHandler(req, res)

  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })
  req.user = user
  const uid = getUserId(req)
  const { id, action } = req.query

  // GET: 최신 50개 (optional ?group=<group_id> filter)
  if (req.method === 'GET') {
    const { group } = req.query
    let query = supabase
      .from('community_posts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
    if (group) {
      query = query.eq('group_id', group)
    }
    const { data, error } = await query
    if (error) return res.status(500).json({ error: error.message })

    // If group feed, enrich with group profiles
    let gpMap = {}
    if (group) {
      const { data: gps } = await supabase
        .from('group_profiles')
        .select('user_id, nickname, avatar, avatar_bg, avatar_img, show_title, show_avatar')
        .eq('group_id', group)
      for (const gp of gps || []) gpMap[gp.user_id] = gp
    }

    if (group) {
      return res.json(data.map(p => {
        const gp = gpMap[p.user_id]
        return {
          ...mapPost(p, uid),
          group_nickname:   gp?.nickname   || null,
          group_avatar:     gp?.avatar     || null,
          group_avatar_bg:  gp?.avatar_bg  ?? null,
          group_avatar_img: gp?.avatar_img || null,
          show_title:       gp ? gp.show_title  : true,
          show_avatar:      gp ? gp.show_avatar : true,
        }
      }))
    }

    return res.json(data.map(p => mapPost(p, uid)))
  }

  // POST: 게시글 작성
  if (req.method === 'POST') {
    const { content, author, handle, avatar, avatarBg, avatarImg, groupId, postType } = req.body || {}
    if (!content?.trim()) return res.status(400).json({ error: 'content required' })
    const { data, error } = await supabase.from('community_posts').insert({
      user_id:    uid,
      author:     author    || '익명',
      handle:     handle    || '',
      avatar:     avatar    || '😊',
      avatar_bg:  avatarBg  || 0,
      avatar_img: avatarImg || '',
      content:    content.trim(),
      likes:      0,
      liked_by:   [],
      comments:   [],
      group_id:   groupId   || null,
      post_type:  postType  || 'general',
    }).select().single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(201).json(mapPost(data, uid))
  }

  // PATCH: 좋아요 토글
  if (req.method === 'PATCH' && action === 'like') {
    if (!id) return res.status(400).json({ error: 'id required' })
    const { data: post, error: fe } = await supabase
      .from('community_posts').select('liked_by,likes').eq('id', id).single()
    if (fe) return res.status(404).json({ error: fe.message })
    const likedBy = post.liked_by || []
    const already = likedBy.includes(uid)
    const newLikedBy = already ? likedBy.filter(u => u !== uid) : [...likedBy, uid]
    const { data, error } = await supabase.from('community_posts')
      .update({ liked_by: newLikedBy, likes: Math.max(0, (post.likes || 0) + (already ? -1 : 1)) })
      .eq('id', id).select().single()
    if (error) return res.status(500).json({ error: error.message })
    return res.json(mapPost(data, uid))
  }

  // PATCH: 댓글 추가
  if (req.method === 'PATCH' && action === 'comment') {
    if (!id) return res.status(400).json({ error: 'id required' })
    const { content, author, avatar, avatarBg, avatarImg } = req.body || {}
    if (!content?.trim()) return res.status(400).json({ error: 'content required' })
    const { data: post, error: fe } = await supabase
      .from('community_posts').select('comments').eq('id', id).single()
    if (fe) return res.status(404).json({ error: fe.message })
    const comments = [...(post.comments || []), {
      id:         Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      user_id:    uid,
      author:     author    || '익명',
      avatar:     avatar    || '😊',
      avatar_bg:  avatarBg  || 0,
      avatar_img: avatarImg || '',
      content:    content.trim(),
      created_at: new Date().toISOString(),
    }]
    const { data, error } = await supabase.from('community_posts')
      .update({ comments }).eq('id', id).select().single()
    if (error) return res.status(500).json({ error: error.message })
    return res.json(mapPost(data, uid))
  }

  // PATCH: 댓글 삭제 (자기 것만)
  if (req.method === 'PATCH' && action === 'uncomment') {
    if (!id) return res.status(400).json({ error: 'id required' })
    const { commentId } = req.body || {}
    const { data: post, error: fe } = await supabase
      .from('community_posts').select('comments').eq('id', id).single()
    if (fe) return res.status(404).json({ error: fe.message })
    const comments = (post.comments || []).filter(c => !(c.id === commentId && c.user_id === uid))
    const { data, error } = await supabase.from('community_posts')
      .update({ comments }).eq('id', id).select().single()
    if (error) return res.status(500).json({ error: error.message })
    return res.json(mapPost(data, uid))
  }

  // PATCH: 리액션 토글
  if (req.method === 'PATCH' && action === 'react') {
    if (!id) return res.status(400).json({ error: 'id required' })
    const { emoji, userId } = req.body || {}
    if (!emoji) return res.status(400).json({ error: 'emoji required' })
    const reactorId = userId || uid

    const { data: post, error: fe } = await supabase
      .from('community_posts').select('reactions').eq('id', id).single()
    if (fe) return res.status(404).json({ error: fe.message })

    const reactions = { ...(post.reactions || {}) }
    const users = reactions[emoji] || []
    if (users.includes(reactorId)) {
      const next = users.filter(u => u !== reactorId)
      if (next.length === 0) {
        delete reactions[emoji]
      } else {
        reactions[emoji] = next
      }
    } else {
      reactions[emoji] = [...users, reactorId]
    }

    const { data, error } = await supabase.from('community_posts')
      .update({ reactions }).eq('id', id).select().single()
    if (error) return res.status(500).json({ error: error.message })
    return res.json(mapPost(data, uid))
  }

  // PATCH: 핀 토글
  if (req.method === 'PATCH' && action === 'pin') {
    if (!id) return res.status(400).json({ error: 'id required' })
    const { data: post, error: fe } = await supabase
      .from('community_posts').select('pinned').eq('id', id).single()
    if (fe) return res.status(404).json({ error: fe.message })

    const { data, error } = await supabase.from('community_posts')
      .update({ pinned: !post.pinned }).eq('id', id).select().single()
    if (error) return res.status(500).json({ error: error.message })
    return res.json(mapPost(data, uid))
  }

  // DELETE: 게시글 삭제
  if (req.method === 'DELETE') {
    if (!id) return res.status(400).json({ error: 'id required' })
    const { error } = await supabase.from('community_posts')
      .delete().eq('id', id).eq('user_id', uid)
    if (error) return res.status(500).json({ error: error.message })
    return res.json({ success: true })
  }

  res.status(405).json({ error: 'Method not allowed' })
})
