import supabase from '@/lib/supabase'
import { getAuthUser } from '@/lib/auth'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(request) {
  const user = await getAuthUser(request)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { type, taskId, metadata } = await request.json()
  if (!type) return Response.json({ error: 'type required' }, { status: 400 })

  const safeTaskId = taskId && UUID_RE.test(taskId) ? taskId : null
  const now = new Date()

  const { data, error } = await supabase.from('events').insert({
    user_id:     user.id,
    type,
    task_id:     safeTaskId,
    timestamp:   now.toISOString(),
    hour:        now.getHours(),
    day_of_week: now.getDay(),
    metadata:    metadata || {},
  }).select().single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data, { status: 201 })
}

export async function GET(request) {
  const user = await getAuthUser(request)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const days  = Number(searchParams.get('days')  || 30)
  const type  = searchParams.get('type')
  const limit = Number(searchParams.get('limit') || 500)

  const since = new Date()
  since.setDate(since.getDate() - days)

  let q = supabase.from('events')
    .select('*')
    .eq('user_id', user.id)
    .gte('timestamp', since.toISOString())
    .order('timestamp', { ascending: false })
    .limit(limit)

  if (type) q = q.eq('type', type)

  const { data, error } = await q
  if (error) return Response.json({ error: error.message }, { status: 500 })

  const hourMap = Array(24).fill(0)
  const dayMap  = Array(7).fill(0)
  data.filter(e => e.type === 'completed').forEach(e => {
    if (e.hour        != null) hourMap[e.hour]++
    if (e.day_of_week != null) dayMap[e.day_of_week]++
  })

  return Response.json({ events: data, hourMap, dayMap })
}

export async function DELETE(request) {
  const user = await getAuthUser(request)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase.from('events').delete().eq('user_id', user.id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ success: true, deletedAll: true })
}
