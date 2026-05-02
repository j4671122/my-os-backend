import supabase from '@/lib/supabase'
import { getAuthUser } from '@/lib/auth'
import { callGeminiJSON } from '@/lib/gemini'

export async function GET(request) {
  const user = await getAuthUser(request)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const today = new Date().toISOString().slice(0, 10)
  const hour  = new Date().getHours()

  const [{ data: todayTasks }, { data: recentEvents }] = await Promise.all([
    supabase.from('tasks')
      .select('id,title,done,priority,tags,due_date,delay_days,attempt_count')
      .eq('user_id', user.id).eq('done', false),
    supabase.from('events')
      .select('type,hour,metadata,timestamp')
      .eq('user_id', user.id)
      .gte('timestamp', new Date(Date.now() - 7 * 86400000).toISOString())
      .order('timestamp', { ascending: false }).limit(100),
  ])

  const overdue  = (todayTasks || []).filter(t => t.due_date && t.due_date < today)
  const dueToday = (todayTasks || []).filter(t => t.due_date === today)
  const highPri  = (todayTasks || []).filter(t => t.priority === 'high')

  const hourMap = Array(24).fill(0)
  ;(recentEvents || []).filter(e => e.type === 'completed').forEach(e => {
    if (e.hour != null) hourMap[e.hour]++
  })
  const isPeakHour = hourMap[hour] >= 2

  const tagStats = {}
  ;(recentEvents || []).forEach(e => {
    (e.metadata?.tags || []).forEach(tag => {
      if (!tagStats[tag]) tagStats[tag] = { complete: 0, create: 0 }
      if (e.type === 'completed') tagStats[tag].complete++
      if (e.type === 'created')   tagStats[tag].create++
    })
  })
  const weakTag = Object.entries(tagStats)
    .filter(([, s]) => s.create >= 3)
    .sort((a, b) => (a[1].complete / a[1].create) - (b[1].complete / b[1].create))[0]?.[0]

  const ctx = {
    hour, isPeakHour,
    overdueCount: overdue.length,
    todayCount:   dueToday.length,
    highPriCount: highPri.length,
    totalPending: todayTasks?.length || 0,
    weakTag:      weakTag || null,
    overdueTitle: overdue[0]?.title || null,
    highPriTitle: highPri[0]?.title || null,
  }

  if (ctx.totalPending === 0)
    return Response.json({ message: '오늘 할일을 모두 완료했어요! 내일 계획을 세워볼까요? 🎉', type: 'success' })

  const prompt = `
당신은 개인 생산성 코치입니다. 다음 상황을 보고 코칭 메시지를 JSON으로 답하세요.

현재 상황:
- 지금 시각: ${ctx.hour}시
- 집중 시간대 여부: ${ctx.isPeakHour ? '예 (지금이 집중 시간)' : '아니오'}
- 기한 초과 할일: ${ctx.overdueCount}개 ${ctx.overdueTitle ? `(예: "${ctx.overdueTitle}")` : ''}
- 오늘 마감 할일: ${ctx.todayCount}개
- 중요 할일: ${ctx.highPriCount}개 ${ctx.highPriTitle ? `(예: "${ctx.highPriTitle}")` : ''}
- 완료율 낮은 태그: ${ctx.weakTag ? `#${ctx.weakTag}` : '없음'}

규칙:
- message: 한 문장, 20자 이내, 반드시 행동으로 끝남
- type: "urgent" | "focus" | "encourage" | "habit"
- action: 지금 당장 할 행동 (5단어 이내)

우선순위: 기한초과 > 집중시간 > 중요할일 > 습관

JSON만 출력:
{"message":"...","type":"...","action":"..."}
`

  const result = await callGeminiJSON(prompt, { mode: 'coach', temperature: 0.5 })

  if (!result) {
    if (ctx.overdueCount > 0)
      return Response.json({ message: `기한 초과 ${ctx.overdueCount}개, 지금 하나만 해결하세요`, type: 'urgent', action: '기한 초과 확인' })
    if (ctx.isPeakHour)
      return Response.json({ message: '지금이 집중 시간입니다. 중요한 것부터', type: 'focus', action: '중요 할일 시작' })
    return Response.json({ message: `남은 할일 ${ctx.totalPending}개. 작은 것 하나부터`, type: 'encourage', action: '할일 목록 확인' })
  }

  return Response.json(result)
}
