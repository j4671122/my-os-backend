import supabase from '@/lib/supabase'
import { getAuthUser } from '@/lib/auth'

export async function GET(request) {
  const user = await getAuthUser(request)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const id = new URL(request.url).searchParams.get('id')
  const q  = supabase.from('goals').select('*').eq('user_id', user.id)
  const { data, error } = id
    ? await q.eq('id', id).single()
    : await q.order('created_at', { ascending: false })
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function POST(request) {
  const user = await getAuthUser(request)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const b = await request.json()
  const { data, error } = await supabase.from('goals').insert({
    user_id:       user.id,
    name:          b.name,
    type:          b.type          || 'project',
    description:   b.desc          || b.description  || null,
    target_date:   b.targetDate    || null,
    target_metric: b.targetMetric  || null,
    period:        b.period        || null,
    color:         b.color         || '#2c5f2e',
  }).select().single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data, { status: 201 })
}

export async function PUT(request) {
  const user = await getAuthUser(request)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const id = new URL(request.url).searchParams.get('id')
  if (!id) return Response.json({ error: 'id required' }, { status: 400 })

  const b = await request.json()
  const { data, error } = await supabase.from('goals').update({
    name:          b.name,
    type:          b.type,
    description:   b.desc          || b.description,
    target_date:   b.targetDate,
    target_metric: b.targetMetric,
    period:        b.period,
    color:         b.color,
  }).eq('id', id).eq('user_id', user.id).select().single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function DELETE(request) {
  const user = await getAuthUser(request)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const id = new URL(request.url).searchParams.get('id')
  const q  = supabase.from('goals').delete().eq('user_id', user.id)
  const { error } = id ? await q.eq('id', id) : await q
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ success: true, deletedAll: !id })
}
