/**
 * /api/habits
 * GET / POST / PUT?id= / DELETE?id=
 * PATCH?id= → toggle check for today
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

  // GET 전체 목록
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('habits')
      .select('*')
      .eq('user_id', uid)
      .order('sort_order', { ascending: true })
    if (error) return res.status(500).json({ error: error.message })
    return res.json(data)
  }

  // POST 생성
  if (req.method === 'POST') {
    const { name, sortOrder } = req.body || {}
    if (!name) return res.status(400).json({ error: 'name required' })
    const { data, error } = await supabase.from('habits').insert({
      user_id: uid, name, sort_order: sortOrder || 0, checks: [], streak: 0
    }).select().single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(201).json(data)
  }

  // PUT 수정 (이름, 정렬순서, checks 배열)
  if (req.method === 'PUT') {
    if (!id) return res.status(400).json({ error: 'id required' })
    const { name, sortOrder, checks, streak } = req.body || {}
    const update = {}
    if (name       !== undefined) update.name       = name
    if (sortOrder  !== undefined) update.sort_order = sortOrder
    if (checks     !== undefined) update.checks     = checks
    if (streak     !== undefined) update.streak     = streak
    const { data, error } = await supabase.from('habits')
      .update(update).eq('id', id).eq('user_id', uid).select().single()
    if (error) return res.status(500).json({ error: error.message })
    return res.json(data)
  }

  // PATCH — 오늘 날짜 토글 (체크/언체크)
  if (req.method === 'PATCH') {
    if (!id) return res.status(400).json({ error: 'id required' })
    const today = new Date().toISOString().slice(0, 10)
    const { data: h, error: fe } = await supabase.from('habits')
      .select('checks').eq('id', id).eq('user_id', uid).single()
    if (fe) return res.status(404).json({ error: fe.message })

    const checks = h.checks || []
    const newChecks = checks.includes(today)
      ? checks.filter(d => d !== today)
      : [...checks, today]

    // 연속 스트릭 계산
    let streak = 0
    const d = new Date(); d.setHours(0,0,0,0)
    while (true) {
      const ds = d.toISOString().slice(0,10)
      if (!newChecks.includes(ds)) break
      streak++
      d.setDate(d.getDate() - 1)
    }

    const { data, error } = await supabase.from('habits')
      .update({ checks: newChecks, streak })
      .eq('id', id).eq('user_id', uid).select().single()
    if (error) return res.status(500).json({ error: error.message })
    return res.json(data)
  }

  // DELETE
  if (req.method === 'DELETE') {
    if (!id) return res.status(400).json({ error: 'id required' })
    const { error } = await supabase.from('habits')
      .delete().eq('id', id).eq('user_id', uid)
    if (error) return res.status(500).json({ error: error.message })
    return res.json({ success: true })
  }

  res.status(405).json({ error: 'Method not allowed' })
})
