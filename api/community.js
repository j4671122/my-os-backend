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
  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })
  req.user = user
  const uid = getUserId(req)
  const { id, action } = req.query

  // GET: 최신 50개
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('community_posts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) return res.status(500).json({ error: error.message })
    return res.json(data.map(p => mapPost(p, uid)))
  }

  // POST: 게시글 작성
  if (req.method === 'POST') {
    const { content, author, handle, avatar, avatarBg, avatarImg } = req.body || {}
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
