/**
 * /api/events  ⭐ 행동 분석 핵심
 *
 * POST /api/events              → 이벤트 기록
 * GET  /api/events?days=7       → 최근 N일 이벤트
 * GET  /api/events?type=:type   → 타입별 조회
 */
import supabase from './_lib/supabase.js'
import { withCors, getUserId } from './_lib/cors.js'
import { getAuthUser } from './_lib/auth.js'

export default withCors(async (req, res) => {
  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })
  req.user = user
  const uid = getUserId(req)

  // ── POST: 이벤트 기록 ────────────────────────────────────
  if (req.method === 'POST') {
    const { type, taskId, metadata } = req.body
    if (!type) return res.status(400).json({ error: 'type required' })

    // task_id는 UUID 형식일 때만 저장 (로컬 id는 null 처리)
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    const safeTaskId = taskId && UUID_RE.test(taskId) ? taskId : null

    const now = new Date()
    const { data, error } = await supabase.from('events').insert({
      user_id:     uid,
      type,
      task_id:     safeTaskId,
      timestamp:   now.toISOString(),
      hour:        now.getHours(),
      day_of_week: now.getDay(),
      metadata:    metadata || {}
    }).select().single()

    if (error) return res.status(500).json({ error: error.message })
    return res.status(201).json(data)
  }

  // ── GET: 이벤트 조회 ────────────────────────────────────
  if (req.method === 'GET') {
    const { days = 30, type, limit = 500 } = req.query

    const since = new Date()
    since.setDate(since.getDate() - Number(days))

    let q = supabase.from('events')
      .select('*')
      .eq('user_id', uid)
      .gte('timestamp', since.toISOString())
      .order('timestamp', { ascending: false })
      .limit(Number(limit))

    if (type) q = q.eq('type', type)

    const { data, error } = await q
    if (error) return res.status(500).json({ error: error.message })

    // 시간대별 완료 집계 (프론트에서 바로 쓸 수 있게)
    const hourMap = Array(24).fill(0)
    const dayMap  = Array(7).fill(0)
    data.filter(e => e.type === 'completed').forEach(e => {
      if (e.hour != null)        hourMap[e.hour]++
      if (e.day_of_week != null) dayMap[e.day_of_week]++
    })

    return res.json({ events: data, hourMap, dayMap })
  }

  res.status(405).json({ error: 'Method not allowed' })
})
