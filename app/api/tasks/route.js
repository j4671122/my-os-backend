import supabase from '@/lib/supabase'
import { getAuthUser } from '@/lib/auth'

async function logEvent(userId, type, taskId, metadata, ts = new Date()) {
  await supabase.from('events').insert({
    user_id: userId, type, task_id: taskId,
    timestamp: ts.toISOString(), hour: ts.getHours(),
    day_of_week: ts.getDay(), metadata: metadata || {}
  })
}

export async function GET(request) {
  const user = await getAuthUser(request)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const id = new URL(request.url).searchParams.get('id')

  if (id) {
    const { data, error } = await supabase
      .from('tasks')
      .select('*, subtasks(*), task_links(*)')
      .eq('id', id).eq('user_id', user.id).single()
    if (error) return Response.json({ error: error.message }, { status: 404 })
    return Response.json(data)
  }

  const { data, error } = await supabase
    .from('tasks')
    .select('*, subtasks(id,text,done,sort_order), task_links(id,url,label)')
    .eq('user_id', user.id)
    .order('sort_order', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function POST(request) {
  const user = await getAuthUser(request)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const now = new Date()

  const { data: task, error } = await supabase.from('tasks').insert({
    user_id:       user.id,
    title:         body.title,
    done:          false,
    priority:      body.priority    || 'med',
    folder_id:     body.folderId    || body.folder_id    || null,
    goal_id:       body.goalId      || body.goal_id      || null,
    due_date:      body.dueDate     || body.due_date      || null,
    session_url:   body.sessionUrl  || body.session_url  || null,
    notes:         body.notes       || null,
    tags:          body.tags        || [],
    is_recurring:  body.isRecurring || body.is_recurring  || false,
    sort_order:    body.sortOrder   || body.sort_order    || null,
    attempt_count: 0,
    delay_days:    0,
    ai_tagged:     false,
  }).select().single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  const subtasks = Array.isArray(body.subtasks) ? body.subtasks : []
  const links    = Array.isArray(body.links)    ? body.links    : []

  if (subtasks.length) {
    const { error: e } = await supabase.from('subtasks').insert(
      subtasks.map((s, i) => ({
        task_id: task.id, text: s.text, done: !!s.done,
        sort_order: s.sort_order ?? s.sortOrder ?? i,
      }))
    )
    if (e) return Response.json({ error: e.message }, { status: 500 })
  }

  if (links.length) {
    const { error: e } = await supabase.from('task_links').insert(
      links.map(l => ({ task_id: task.id, url: l.url, label: l.label || null }))
    )
    if (e) return Response.json({ error: e.message }, { status: 500 })
  }

  const { data: fullTask, error: fe } = await supabase
    .from('tasks')
    .select('*, subtasks(id,text,done,sort_order), task_links(id,url,label)')
    .eq('id', task.id).eq('user_id', user.id).single()
  if (fe) return Response.json({ error: fe.message }, { status: 500 })

  await logEvent(user.id, 'created', task.id, { priority: task.priority, tags: task.tags }, now)
  return Response.json(fullTask, { status: 201 })
}

export async function PUT(request) {
  const user = await getAuthUser(request)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const id = new URL(request.url).searchParams.get('id')
  if (!id) return Response.json({ error: 'id required' }, { status: 400 })

  const body = await request.json()
  const now  = new Date()

  const { data: prev } = await supabase
    .from('tasks').select('done,due_date,delay_days,attempt_count')
    .eq('id', id).eq('user_id', user.id).single()

  const extraUpdate = {}
  if (body.dueDate && prev?.due_date && body.dueDate > prev.due_date)
    extraUpdate.delay_days = (prev.delay_days || 0) + 1
  if (body.done === false && prev?.done === true)
    extraUpdate.attempt_count = (prev.attempt_count || 0) + 1

  const allowed  = ['title','done','priority','folder_id','goal_id','due_date',
                    'session_url','notes','tags','is_recurring','sort_order',
                    'completed_at','completion_hour','ai_tagged']
  const fieldMap = {
    folderId: 'folder_id', goalId: 'goal_id', dueDate: 'due_date',
    sessionUrl: 'session_url', isRecurring: 'is_recurring', sortOrder: 'sort_order',
    completedAt: 'completed_at', completionHour: 'completion_hour', aiTagged: 'ai_tagged',
  }

  const updatePayload = {}
  for (const [k, v] of Object.entries(body)) {
    const col = fieldMap[k] || k
    if (allowed.includes(col)) updatePayload[col] = v
  }
  Object.assign(updatePayload, extraUpdate)

  const { error } = await supabase
    .from('tasks').update(updatePayload)
    .eq('id', id).eq('user_id', user.id)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  if (Array.isArray(body.subtasks)) {
    await supabase.from('subtasks').delete().eq('task_id', id)
    if (body.subtasks.length) {
      const { error: e } = await supabase.from('subtasks').insert(
        body.subtasks.map((s, i) => ({
          task_id: id, text: s.text, done: !!s.done,
          sort_order: s.sort_order ?? s.sortOrder ?? i,
        }))
      )
      if (e) return Response.json({ error: e.message }, { status: 500 })
    }
  }

  const links = Array.isArray(body.links)       ? body.links
              : Array.isArray(body.task_links)   ? body.task_links
              : null
  if (Array.isArray(links)) {
    await supabase.from('task_links').delete().eq('task_id', id)
    if (links.length) {
      const { error: e } = await supabase.from('task_links').insert(
        links.map(l => ({ task_id: id, url: l.url, label: l.label || null }))
      )
      if (e) return Response.json({ error: e.message }, { status: 500 })
    }
  }

  const { data: fullUpdated, error: fe } = await supabase
    .from('tasks')
    .select('*, subtasks(id,text,done,sort_order), task_links(id,url,label)')
    .eq('id', id).eq('user_id', user.id).single()
  if (fe) return Response.json({ error: fe.message }, { status: 500 })

  if (body.done === true  && prev?.done === false)
    await logEvent(user.id, 'completed', id, {
      priority: fullUpdated.priority, tags: fullUpdated.tags,
      delay_days: fullUpdated.delay_days, attempt_count: fullUpdated.attempt_count,
      completion_hour: new Date().getHours(),
    }, now)
  else if (body.done === false && prev?.done === true)
    await logEvent(user.id, 'uncompleted', id, {}, now)

  return Response.json(fullUpdated)
}

export async function DELETE(request) {
  const user = await getAuthUser(request)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const id = new URL(request.url).searchParams.get('id')

  if (!id) {
    const { error } = await supabase.from('tasks').delete().eq('user_id', user.id)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ success: true, deletedAll: true })
  }

  const { error } = await supabase.from('tasks').delete().eq('id', id).eq('user_id', user.id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  await logEvent(user.id, 'deleted', id, {}, new Date())
  return Response.json({ success: true })
}
