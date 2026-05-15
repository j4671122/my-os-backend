/**
 * /api/group-profiles
 *
 * GET  ?groupId=<id>              → my group profile for that group (single row)
 * GET  ?groupId=<id>&all=1        → all members' group profiles in that group (array)
 * GET  ?groupId=<id>&userId=<uid> → specific user's group profile in that group
 * PUT  ?groupId=<id>              → upsert my group profile
 * DELETE ?groupId=<id>            → delete my group profile (revert to default)
 */
import supabase from '../../api/_lib/supabase.js'
import { withCors, getUserId } from '../../api/_lib/cors.js'
import { getAuthUser } from '../../api/_lib/auth.js'

export default withCors(async (req, res) => {
  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })
  req.user = user
  const uid = getUserId(req)

  const { groupId, all, userId } = req.query
  if (!groupId) return res.status(400).json({ error: 'groupId required' })

  // ── GET ────────────────────────────────────────────────────
  if (req.method === 'GET') {
    // All members' group profiles in that group
    if (all === '1') {
      const { data, error } = await supabase
        .from('group_profiles')
        .select('*')
        .eq('group_id', groupId)
      if (error) return res.status(500).json({ error: error.message })
      return res.json(data || [])
    }

    // Specific user's group profile
    if (userId) {
      const { data, error } = await supabase
        .from('group_profiles')
        .select('*')
        .eq('group_id', groupId)
        .eq('user_id', userId)
        .maybeSingle()
      if (error) return res.status(500).json({ error: error.message })
      return res.json(data)
    }

    // My group profile
    const { data, error } = await supabase
      .from('group_profiles')
      .select('*')
      .eq('group_id', groupId)
      .eq('user_id', uid)
      .maybeSingle()
    if (error) return res.status(500).json({ error: error.message })
    return res.json(data)
  }

  // ── PUT (upsert) ───────────────────────────────────────────
  if (req.method === 'PUT') {
    const body = req.body || {}
    const { data, error } = await supabase.from('group_profiles').upsert({
      user_id:      uid,
      group_id:     groupId,
      nickname:     body.nickname    || null,
      avatar:       body.avatar      || null,
      avatar_bg:    body.avatarBg    ?? 0,
      avatar_img:   body.avatarImg   || null,
      bio:          body.bio         || null,
      show_title:   body.showTitle   ?? true,
      show_avatar:  body.showAvatar  ?? true,
      preset_id:    body.presetId    || null,
      updated_at:   new Date().toISOString(),
    }, { onConflict: 'user_id,group_id' })
    if (error) return res.status(500).json({ error: error.message })
    return res.json(data)
  }

  // ── DELETE ─────────────────────────────────────────────────
  if (req.method === 'DELETE') {
    const { error } = await supabase
      .from('group_profiles')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', uid)
    if (error) return res.status(500).json({ error: error.message })
    return res.json({ ok: true })
  }

  res.status(405).json({ error: 'Method not allowed' })
})
