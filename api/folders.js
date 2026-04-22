/**
 * /api/folders
 * GET / POST / PUT?id= / DELETE?id=
 */
import supabase from './_lib/supabase.js'
import { withCors, getUserId } from './_lib/cors.js'
import { getAuthUser } from './_lib/auth.js'

export default withCors(async (req, res) => {
  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })
  req.user = user
  const uid    = getUserId(req)
  const { id } = req.query

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('folders').select('*').eq('user_id', uid).order('created_at')
    if (error) return res.status(500).json({ error: error.message })
    return res.json(data)
  }

  if (req.method === 'POST') {
    const { name, color } = req.body
    const { data, error } = await supabase.from('folders')
      .insert({ user_id: uid, name, color: color || '#2c5f2e' }).select().single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(201).json(data)
  }

  if (req.method === 'PUT') {
    if (!id) return res.status(400).json({ error: 'id required' })
    const { name, color } = req.body
    const { data, error } = await supabase.from('folders')
      .update({ name, color }).eq('id', id).eq('user_id', uid).select().single()
    if (error) return res.status(500).json({ error: error.message })
    return res.json(data)
  }

  if (req.method === 'DELETE') {
    const q = supabase.from('folders').delete().eq('user_id', uid)
    const { error } = id ? await q.eq('id', id) : await q
    if (error) return res.status(500).json({ error: error.message })
    return res.json({ success: true, deletedAll: !id })
  }

  res.status(405).json({ error: 'Method not allowed' })
})
