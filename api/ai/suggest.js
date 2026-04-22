/**
 * /api/ai/suggest  ─ 5️⃣ 코칭 (핵심)
 *
 * GET /api/ai/suggest
 *
 * 동작:
 *   1. 최근 이벤트 + 오늘 할일 분석 (조용히 백그라운드에서)
 *   2. 가장 임팩트 있는 코칭 메시지 1개만 반환
 *   3. 짧고 명확하게 — 행동으로 연결
 *
 * 설계 원칙:
 *   - AI가 말을 걸어야 할 때만 말함
 *   - 항상 "그래서 뭘 해야 하는지"로 끝남
 */
import supabase from '../_lib/supabase.js'
import { callGeminiJSON } from '../_lib/gemini.js'
import { withCors, getUserId } from '../_lib/cors.js'
import { getAuthUser } from '../_lib/auth.js'

export default withCors(async (req, res) => {
  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })
  req.user = user
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' })

  const uid   = getUserId(req)
  const today = new Date().toISOString().slice(0, 10)
  const hour  = new Date().getHours()

  // ── 데이터 수집 ─────────────────────────────────────────
  const [{ data: todayTasks }, { data: recentEvents }] = await Promise.all([
    supabase.from('tasks')
      .select('id,title,done,priority,tags,due_date,delay_days,attempt_count')
      .eq('user_id', uid)
      .eq('done', false),
    supabase.from('events')
      .select('type,hour,metadata,timestamp')
      .eq('user_id', uid)
      .gte('timestamp', new Date(Date.now() - 7 * 86400000).toISOString())
      .order('timestamp', { ascending: false })
      .limit(100)
  ])

  const overdue  = (todayTasks || []).filter(t => t.due_date && t.due_date < today)
  const dueToday = (todayTasks || []).filter(t => t.due_date === today)
  const highPri  = (todayTasks || []).filter(t => t.priority === 'high')

  // 시간대별 완료 패턴
  const hourMap = Array(24).fill(0)
  ;(recentEvents || []).filter(e => e.type === 'completed').forEach(e => {
    if (e.hour != null) hourMap[e.hour]++
  })
  const isPeakHour = hourMap[hour] >= 2

  // 태그별 완료율 계산
  const tagStats = {}
  ;(recentEvents || []).forEach(e => {
    const tags = e.metadata?.tags || []
    tags.forEach(tag => {
      if (!tagStats[tag]) tagStats[tag] = { complete: 0, create: 0 }
      if (e.type === 'completed') tagStats[tag].complete++
      if (e.type === 'created')   tagStats[tag].create++
    })
  })
  const weakTag = Object.entries(tagStats)
    .filter(([, s]) => s.create >= 3)
    .sort((a, b) => (a[1].complete / a[1].create) - (b[1].complete / b[1].create))[0]?.[0]

  // ── 상황 판단 (AI 호출 전에 규칙 기반으로 먼저 거름) ───
  const context = {
    hour, isPeakHour,
    overdueCount:  overdue.length,
    todayCount:    dueToday.length,
    highPriCount:  highPri.length,
    totalPending:  todayTasks?.length || 0,
    weakTag:       weakTag || null,
    overdueTitle:  overdue[0]?.title || null,
    highPriTitle:  highPri[0]?.title || null
  }

  // 아무것도 없으면 AI 호출 안 함
  if (context.totalPending === 0) {
    return res.json({ message: '오늘 할일을 모두 완료했어요! 내일 계획을 세워볼까요? 🎉', type: 'success' })
  }

  // ── Gemini 코칭 ─────────────────────────────────────────
  const prompt = `
당신은 개인 생산성 코치입니다. 다음 상황을 보고 코칭 메시지를 JSON으로 답하세요.

현재 상황:
- 지금 시각: ${hour}시
- 집중 시간대 여부: ${context.isPeakHour ? '예 (지금이 집중 시간)' : '아니오'}
- 기한 초과 할일: ${context.overdueCount}개 ${context.overdueTitle ? `(예: "${context.overdueTitle}")` : ''}
- 오늘 마감 할일: ${context.todayCount}개
- 중요 할일: ${context.highPriCount}개 ${context.highPriTitle ? `(예: "${context.highPriTitle}")` : ''}
- 완료율 낮은 태그: ${context.weakTag ? `#${context.weakTag}` : '없음'}

규칙:
- message: 한 문장, 20자 이내, 반드시 행동으로 끝남
- type: "urgent" | "focus" | "encourage" | "habit"
- action: 지금 당장 할 행동 (5단어 이내)

우선순위: 기한초과 > 집중시간 > 중요할일 > 습관

JSON만 출력:
{"message":"...","type":"...","action":"..."}
`

  const result = await callGeminiJSON(prompt)

  if (!result) {
    // Gemini 실패 시 규칙 기반 폴백
    if (context.overdueCount > 0) {
      return res.json({ message: `기한 초과 ${context.overdueCount}개, 지금 하나만 해결하세요`, type: 'urgent', action: '기한 초과 확인' })
    }
    if (context.isPeakHour) {
      return res.json({ message: '지금이 집중 시간입니다. 중요한 것부터', type: 'focus', action: '중요 할일 시작' })
    }
    return res.json({ message: `남은 할일 ${context.totalPending}개. 작은 것 하나부터`, type: 'encourage', action: '할일 목록 확인' })
  }

  return res.json(result)
})
