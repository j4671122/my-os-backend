/**
 * /api/tasks
 *
 * GET    /api/tasks              → 전체 할일 목록 (subtasks, links 포함)
 * POST   /api/tasks              → 할일 생성
 * PUT    /api/tasks?id=:id       → 할일 수정
 * DELETE /api/tasks?id=:id       → 할일 삭제
 */

import supabase from './_lib/supabase.js'
import { withCors, getUserId } from './_lib/cors.js'
import { getAuthUser } from './_lib/auth.js'

export default withCors(async (req, res) => {
  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })
  req.user = user
  const uid   = getUserId(req)
  const { id } = req.query

  // ── GET ──────────────────────────────────────────────────
  if (req.method === 'GET') {
    // 단건
    if (id) {
      const { data, error } = await supabase
        .from('tasks')
        .select('*, subtasks(*), task_links(*)')
        .eq('id', id)
        .eq('user_id', uid)
        .single()
      if (error) return res.status(404).json({ error: error.message })
      return res.json(data)
    }

    // 전체
    const { data, error } = await supabase
      .from('tasks')
      .select('*, subtasks(id,text,done,sort_order), task_links(id,url,label)')
      .eq('user_id', uid)
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })

    if (error) return res.status(500).json({ error: error.message })
    return res.json(data)
  }

  // ── POST (생성) ──────────────────────────────────────────
  if (req.method === 'POST') {
    const body  = req.body
    const now   = new Date()

    const { data: task, error } = await supabase
      .from('tasks')
      .insert({
        user_id:          uid,
        title:            body.title,
        done:             false,
        priority:         body.priority   || 'med',
        folder_id:        body.folderId   || null,
        goal_id:          body.goalId     || null,
        due_date:         body.dueDate    || null,
        session_url:      body.sessionUrl || null,
        notes:            body.notes      || null,
        tags:             body.tags       || [],
        is_recurring:     body.isRecurring || false,
        sort_order:       body.sortOrder  || null,
        attempt_count:    0,
        delay_days:       0,
        ai_tagged:        false
      })
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })

    // 이벤트 기록
    await logEvent(uid, 'created', task.id, {
      priority: task.priority,
      tags:     task.tags
    }, now)

    return res.status(201).json(task)
  }

  // ── PUT (수정) ───────────────────────────────────────────
  if (req.method === 'PUT') {
    if (!id) return res.status(400).json({ error: 'id required' })

    const body = req.body
    const now  = new Date()

    // 기존 상태 조회 (완료 전환 감지용)
    const { data: prev } = await supabase
      .from('tasks')
      .select('done, due_date, delay_days, attempt_count')
      .eq('id', id)
      .eq('user_id', uid)
      .single()

    // 마감 연장 감지
    let extraUpdate = {}
    if (body.dueDate && prev?.due_date && body.dueDate > prev.due_date) {
      extraUpdate.delay_days = (prev.delay_days || 0) + 1
    }
    // 완료 해제 감지 (재시도)
    if (body.done === false && prev?.done === true) {
      extraUpdate.attempt_count = (prev.attempt_count || 0) + 1
    }

    const updatePayload = {}
    const allowed = ['title','done','priority','folder_id','goal_id','due_date',
                     'session_url','notes','tags','is_recurring','sort_order',
                     'completed_at','completion_hour','ai_tagged']

    // camelCase → snake_case 매핑
    const fieldMap = {
      folderId:      'folder_id',
      goalId:        'goal_id',
      dueDate:       'due_date',
      sessionUrl:    'session_url',
      isRecurring:   'is_recurring',
      sortOrder:     'sort_order',
      completedAt:   'completed_at',
      completionHour:'completion_hour',
      aiTagged:      'ai_tagged'
    }

    for (const [k, v] of Object.entries(body)) {
      const col = fieldMap[k] || k
      if (allowed.includes(col)) updatePayload[col] = v
    }
    Object.assign(updatePayload, extraUpdate)

    const { data: updated, error } = await supabase
      .from('tasks')
      .update(updatePayload)
      .eq('id', id)
      .eq('user_id', uid)
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })

    // 완료 이벤트
    if (body.done === true && prev?.done === false) {
      await logEvent(uid, 'completed', id, {
        priority:       updated.priority,
        tags:           updated.tags,
        delay_days:     updated.delay_days,
        attempt_count:  updated.attempt_count,
        completion_hour: new Date().getHours()
      }, now)
    } else if (body.done === false && prev?.done === true) {
      await logEvent(uid, 'uncompleted', id, {}, now)
    }

    return res.json(updated)
  }

  // ── DELETE ───────────────────────────────────────────────
  if (req.method === 'DELETE') {
    if (!id) return res.status(400).json({ error: 'id required' })
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id)
      .eq('user_id', uid)
    if (error) return res.status(500).json({ error: error.message })
    await logEvent(uid, 'deleted', id, {}, new Date())
    return res.json({ success: true })
  }

  res.status(405).json({ error: 'Method not allowed' })
})

async function logEvent(userId, type, taskId, metadata, ts = new Date()) {
  await supabase.from('events').insert({
    user_id:     userId,
    type,
    task_id:     taskId,
    timestamp:   ts.toISOString(),
    hour:        ts.getHours(),
    day_of_week: ts.getDay(),
    metadata:    metadata || {}
  })
}
