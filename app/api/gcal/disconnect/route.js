import supabase from '@/lib/supabase'
import { getAuthUser } from '@/lib/auth'

export async function DELETE(request) {
  const user = await getAuthUser(request)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase.from('profiles')
    .update({ gcal_tokens: null }).eq('id', user.id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
