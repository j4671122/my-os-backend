import supabase from '@/lib/supabase'
import { getAuthUser } from '@/lib/auth'

function mapPost(p, uid) {
  return {
    ...p,
    liked:        (p.liked_by || []).includes(uid),
    isOwn:        p.user_id === uid,
    showComments: false,
    comments:     (p.comments || []).map(c => ({ ...c, isOwn: c.user_id === uid })),
  }
}

export async function GET(request) {
  const user = await getAuthUser(request)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('community_posts').select('*')
    .order('created_at', { ascending: false }).limit(50)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data.map(p => mapPost(p, user.id)))
}

export async function POST(request) {
  const user = await getAuthUser(request)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { content, author, handle, avatar, avatarBg, avatarImg } = await request.json()
  if (!content?.trim()) return Response.json({ error: 'content required' }, { status: 400 })

  const { data, error } = await supabase.from('community_posts').insert({
    user_id:    user.id,
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
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(mapPost(data, user.id), { status: 201 })
}

export async function PATCH(request) {
  const user = await getAuthUser(request)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const id     = searchParams.get('id')
  const action = searchParams.get('action')
  if (!id) return Response.json({ error: 'id required' }, { status: 400 })

  // 좋아요 토글
  if (action === 'like') {
    const { data: post, error: fe } = await supabase
      .from('community_posts').select('liked_by,likes').eq('id', id).single()
    if (fe) return Response.json({ error: fe.message }, { status: 404 })

    const likedBy  = post.liked_by || []
    const already  = likedBy.includes(user.id)
    const newLikedBy = already ? likedBy.filter(u => u !== user.id) : [...likedBy, user.id]

    const { data, error } = await supabase.from('community_posts')
      .update({ liked_by: newLikedBy, likes: Math.max(0, (post.likes || 0) + (already ? -1 : 1)) })
      .eq('id', id).select().single()
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json(mapPost(data, user.id))
  }

  // 댓글 추가
  if (action === 'comment') {
    const { content, author, avatar, avatarBg, avatarImg } = await request.json()
    if (!content?.trim()) return Response.json({ error: 'content required' }, { status: 400 })

    const { data: post, error: fe } = await supabase
      .from('community_posts').select('comments').eq('id', id).single()
    if (fe) return Response.json({ error: fe.message }, { status: 404 })

    const comments = [...(post.comments || []), {
      id:         Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      user_id:    user.id,
      author:     author    || '익명',
      avatar:     avatar    || '😊',
      avatar_bg:  avatarBg  || 0,
      avatar_img: avatarImg || '',
      content:    content.trim(),
      created_at: new Date().toISOString(),
    }]
    const { data, error } = await supabase.from('community_posts')
      .update({ comments }).eq('id', id).select().single()
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json(mapPost(data, user.id))
  }

  // 댓글 삭제 (자기 것만)
  if (action === 'uncomment') {
    const { commentId } = await request.json()
    const { data: post, error: fe } = await supabase
      .from('community_posts').select('comments').eq('id', id).single()
    if (fe) return Response.json({ error: fe.message }, { status: 404 })

    const comments = (post.comments || []).filter(
      c => !(c.id === commentId && c.user_id === user.id)
    )
    const { data, error } = await supabase.from('community_posts')
      .update({ comments }).eq('id', id).select().single()
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json(mapPost(data, user.id))
  }

  return Response.json({ error: 'unknown action' }, { status: 400 })
}

export async function DELETE(request) {
  const user = await getAuthUser(request)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const id = new URL(request.url).searchParams.get('id')
  if (!id) return Response.json({ error: 'id required' }, { status: 400 })

  const { error } = await supabase.from('community_posts')
    .delete().eq('id', id).eq('user_id', user.id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ success: true })
}
