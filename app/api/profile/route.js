import supabase from '@/lib/supabase'
import { getAuthUser } from '@/lib/auth'

const TAG_RE = /^[a-z0-9_]{3,20}$/
const ALLOWED_PROFILE_FIELDS = ['display_name','avatar','avatar_img','bio','ai_personality','lang','preferences','user_tag']

async function buildProfileUpdates(request, user, { mergePreferences = false } = {}) {
  const body = await request.json()
  const updates = {}

  for (const k of ALLOWED_PROFILE_FIELDS) {
    if (body[k] !== undefined) updates[k] = body[k]
  }

  if (updates.user_tag !== undefined) {
    const tag = String(updates.user_tag || '').replace(/^@/, '').toLowerCase().trim()
    if (!tag || !TAG_RE.test(tag)) {
      return { error: Response.json({ error: '유저 태그: 영문 소문자, 숫자, _ 만 사용 (3~20자)' }, { status: 400 }) }
    }
    const { data: existing } = await supabase
      .from('profiles').select('id').eq('user_tag', tag).neq('id', user.id).maybeSingle()
    if (existing) {
      return { error: Response.json({ error: '이미 사용 중인 태그입니다' }, { status: 409 }) }
    }
    updates.user_tag = tag
  }

  if (mergePreferences && body.preferences && typeof body.preferences === 'object' && !Array.isArray(body.preferences)) {
    const { data: current, error } = await supabase
      .from('profiles').select('preferences').eq('id', user.id).maybeSingle()
    if (error) return { error: Response.json({ error: error.message }, { status: 500 }) }
    updates.preferences = { ...(current?.preferences || {}), ...body.preferences }
  }

  if (body.avatar !== undefined) updates.avatar = body.avatar
  if (body.avatar_img !== undefined) updates.avatar_img = body.avatar_img
  if (body.ai_personality !== undefined) updates.ai_personality = body.ai_personality
  if (body.lang !== undefined) updates.lang = body.lang

  if (!Object.keys(updates).length) {
    return { error: Response.json({ error: '수정할 항목 없음' }, { status: 400 }) }
  }

  return { updates }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const check = searchParams.get('check')

  if (check) {
    const tag = check.replace(/^@/, '').toLowerCase().trim()
    if (!tag)          return Response.json({ available: false, error: '태그를 입력해주세요' })
    if (!TAG_RE.test(tag)) return Response.json({ available: false, error: '영문 소문자, 숫자, _ 만 사용 (3~20자)' })
    const currentUser = await getAuthUser(request)
    let query = supabase.from('profiles').select('id').eq('user_tag', tag)
    if (currentUser?.id) query = query.neq('id', currentUser.id)
    const { data, error } = await query.maybeSingle()
    if (error) return Response.json({ available: false, error: error.message }, { status: 500 })
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

  const { updates, error: buildError } = await buildProfileUpdates(request, user)
  if (buildError) return buildError

  const { data, error } = await supabase
    .from('profiles').update(updates).eq('id', user.id).select().single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function PATCH(request) {
  const user = await getAuthUser(request)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { updates, error: buildError } = await buildProfileUpdates(request, user, { mergePreferences: true })
  if (buildError) return buildError

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
