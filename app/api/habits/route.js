import supabase from '@/lib/supabase'
import { getAuthUser } from '@/lib/auth'

export async function GET(request) {
  const user = await getAuthUser(request)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('habits').select('*').eq('user_id', user.id)
    .order('sort_order', { ascending: true })
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function POST(request) {
  const user = await getAuthUser(request)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, sortOrder } = await request.json()
  if (!name) return Response.json({ error: 'name required' }, { status: 400 })

  const { data, error } = await supabase.from('habits').insert({
    user_id: user.id, name, sort_order: sortOrder || 0, checks: [], streak: 0,
  }).select().single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data, { status: 201 })
}

export async function PUT(request) {
  const user = await getAuthUser(request)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const id = new URL(request.url).searchParams.get('id')
  if (!id) return Response.json({ error: 'id required' }, { status: 400 })

  const { name, sortOrder, checks, streak } = await request.json()
  const update = {}
  if (name      !== undefined) update.name       = name
  if (sortOrder !== undefined) update.sort_order = sortOrder
  if (checks    !== undefined) update.checks     = checks
  if (streak    !== undefined) update.streak     = streak

  const { data, error } = await supabase.from('habits')
    .update(update).eq('id', id).eq('user_id', user.id).select().single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function PATCH(request) {
  const user = await getAuthUser(request)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const id = new URL(request.url).searchParams.get('id')
  if (!id) return Response.json({ error: 'id required' }, { status: 400 })

  const today = new Date().toISOString().slice(0, 10)
  const { data: h, error: fe } = await supabase.from('habits')
    .select('checks').eq('id', id).eq('user_id', user.id).single()
  if (fe) return Response.json({ error: fe.message }, { status: 404 })

  const checks    = h.checks || []
  const newChecks = checks.includes(today)
    ? checks.filter(d => d !== today)
    : [...checks, today]

  let streak = 0
  const d = new Date(); d.setHours(0, 0, 0, 0)
  while (true) {
    const ds = d.toISOString().slice(0, 10)
    if (!newChecks.includes(ds)) break
    streak++
    d.setDate(d.getDate() - 1)
  }

  const { data, error } = await supabase.from('habits')
    .update({ checks: newChecks, streak })
    .eq('id', id).eq('user_id', user.id).select().single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function DELETE(request) {
  const user = await getAuthUser(request)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const id = new URL(request.url).searchParams.get('id')
  const q  = supabase.from('habits').delete().eq('user_id', user.id)
  const { error } = id ? await q.eq('id', id) : await q
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ success: true, deletedAll: !id })
}
