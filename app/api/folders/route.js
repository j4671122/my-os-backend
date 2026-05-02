import supabase from '@/lib/supabase'
import { getAuthUser } from '@/lib/auth'

export async function GET(request) {
  const user = await getAuthUser(request)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('folders').select('*').eq('user_id', user.id).order('created_at')
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function POST(request) {
  const user = await getAuthUser(request)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, color } = await request.json()
  const { data, error } = await supabase.from('folders')
    .insert({ user_id: user.id, name, color: color || '#2c5f2e' }).select().single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data, { status: 201 })
}

export async function PUT(request) {
  const user = await getAuthUser(request)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const id = new URL(request.url).searchParams.get('id')
  if (!id) return Response.json({ error: 'id required' }, { status: 400 })

  const { name, color } = await request.json()
  const { data, error } = await supabase.from('folders')
    .update({ name, color }).eq('id', id).eq('user_id', user.id).select().single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function DELETE(request) {
  const user = await getAuthUser(request)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const id = new URL(request.url).searchParams.get('id')
  const q  = supabase.from('folders').delete().eq('user_id', user.id)
  const { error } = id ? await q.eq('id', id) : await q
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ success: true, deletedAll: !id })
}
