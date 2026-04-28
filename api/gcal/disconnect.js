/**
 * DELETE /api/gcal/disconnect
 * Google Calendar 연동 해제 — DB에서 토큰 삭제
 */
import supabase from '../_lib/supabase.js'
import { withCors } from '../_lib/cors.js'
import { getAuthUser } from '../_lib/auth.js'

export default withCors(async (req, res) => {
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' })

  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const { error } = await supabase
    .from('profiles')
    .update({ gcal_tokens: null })
    .eq('id', user.id)

  if (error) return res.status(500).json({ error: error.message })
  return res.json({ ok: true })
})
