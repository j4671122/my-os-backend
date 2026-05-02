import supabase from '@/lib/supabase'
import { getAuthUser } from '@/lib/auth'

const TAG_RE = /^[a-z0-9_]{3,20}$/

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const check = searchParams.get('check')

  if (check) {
    const tag = check.replace(/^@/, '').toLowerCase().trim()
    if (!tag)          return Response.json({ available: false, error: '태그를 입력해주세요' })
    if (!TAG_RE.test(tag)) return Response.json({ available: false, error: '영문 소문자, 숫자, _ 만 사용 (3~20자)' })
    const { data } = await supabase.from('profiles').select('id').eq('user_tag', tag).maybeSingle()
    return Response.json({ available: !data })
  }

  const user = await getAuthUser(request)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('profiles').select('*').eq('id', user.id).maybeSingle()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function POST(request) {
  const user = await getAuthUser(request)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { user_tag, display_name, avatar, avatar_img, bio } = await request.json()

  const tag = (user_tag || '').replace(/^@/, '').toLowerCase().trim()
  if (!tag || !TAG_RE.test(tag))
    return Response.json({ error: '유저 태그: 영문 소문자, 숫자, _ 만 사용 (3~20자)' }, { status: 400 })

  const { data: existing } = await supabase
    .from('profiles').select('id').eq('user_tag', tag).maybeSingle()
  if (existing) return Response.json({ error: '이미 사용 중인 태그입니다' }, { status: 409 })

  const { data, error } = await supabase.from('profiles').insert({
    id:           user.id,
    user_tag:     tag,
    display_name: display_name || user.email?.split('@')[0] || tag,
    avatar:       avatar     || '😊',
    avatar_img:   avatar_img || null,
    bio:          bio        || null,
    permission:   'user',
  }).select().single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data, { status: 201 })
}

export async function PUT(request) {
  const user = await getAuthUser(request)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const allowed = ['display_name','avatar','avatar_img','bio','ai_personality','lang','preferences','user_tag']
  const updates = {}
  for (const k of allowed) {
    if (body[k] !== undefined) updates[k] = body[k]
  }
  if (!Object.keys(updates).length)
    return Response.json({ error: '수정할 항목 없음' }, { status: 400 })

  if (updates.user_tag !== undefined) {
    const tag = String(updates.user_tag || '').replace(/^@/, '').toLowerCase().trim()
    if (!tag || !TAG_RE.test(tag))
      return Response.json({ error: '유저 태그: 영문 소문자, 숫자, _ 만 사용 (3~20자)' }, { status: 400 })
    const { data: existing } = await supabase
      .from('profiles').select('id').eq('user_tag', tag).neq('id', user.id).maybeSingle()
    if (existing) return Response.json({ error: '이미 사용 중인 태그입니다' }, { status: 409 })
    updates.user_tag = tag
  }

  const { data, error } = await supabase
    .from('profiles').update(updates).eq('id', user.id).select().single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function DELETE(request) {
  const user = await getAuthUser(request)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  await Promise.all([
    supabase.from('tasks').delete().eq('user_id', user.id),
    supabase.from('goals').delete().eq('user_id', user.id),
    supabase.from('folders').delete().eq('user_id', user.id),
    supabase.from('events').delete().eq('user_id', user.id),
    supabase.from('tags').delete().eq('user_id', user.id),
    supabase.from('profiles').delete().eq('id', user.id),
  ])

  const { error } = await supabase.auth.admin.deleteUser(user.id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
