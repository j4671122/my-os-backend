/**
 * /api/ai/report  ─ 3️⃣ 분석 + 4️⃣ 생성
 *
 * POST /api/ai/report
 * Body: { days? }  (기본 7일)
 *
 * 동작:
 *   1. 최근 N일 tasks + events 수집
 *   2. 통계 직접 계산 (AI 전에 데이터가 말함)
 *   3. Gemini로 인사이트 + 코칭 생성
 *   4. 구조화된 리포트 반환
 */
import supabase from '../_lib/supabase.js'
import { callGemini } from '../_lib/gemini.js'
import { withCors, getUserId } from '../_lib/cors.js'
import { getAuthUser } from '../_lib/auth.js'

export default withCors(async (req, res) => {
  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })
  req.user = user
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  const uid      = getUserId(req)
  const { days = 7 } = req.body || {}

  const since = new Date()
  since.setDate(since.getDate() - days)
  const sinceStr = since.toISOString()

  // ── 1. 데이터 수집 ──────────────────────────────────────
  const [{ data: tasks }, { data: events }] = await Promise.all([
    supabase.from('tasks')
      .select('id,title,done,priority,tags,due_date,created_at,completed_at,delay_days,attempt_count')
      .eq('user_id', uid)
      .gte('created_at', sinceStr),
    supabase.from('events')
      .select('type,hour,day_of_week,metadata,timestamp')
      .eq('user_id', uid)
      .gte('timestamp', sinceStr)
  ])

  if (!tasks?.length) {
    return res.json({ summary: '이번 주 데이터가 없어요. 할일을 추가해보세요!', stats: {} })
  }

  // ── 2. 통계 계산 (AI보다 이 데이터가 핵심) ──────────────
  const total     = tasks.length
  const completed = tasks.filter(t => t.done)
  const rate      = total ? Math.round(completed.length / total * 100) : 0
  const overdue   = tasks.filter(t => !t.done && t.due_date && t.due_date < new Date().toISOString().slice(0,10))
  const delayed   = tasks.filter(t => (t.delay_days || 0) > 0)

  // 태그 분석
  const tagStats = {}
  tasks.forEach(t => (t.tags || []).forEach(tag => {
    if (!tagStats[tag]) tagStats[tag] = { total: 0, done: 0 }
    tagStats[tag].total++
    if (t.done) tagStats[tag].done++
  }))
  const tagRates = Object.entries(tagStats)
    .map(([tag, s]) => ({ tag, rate: Math.round(s.done / s.total * 100), total: s.total }))
    .sort((a, b) => b.rate - a.rate)

  // 시간대 분석
  const hourMap = Array(24).fill(0)
  ;(events || []).filter(e => e.type === 'completed').forEach(e => {
    if (e.hour != null) hourMap[e.hour]++
  })
  const peakHour = hourMap.indexOf(Math.max(...hourMap))

  // 요일 분석
  const dayNames = ['일','월','화','수','목','금','토']
  const dayMap   = Array(7).fill(0)
  ;(events || []).filter(e => e.type === 'completed').forEach(e => {
    if (e.day_of_week != null) dayMap[e.day_of_week]++
  })
  const peakDay = dayNames[dayMap.indexOf(Math.max(...dayMap))]

  const stats = {
    total, completed: completed.length, rate,
    overdue: overdue.length, delayed: delayed.length,
    peakHour, peakDay, tagRates: tagRates.slice(0, 5)
  }

  // ── 3. Gemini 인사이트 생성 ─────────────────────────────
  const prompt = `
당신은 생산성 코치입니다. 다음 ${days}일 데이터를 분석해서 한국어로 짧고 명확하게 리포트를 작성하세요.

📊 통계:
- 전체 할일: ${total}개
- 완료: ${completed.length}개 (${rate}%)
- 기한 초과: ${overdue.length}개
- 미룬 횟수 있는 할일: ${delayed.length}개
- 집중 시간대: ${peakHour}시
- 가장 생산적인 요일: ${peakDay}요일
- 태그별 완료율: ${tagRates.map(t => `#${t.tag} ${t.rate}%`).join(', ')}

형식:
1. 한 줄 요약 (이번 주를 한 문장으로)
2. 잘한 점 1가지
3. 개선할 점 1가지
4. 다음 주 핵심 행동 1가지

각 항목은 1~2문장. 격려하되 솔직하게.
`

  const insight = await callGemini(prompt, { temperature: 0.4, maxTokens: 600 })

  return res.json({ stats, insight, generatedAt: new Date().toISOString() })
})
